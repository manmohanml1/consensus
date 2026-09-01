import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ROOM_PROTOCOL_VERSION, type RoomCommand } from "@consensus/domain";
import { issueCapability } from "@consensus/security";
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
});
