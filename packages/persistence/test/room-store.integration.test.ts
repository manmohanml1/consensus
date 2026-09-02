import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ROOM_PROTOCOL_VERSION, type RoomCommand } from "@consensus/domain";
import { issueCapability, issueHostRecoveryCode } from "@consensus/security";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyMigrations, loadMigrations } from "../src/migrations.mjs";
import { PostgresRoomStore } from "../src/room-store";

const connectionString = process.env.CONSENSUS_TEST_DATABASE_URL;
const describeDatabase = connectionString ? describe : describe.skip;

describeDatabase("transactional room command store", () => {
  const admin = new pg.Client({ connectionString });
  const pool = new pg.Pool({ connectionString, max: 4 });
  const store = new PostgresRoomStore(pool);
  const pepper = Uint8Array.from({ length: 32 }, (_, index) => index + 1);
  let hostToken = "";

  beforeAll(async () => {
    await admin.connect();
    await admin.query(
      await readFile(resolve("migrations/bootstrap/roles.sql"), "utf8"),
    );
    await applyMigrations(admin, await loadMigrations());
    const capability = issueCapability(
      { roomId: "room_store_0001", memberId: "member_host_0001", role: "host" },
      new Date(Date.now() + 60 * 60 * 1_000),
      pepper,
    );
    hostToken = capability.takeToken();
    await admin.query(
      `INSERT INTO consensus.rooms
         (id, invite_code_hash, title, protocol_version, ruleset_version,
          target_at, expires_at, deletion_due_at)
       VALUES ($1, decode('11', 'hex'), 'Dinner', '1.0.0', '1.0.0',
               now() + interval '1 hour', now() + interval '2 hours',
               now() + interval '7 days')`,
      ["room_store_0001"],
    );
    await admin.query(
      `INSERT INTO consensus.participants
         (room_id, id, display_name, role, capability_hash, capability_expires_at)
       VALUES ($1, 'member_host_0001', 'Host', 'host', $2, now() + interval '1 hour')`,
      ["room_store_0001", Buffer.from(capability.hash)],
    );
    await admin.query(
      `INSERT INTO consensus.constraints
         (room_id, id, participant_id, kind, visibility, value)
       VALUES ($1, 'constraint_0001', 'member_host_0001', 'allergy', 'private',
               '{"secret":"peanuts"}')`,
      ["room_store_0001"],
    );
    await admin.query(
      `INSERT INTO consensus.candidates
         (room_id, id, name, source, source_reference, field_provenance,
          constraint_evidence)
       VALUES ($1, 'candidate_0001', 'Garden Table', 'fixture', 'private-provider-id',
               '{"providerPayload":{"private":true}}', '{"constraint_0001":true}')`,
      ["room_store_0001"],
    );
  });

  afterAll(async () => {
    await store.close();
    await admin.query("DROP SCHEMA IF EXISTS consensus CASCADE");
    await admin.query("DROP SCHEMA IF EXISTS consensus_internal CASCADE");
    await admin.end();
  });

  const lockCommand = (): RoomCommand => ({
    protocolVersion: ROOM_PROTOCOL_VERSION,
    commandId: "command_lock_0001",
    idempotencyKey: "room-store:lock:0001",
    roomId: "room_store_0001",
    expectedRevision: 0,
    sequence: 1,
    issuedAt: new Date().toISOString(),
    actor: { memberId: "member_host_0001", role: "host" },
    type: "roster.lock",
    payload: {},
  });

  it("replays the exact accepted projection and rejects conflicting reuse", async () => {
    const command = lockCommand();
    const [left, right] = await Promise.all([
      store.executeCommand(command, hostToken, pepper),
      store.executeCommand(command, hostToken, pepper),
    ]);
    const accepted = left.replayed ? right : left;
    const replayed = left.replayed ? left : right;

    expect(accepted.replayed).toBe(false);
    expect(replayed).toEqual({
      replayed: true,
      projection: accepted.projection,
    });
    await expect(
      store.executeCommand(
        { ...command, commandId: "command_lock_0002" },
        hostToken,
        pepper,
      ),
    ).rejects.toMatchObject({ code: "command-conflict" });

    const evidence = await admin.query(
      `SELECT
         (SELECT count(*)::int FROM consensus.commands WHERE room_id = $1) AS commands,
         (SELECT count(*)::int FROM consensus.outbox_events WHERE room_id = $1) AS events,
         (SELECT revision::int FROM consensus.rooms WHERE id = $1) AS revision`,
      ["room_store_0001"],
    );
    expect(evidence.rows[0]).toEqual({ commands: 1, events: 1, revision: 1 });
  });

  it("returns trusted revision conflicts without changing the aggregate", async () => {
    await expect(
      store.executeCommand(
        {
          ...lockCommand(),
          commandId: "command_stale_01",
          idempotencyKey: "room-store:stale:0001",
          sequence: 2,
        },
        hostToken,
        pepper,
      ),
    ).rejects.toMatchObject({ code: "stale-revision", currentRevision: 1 });
    await expect(
      store.executeCommand(
        {
          ...lockCommand(),
          commandId: "command_seq_0001",
          idempotencyKey: "room-store:sequence:0001",
          expectedRevision: 1,
          sequence: 3,
        },
        hostToken,
        pepper,
      ),
    ).rejects.toMatchObject({ code: "sequence-conflict", currentRevision: 1 });
  });

  it("keeps late participants outside the locked roster and omits private state", async () => {
    await admin.query(
      `INSERT INTO consensus.participants
         (room_id, id, display_name, role, capability_hash, capability_expires_at)
       VALUES ('room_store_0001', 'member_late_0001', 'Late guest', 'participant',
               decode('33', 'hex'), now() + interval '1 hour')`,
    );
    const projection = await store.getProjection(
      "room_store_0001",
      hostToken,
      pepper,
    );
    expect(
      projection.ballotProgress.map(({ participantId }) => participantId),
    ).toEqual(["member_host_0001"]);
    const serialized = JSON.stringify(projection);
    expect(serialized).not.toContain("peanuts");
    expect(serialized).not.toContain("private-provider-id");
    expect(serialized).not.toContain("providerPayload");
    expect(serialized).not.toContain("capability_hash");
  });

  it("does not authorize a valid capability in a different room", async () => {
    await expect(
      store.getProjection("room_other_0001", hostToken, pepper),
    ).rejects.toMatchObject({ code: "unauthorized-or-missing" });
  });

  it("creates a host-owned temporary room without persisting raw invitation authority", async () => {
    const capability = issueCapability(
      {
        roomId: "room_created_0001",
        memberId: "member_created_01",
        role: "host",
      },
      new Date(Date.now() + 60 * 60 * 1_000),
      pepper,
    );
    const projection = await store.createRoom({
      roomId: "room_created_0001",
      hostMemberId: "member_created_01",
      title: "Created dinner",
      hostDisplayName: "Maya",
      targetAt: new Date(Date.now() + 30 * 60 * 1_000).toISOString(),
      inviteCodeHash: Buffer.alloc(32, 7),
      hostCapabilityHash: capability.hash,
      capabilityExpiresAt: capability.expiresAt,
      expiresAt: new Date(Date.now() + 60 * 60 * 1_000),
      deletionDueAt: new Date(Date.now() + 8 * 24 * 60 * 60 * 1_000),
    });

    expect(projection).toMatchObject({
      roomId: "room_created_0001",
      phase: "lobby",
      participants: [
        { id: "member_created_01", displayName: "Maya", status: "active" },
      ],
    });
    const stored = await admin.query(
      "SELECT invite_code_hash, capability_hash FROM consensus.rooms JOIN consensus.participants ON rooms.id = participants.room_id WHERE rooms.id = $1",
      ["room_created_0001"],
    );
    expect(stored.rows).toHaveLength(1);
    expect(stored.rows[0]!.invite_code_hash).toEqual(Buffer.alloc(32, 7));
    expect(stored.rows[0]!.capability_hash).toEqual(
      Buffer.from(capability.hash),
    );
  });

  it("redeems one short-lived host transfer and atomically revokes prior authority", async () => {
    const expiresAt = new Date(Date.now() + 60 * 60 * 1_000);
    const original = issueCapability(
      {
        roomId: "room_recovery_001",
        memberId: "member_recovery_01",
        role: "host",
      },
      expiresAt,
      pepper,
    );
    const originalToken = original.takeToken();
    await store.createRoom({
      roomId: "room_recovery_001",
      hostMemberId: "member_recovery_01",
      title: "Recovery dinner",
      hostDisplayName: "Host",
      targetAt: new Date(Date.now() + 30 * 60 * 1_000).toISOString(),
      inviteCodeHash: Buffer.alloc(32, 71),
      hostCapabilityHash: original.hash,
      capabilityExpiresAt: expiresAt,
      expiresAt,
      deletionDueAt: new Date(Date.now() + 8 * 24 * 60 * 60 * 1_000),
    });

    const recovery = issueHostRecoveryCode(pepper);
    const recoveryCode = recovery.takeCode();
    await store.createHostRecoveryChallenge(
      "room_recovery_001",
      originalToken,
      pepper,
      recovery.hash,
      recovery.expiresAt,
    );
    const attempts = await Promise.allSettled([
      store.recoverHost("room_recovery_001", recoveryCode, pepper),
      store.recoverHost("room_recovery_001", recoveryCode, pepper),
    ]);
    const succeeded = attempts.filter(
      (
        attempt,
      ): attempt is PromiseFulfilledResult<
        Awaited<ReturnType<typeof store.recoverHost>>
      > => attempt.status === "fulfilled",
    );
    const rejected = attempts.filter(
      (attempt): attempt is PromiseRejectedResult =>
        attempt.status === "rejected",
    );
    expect(succeeded).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.reason).toMatchObject({
      code: "unauthorized-or-missing",
    });
    const recovered = succeeded[0]!.value;
    const replacementToken = recovered.capability.takeToken();

    expect(recovered).toMatchObject({
      actor: {
        memberId: "member_recovery_01",
        role: "host",
        nextSequence: 1,
      },
      projection: { revision: 1 },
    });
    await expect(
      store.getProjection("room_recovery_001", originalToken, pepper),
    ).rejects.toMatchObject({ code: "unauthorized-or-missing" });
    await expect(
      store.getProjection("room_recovery_001", replacementToken, pepper),
    ).resolves.toMatchObject({ revision: 1 });
    await expect(
      store.recoverHost("room_recovery_001", recoveryCode, pepper),
    ).rejects.toMatchObject({ code: "unauthorized-or-missing" });

    const evidence = await admin.query(
      `SELECT
         (SELECT count(*)::int FROM consensus.host_recovery_challenges WHERE room_id = $1) AS challenges,
         (SELECT count(*)::int FROM consensus.outbox_events WHERE room_id = $1 AND event_type = 'room.host.recovered') AS events`,
      ["room_recovery_001"],
    );
    expect(evidence.rows[0]).toEqual({ challenges: 0, events: 1 });
  });

  it("serializes join, approval, roster lock, and dropout without changing the electorate", async () => {
    const expiresAt = new Date(Date.now() + 60 * 60 * 1_000);
    const host = issueCapability(
      {
        roomId: "room_roster_0001",
        memberId: "member_roster_host",
        role: "host",
      },
      expiresAt,
      pepper,
    );
    const hostToken = host.takeToken();
    await store.createRoom({
      roomId: "room_roster_0001",
      hostMemberId: "member_roster_host",
      title: "Roster dinner",
      hostDisplayName: "Host",
      targetAt: new Date(Date.now() + 30 * 60 * 1_000).toISOString(),
      inviteCodeHash: Buffer.alloc(32, 9),
      hostCapabilityHash: host.hash,
      capabilityExpiresAt: expiresAt,
      expiresAt,
      deletionDueAt: new Date(Date.now() + 8 * 24 * 60 * 60 * 1_000),
    });
    const participant = issueCapability(
      {
        roomId: "room_roster_0001",
        memberId: "member_roster_guest",
        role: "participant",
      },
      expiresAt,
      pepper,
    );
    const participantToken = participant.takeToken();
    const joined = await store.joinRoom({
      roomId: "room_roster_0001",
      memberId: "member_roster_guest",
      displayName: "Guest",
      inviteCodeHash: Buffer.alloc(32, 9),
      capabilityHash: participant.hash,
      capabilityExpiresAt: expiresAt,
    });
    expect(joined.projection.participants.at(-1)?.status).toBe("pending");
    await expect(
      store.getProjection("room_roster_0001", participantToken, pepper),
    ).resolves.toMatchObject({ revision: 1 });

    const command = (
      type: RoomCommand["type"],
      payload: RoomCommand["payload"],
      expectedRevision: number,
      sequence: number,
      actor: RoomCommand["actor"],
    ) =>
      ({
        protocolVersion: ROOM_PROTOCOL_VERSION,
        commandId: `command_roster_${expectedRevision}_${sequence}`,
        idempotencyKey: `room-roster:${expectedRevision}:${sequence}`,
        roomId: "room_roster_0001",
        expectedRevision,
        sequence,
        issuedAt: new Date().toISOString(),
        actor,
        type,
        payload,
      }) as RoomCommand;

    await store.executeCommand(
      command(
        "participant.approve",
        { participantId: "member_roster_guest" },
        1,
        1,
        { memberId: "member_roster_host", role: "host" },
      ),
      hostToken,
      pepper,
    );
    await store.executeCommand(
      command("roster.lock", {}, 2, 2, {
        memberId: "member_roster_host",
        role: "host",
      }),
      hostToken,
      pepper,
    );
    const left = await store.executeCommand(
      command("participant.leave", {}, 3, 1, {
        memberId: "member_roster_guest",
        role: "participant",
      }),
      participantToken,
      pepper,
    );
    expect(left.projection.participants).toContainEqual(
      expect.objectContaining({ id: "member_roster_guest", status: "left" }),
    );
    expect(
      left.projection.ballotProgress.map(({ participantId }) => participantId),
    ).toEqual(["member_roster_host", "member_roster_guest"]);
    await expect(
      store.joinRoom({
        roomId: "room_roster_0001",
        memberId: "member_roster_late",
        displayName: "Late",
        inviteCodeHash: Buffer.alloc(32, 9),
        capabilityHash: Buffer.alloc(32, 8),
        capabilityExpiresAt: expiresAt,
      }),
    ).rejects.toMatchObject({ code: "unauthorized-or-missing" });
  });

  it("serializes duplicate lock, vote, resolve, and expiry races", async () => {
    const expiresAt = new Date(Date.now() + 60 * 60 * 1_000);
    const host = issueCapability(
      {
        roomId: "room_races_00001",
        memberId: "member_races_host",
        role: "host",
      },
      expiresAt,
      pepper,
    );
    const token = host.takeToken();
    await store.createRoom({
      roomId: "room_races_00001",
      hostMemberId: "member_races_host",
      title: "Race dinner",
      hostDisplayName: "Host",
      targetAt: new Date(Date.now() + 30 * 60 * 1_000).toISOString(),
      inviteCodeHash: Buffer.alloc(32, 12),
      hostCapabilityHash: host.hash,
      capabilityExpiresAt: expiresAt,
      expiresAt,
      deletionDueAt: new Date(Date.now() + 8 * 24 * 60 * 60 * 1_000),
    });
    await admin.query(
      `INSERT INTO consensus.candidates
         (room_id, id, name, source, field_provenance, constraint_evidence)
       VALUES ('room_races_00001', 'candidate_race_01', 'Race Cafe', 'fixture',
               '{}', '{}')`,
    );
    const makeCommand = (
      type: RoomCommand["type"],
      payload: RoomCommand["payload"],
      revision: number,
      sequence: number,
    ) =>
      ({
        protocolVersion: ROOM_PROTOCOL_VERSION,
        commandId: `command_race_${revision}_${sequence}`,
        idempotencyKey: `room-race:${revision}:${sequence}`,
        roomId: "room_races_00001",
        expectedRevision: revision,
        sequence,
        issuedAt: new Date().toISOString(),
        actor: { memberId: "member_races_host", role: "host" },
        type,
        payload,
      }) as RoomCommand;

    for (const command of [
      makeCommand("roster.lock", {}, 0, 1),
      makeCommand(
        "vote.submit",
        {
          candidateId: "candidate_race_01",
          preference: "prefer",
          mustPick: false,
        },
        1,
        2,
      ),
      makeCommand("decision.resolve", {}, 2, 3),
    ]) {
      const results = await Promise.all([
        store.executeCommand(command, token, pepper),
        store.executeCommand(command, token, pepper),
      ]);
      expect(results.filter(({ replayed }) => replayed)).toHaveLength(1);
      expect(results.filter(({ replayed }) => !replayed)).toHaveLength(1);
    }
    const evidence = await admin.query(
      `SELECT
         (SELECT count(*)::int FROM consensus.commands WHERE room_id = $1) AS commands,
         (SELECT count(*)::int FROM consensus.votes WHERE room_id = $1) AS votes,
         (SELECT count(*)::int FROM consensus.decisions WHERE room_id = $1) AS decisions,
         (SELECT revision::int FROM consensus.rooms WHERE id = $1) AS revision`,
      ["room_races_00001"],
    );
    expect(evidence.rows[0]).toEqual({
      commands: 3,
      votes: 1,
      decisions: 1,
      revision: 3,
    });

    const expiring = issueCapability(
      {
        roomId: "room_expiry_race1",
        memberId: "member_expiry_host",
        role: "host",
      },
      expiresAt,
      pepper,
    );
    const expiringToken = expiring.takeToken();
    await store.createRoom({
      roomId: "room_expiry_race1",
      hostMemberId: "member_expiry_host",
      title: "Expiry race",
      hostDisplayName: "Host",
      targetAt: new Date(Date.now() + 30 * 60 * 1_000).toISOString(),
      inviteCodeHash: Buffer.alloc(32, 13),
      hostCapabilityHash: expiring.hash,
      capabilityExpiresAt: expiresAt,
      expiresAt,
      deletionDueAt: new Date(Date.now() + 8 * 24 * 60 * 60 * 1_000),
    });
    await admin.query(
      `UPDATE consensus.rooms
          SET created_at = transaction_timestamp() - interval '3 hours',
              expires_at = transaction_timestamp() - interval '1 hour'
        WHERE id = 'room_expiry_race1'`,
    );
    await expect(
      store.getProjection("room_expiry_race1", expiringToken, pepper),
    ).resolves.toMatchObject({ phase: "expired", revision: 0 });
    const expiredCommand = {
      ...makeCommand("room.rename", { title: "Too late" }, 0, 1),
      roomId: "room_expiry_race1",
      commandId: "command_expired_01",
      idempotencyKey: "room-expired:rename:1",
      actor: { memberId: "member_expiry_host", role: "host" as const },
    } as RoomCommand;
    const expired = await Promise.allSettled([
      store.executeCommand(expiredCommand, expiringToken, pepper),
      store.executeCommand(expiredCommand, expiringToken, pepper),
    ]);
    expect(expired).toEqual([
      expect.objectContaining({
        status: "rejected",
        reason: expect.objectContaining({ code: "room-expired" }),
      }),
      expect.objectContaining({
        status: "rejected",
        reason: expect.objectContaining({ code: "room-expired" }),
      }),
    ]);

    const unchanged = await admin.query(
      `SELECT title, revision::int AS revision
         FROM consensus.rooms
        WHERE id = 'room_expiry_race1'`,
    );
    expect(unchanged.rows[0]).toEqual({ title: "Expiry race", revision: 0 });
  });

  it("deletes each due aggregate once, including every sensitive child record", async () => {
    await admin.query(`
      INSERT INTO consensus.rooms
        (id, invite_code_hash, title, protocol_version, ruleset_version,
         target_at, expires_at, deletion_due_at, created_at)
      VALUES
        ('room_retention_01', decode('41', 'hex'), 'Delete me', '1.0.0', '1.0.0',
         now() - interval '9 days', now() - interval '8 days',
         now() - interval '1 day', now() - interval '10 days');

      INSERT INTO consensus.participants
        (room_id, id, display_name, role, capability_hash, capability_expires_at,
         eligible_voter)
      VALUES
        ('room_retention_01', 'member_retention1', 'Private name', 'host',
         decode('42', 'hex'), now() - interval '8 days', true);

      INSERT INTO consensus.constraints
        (room_id, id, participant_id, kind, value)
      VALUES
        ('room_retention_01', 'constraint_ret_01', 'member_retention1',
         'allergy', '{"sensitive":"value"}');

      INSERT INTO consensus.host_recovery_challenges
        (room_id, host_member_id, code_hash, expires_at)
      VALUES
        ('room_retention_01', 'member_retention1',
         decode(repeat('44', 32), 'hex'), now() - interval '8 days');

      INSERT INTO consensus.candidates
        (room_id, id, name, source, field_provenance, constraint_evidence)
      VALUES
        ('room_retention_01', 'candidate_ret_01', 'Private candidate', 'fixture',
         '{"provider":"private"}', '{"constraint_ret_01":true}');

      INSERT INTO consensus.commands
        (room_id, command_id, participant_id, idempotency_key, command_type,
         expected_revision, accepted_revision, participant_sequence, issued_at,
         payload_hash, result_projection)
      VALUES
        ('room_retention_01', 'command_ret_0001', 'member_retention1',
         'retention:fixture:1', 'vote.submit', 0, 1, 1, now() - interval '8 days',
         decode(repeat('43', 32), 'hex'), '{"private":"projection"}');

      INSERT INTO consensus.votes
        (room_id, participant_id, candidate_id, command_id, preference, must_pick)
      VALUES
        ('room_retention_01', 'member_retention1', 'candidate_ret_01',
         'command_ret_0001', 'prefer', false);

      INSERT INTO consensus.decisions
        (room_id, winner_candidate_id, status, eligible_participant_ids,
         ruleset_version, reason_codes, scores, resolved_revision)
      VALUES
        ('room_retention_01', 'candidate_ret_01', 'decided',
         '["member_retention1"]', '1.0.0', '["consensus"]',
         '{"private":"scores"}', 1);

      INSERT INTO consensus.commitments
        (room_id, participant_id, decision_revision, response)
      VALUES ('room_retention_01', 'member_retention1', 1, 'in');

      INSERT INTO consensus.outbox_events
        (id, room_id, aggregate_revision, event_type, event_version, payload)
      VALUES
        ('event_retention_01', 'room_retention_01', 1,
         'room.projection.updated', '1.0.0', '{"private":"event"}');
    `);

    const sweeps = await Promise.all([
      store.deleteRoomsDueForDeletion(1),
      store.deleteRoomsDueForDeletion(1),
    ]);
    expect(sweeps.reduce((total, result) => total + result.deleted, 0)).toBe(1);
    await expect(store.deleteRoomsDueForDeletion(1)).resolves.toEqual({
      deleted: 0,
    });

    const room = await admin.query(
      "SELECT count(*)::int AS count FROM consensus.rooms WHERE id = $1",
      ["room_retention_01"],
    );
    expect(room.rows[0]?.count).toBe(0);

    for (const table of [
      "participants",
      "constraints",
      "candidates",
      "commands",
      "votes",
      "decisions",
      "commitments",
      "outbox_events",
      "host_recovery_challenges",
    ]) {
      const remaining = await admin.query(
        `SELECT count(*)::int AS count FROM consensus.${table} WHERE room_id = $1`,
        ["room_retention_01"],
      );
      expect(remaining.rows[0]?.count).toBe(0);
    }
  });

  it("ends a room irreversibly and only shortens its deletion deadline", async () => {
    const capabilityExpiresAt = new Date(Date.now() + 60 * 60 * 1_000);
    const capability = issueCapability(
      {
        roomId: "room_end_lifecycle1",
        memberId: "member_end_host1",
        role: "host",
      },
      capabilityExpiresAt,
      pepper,
    );
    const token = capability.takeToken();
    const originalDeletionDueAt = new Date(
      Date.now() + 8 * 24 * 60 * 60 * 1_000,
    );
    await store.createRoom({
      roomId: "room_end_lifecycle1",
      hostMemberId: "member_end_host1",
      title: "End lifecycle",
      hostDisplayName: "Host",
      targetAt: new Date(Date.now() + 30 * 60 * 1_000).toISOString(),
      inviteCodeHash: Buffer.alloc(32, 61),
      hostCapabilityHash: capability.hash,
      capabilityExpiresAt,
      expiresAt: capabilityExpiresAt,
      deletionDueAt: originalDeletionDueAt,
    });
    const endCommand = {
      protocolVersion: ROOM_PROTOCOL_VERSION,
      commandId: "command_end_room1",
      idempotencyKey: "room-end:lifecycle:1",
      roomId: "room_end_lifecycle1",
      expectedRevision: 0,
      sequence: 1,
      issuedAt: new Date().toISOString(),
      actor: { memberId: "member_end_host1", role: "host" as const },
      type: "room.end",
      payload: {},
    } satisfies RoomCommand;

    const endedAt = Date.now();
    await expect(
      store.executeCommand(endCommand, token, pepper),
    ).resolves.toMatchObject({
      replayed: false,
      projection: { phase: "expired", revision: 1 },
    });
    await expect(
      store.executeCommand(endCommand, token, pepper),
    ).resolves.toMatchObject({
      replayed: true,
      projection: { phase: "expired", revision: 1 },
    });
    const persisted = await admin.query<{ deletion_due_at: Date }>(
      "SELECT deletion_due_at FROM consensus.rooms WHERE id = $1",
      ["room_end_lifecycle1"],
    );
    const shortened = persisted.rows[0]!.deletion_due_at.getTime();
    expect(shortened).toBeLessThan(originalDeletionDueAt.getTime());
    expect(shortened).toBeGreaterThanOrEqual(
      endedAt + 7 * 24 * 60 * 60 * 1_000,
    );
    expect(shortened).toBeLessThanOrEqual(
      Date.now() + 7 * 24 * 60 * 60 * 1_000,
    );

    await expect(
      store.executeCommand(
        {
          ...endCommand,
          commandId: "command_after_end1",
          idempotencyKey: "room-end:lifecycle:2",
          expectedRevision: 1,
          sequence: 2,
          type: "room.rename",
          payload: { title: "Revived" },
        },
        token,
        pepper,
      ),
    ).rejects.toMatchObject({ code: "room-expired" });
  });
});
