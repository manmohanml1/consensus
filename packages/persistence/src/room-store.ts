import { createHash } from "node:crypto";
import {
  DECISION_RULESET_VERSION,
  ROOM_PROTOCOL_LIMITS,
  ROOM_PROTOCOL_VERSION,
  parseRoomProjection,
  resolveDecision,
  type Candidate,
  type HardConstraint,
  type RoomCommand,
  type RoomProjection,
  type RoomProtocolErrorCode,
} from "@consensus/domain";
import {
  authorizeCapability,
  type StoredCapability,
} from "@consensus/security";
import pg, { type Pool, type PoolClient } from "pg";
import { deleteDueRoomAggregates } from "./retention.mjs";

export interface CommandResult {
  replayed: boolean;
  projection: RoomProjection;
}

export interface CreateRoomInput {
  roomId: string;
  hostMemberId: string;
  title: string;
  hostDisplayName: string;
  targetAt: string;
  inviteCodeHash: Uint8Array;
  hostCapabilityHash: Uint8Array;
  capabilityExpiresAt: Date;
  expiresAt: Date;
  deletionDueAt: Date;
}

export interface JoinRoomInput {
  roomId: string;
  memberId: string;
  displayName: string;
  inviteCodeHash: Uint8Array;
  capabilityHash: Uint8Array;
  capabilityExpiresAt: Date;
}

export interface JoinRoomResult {
  roomId: string;
  projection: RoomProjection;
}

export interface RetentionSweepResult {
  deleted: number;
}

export class RoomStoreError extends Error {
  constructor(
    readonly code: RoomProtocolErrorCode,
    readonly currentRevision?: number,
  ) {
    super(code);
    this.name = "RoomStoreError";
  }
}

interface RoomRow {
  id: string;
  title: string;
  phase: RoomProjection["phase"];
  revision: string;
  target_at: Date;
  created_at: Date;
  expires_at: Date;
  roster_locked_at: Date | null;
}

interface ParticipantRow {
  id: string;
  display_name: string;
  role: "host" | "participant";
  status: "pending" | "active" | "left";
  capability_hash: Buffer;
  capability_expires_at: Date;
  eligible_voter: boolean;
  last_sequence: string;
}

const toIso = (value: Date) => value.toISOString();

function commandHash(command: RoomCommand): Buffer {
  return createHash("sha256").update(JSON.stringify(command)).digest();
}

function outboxEventId(roomId: string, commandId: string): string {
  const digest = createHash("sha256")
    .update(roomId)
    .update("\0")
    .update(commandId)
    .digest("hex")
    .slice(0, 48);
  return `evt_${digest}`;
}

function asStoredCapability(
  roomId: string,
  row: ParticipantRow,
): StoredCapability {
  return {
    roomId,
    memberId: row.id,
    role: row.role,
    hash: row.capability_hash,
    expiresAt: row.capability_expires_at,
    status: row.status,
  };
}

function parseProjection(value: unknown): RoomProjection {
  const parsed = parseRoomProjection(value);
  if (!parsed.success) {
    throw new Error("Persisted room projection violates the room protocol.");
  }
  return parsed.data;
}

export class PostgresRoomStore {
  constructor(private readonly pool: Pool) {}

  static fromConnectionString(connectionString: string): PostgresRoomStore {
    return new PostgresRoomStore(new pg.Pool({ connectionString }));
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async createRoom(input: CreateRoomInput): Promise<RoomProjection> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO consensus.rooms
           (id, invite_code_hash, title, protocol_version, ruleset_version,
            target_at, expires_at, deletion_due_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          input.roomId,
          Buffer.from(input.inviteCodeHash),
          input.title,
          ROOM_PROTOCOL_VERSION,
          DECISION_RULESET_VERSION,
          input.targetAt,
          input.expiresAt,
          input.deletionDueAt,
        ],
      );
      await client.query(
        `INSERT INTO consensus.participants
           (room_id, id, display_name, role, capability_hash, capability_expires_at)
         VALUES ($1, $2, $3, 'host', $4, $5)`,
        [
          input.roomId,
          input.hostMemberId,
          input.hostDisplayName,
          Buffer.from(input.hostCapabilityHash),
          input.capabilityExpiresAt,
        ],
      );
      const room = await this.loadRoom(client, input.roomId, false);
      if (!room) throw new Error("Created room was not found.");
      const projection = await this.buildProjection(client, room);
      await client.query("COMMIT");
      return projection;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      if (error instanceof Error && "code" in error && error.code === "23505") {
        throw new RoomStoreError("temporarily-unavailable");
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async joinRoom(input: JoinRoomInput): Promise<JoinRoomResult> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const located = await client.query<RoomRow>(
        `SELECT id, title, phase, revision, target_at, created_at, expires_at,
                roster_locked_at
           FROM consensus.rooms
          WHERE id = $1 AND invite_code_hash = $2
          FOR UPDATE`,
        [input.roomId, Buffer.from(input.inviteCodeHash)],
      );
      const room = located.rows[0];
      if (
        !room ||
        room.expires_at.getTime() <= Date.now() ||
        room.roster_locked_at !== null ||
        (room.phase !== "lobby" && room.phase !== "candidate-review")
      ) {
        throw new RoomStoreError("unauthorized-or-missing");
      }
      const count = await client.query<{ count: number }>(
        `SELECT count(*)::int AS count
           FROM consensus.participants
          WHERE room_id = $1 AND status <> 'left'`,
        [room.id],
      );
      if ((count.rows[0]?.count ?? 0) >= ROOM_PROTOCOL_LIMITS.maxParticipants) {
        throw new RoomStoreError("room-locked");
      }
      await client.query(
        `INSERT INTO consensus.participants
           (room_id, id, display_name, role, status, capability_hash,
            capability_expires_at)
         VALUES ($1, $2, $3, 'participant', 'pending', $4, $5)`,
        [
          room.id,
          input.memberId,
          input.displayName,
          Buffer.from(input.capabilityHash),
          input.capabilityExpiresAt,
        ],
      );
      const revision = Number(room.revision) + 1;
      await this.advanceRevision(client, room.id, revision);
      const updatedRoom = await this.loadRoom(client, room.id, false);
      if (!updatedRoom) throw new Error("Joined room disappeared.");
      const projection = await this.buildProjection(client, updatedRoom);
      await client.query(
        `INSERT INTO consensus.outbox_events
           (id, room_id, aggregate_revision, event_type, event_version, payload)
         VALUES ($1, $2, $3, 'room.participant.requested', $4, $5)`,
        [
          outboxEventId(room.id, `join_${input.memberId}`),
          room.id,
          revision,
          ROOM_PROTOCOL_VERSION,
          projection,
        ],
      );
      await client.query("COMMIT");
      return { roomId: room.id, projection };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      if (error instanceof RoomStoreError) throw error;
      if (error instanceof Error && "code" in error && error.code === "23505") {
        throw new RoomStoreError("command-conflict");
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async locateJoinableRoom(inviteCodeHash: Uint8Array): Promise<string> {
    const result = await this.pool.query<{ id: string }>(
      `SELECT id FROM consensus.rooms
        WHERE invite_code_hash = $1
          AND expires_at > statement_timestamp()
          AND roster_locked_at IS NULL
          AND phase IN ('lobby', 'candidate-review')`,
      [Buffer.from(inviteCodeHash)],
    );
    const roomId = result.rows[0]?.id;
    if (!roomId) throw new RoomStoreError("unauthorized-or-missing");
    return roomId;
  }

  async getProjection(
    roomId: string,
    token: unknown,
    pepper: Uint8Array,
  ): Promise<RoomProjection> {
    const client = await this.pool.connect();
    try {
      await client.query(
        "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY",
      );
      const room = await this.loadRoom(client, roomId, false);
      if (!room) {
        await this.authenticate(client, roomId, token, pepper, true);
        throw new RoomStoreError("unauthorized-or-missing");
      }
      await this.authenticate(client, roomId, token, pepper, true);
      const projection = await this.buildProjection(client, room);
      await client.query("COMMIT");
      return room.expires_at.getTime() <= Date.now()
        ? { ...projection, phase: "expired" }
        : projection;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async executeCommand(
    command: RoomCommand,
    token: unknown,
    pepper: Uint8Array,
  ): Promise<CommandResult> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const room = await this.loadRoom(client, command.roomId, true);
      if (!room) {
        await this.authenticate(client, command.roomId, token, pepper);
        throw new RoomStoreError("unauthorized-or-missing");
      }
      const actor = await this.authenticate(
        client,
        command.roomId,
        token,
        pepper,
      );
      if (
        actor.id !== command.actor.memberId ||
        actor.role !== command.actor.role
      ) {
        throw new RoomStoreError("unauthorized-or-missing");
      }
      if (room.expires_at.getTime() <= Date.now()) {
        throw new RoomStoreError("room-expired");
      }

      const payloadHash = commandHash(command);
      const prior = await client.query<{
        payload_hash: Buffer;
        result_projection: unknown;
      }>(
        `SELECT payload_hash, result_projection
           FROM consensus.commands
          WHERE room_id = $1 AND participant_id = $2 AND idempotency_key = $3`,
        [command.roomId, actor.id, command.idempotencyKey],
      );
      const previous = prior.rows[0];
      if (previous) {
        if (!previous.payload_hash.equals(payloadHash)) {
          throw new RoomStoreError("command-conflict");
        }
        const projection = parseProjection(previous.result_projection);
        await client.query("COMMIT");
        return { replayed: true, projection };
      }

      const currentRevision = Number(room.revision);
      if (command.expectedRevision !== currentRevision) {
        throw new RoomStoreError("stale-revision", currentRevision);
      }
      if (command.sequence !== Number(actor.last_sequence) + 1) {
        throw new RoomStoreError("sequence-conflict", currentRevision);
      }

      const acceptedRevision = currentRevision + 1;
      await this.applyCommand(client, room, actor, command, acceptedRevision);
      await client.query(
        `UPDATE consensus.participants
            SET last_sequence = $3
          WHERE room_id = $1 AND id = $2`,
        [command.roomId, actor.id, command.sequence],
      );
      const updatedRoom = await this.loadRoom(client, command.roomId, false);
      if (!updatedRoom) throw new Error("Room disappeared during command.");
      const projection = await this.buildProjection(client, updatedRoom);

      await client.query(
        `INSERT INTO consensus.commands
          (room_id, command_id, participant_id, idempotency_key, command_type,
           expected_revision, accepted_revision, participant_sequence, issued_at,
           payload_hash, result_projection)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          command.roomId,
          command.commandId,
          actor.id,
          command.idempotencyKey,
          command.type,
          command.expectedRevision,
          acceptedRevision,
          command.sequence,
          command.issuedAt,
          payloadHash,
          projection,
        ],
      );
      await client.query(
        `INSERT INTO consensus.outbox_events
          (id, room_id, aggregate_revision, event_type, event_version, payload)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          outboxEventId(command.roomId, command.commandId),
          command.roomId,
          acceptedRevision,
          "room.projection.updated",
          ROOM_PROTOCOL_VERSION,
          projection,
        ],
      );
      await client.query("COMMIT");
      return { replayed: false, projection };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      if (
        error instanceof RoomStoreError ||
        !(error instanceof Error) ||
        !("code" in error)
      ) {
        throw error;
      }
      if (error.code === "23505") {
        throw new RoomStoreError("command-conflict");
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteRoomsDueForDeletion(
    limit = 100,
    now = new Date(),
  ): Promise<RetentionSweepResult> {
    return deleteDueRoomAggregates(
      this.pool,
      limit,
      now,
    ) as Promise<RetentionSweepResult>;
  }

  private async loadRoom(
    client: PoolClient,
    roomId: string,
    lock: boolean,
  ): Promise<RoomRow | null> {
    const result = await client.query<RoomRow>(
      `SELECT id, title, phase, revision, target_at, created_at, expires_at,
              roster_locked_at
         FROM consensus.rooms
        WHERE id = $1${lock ? " FOR UPDATE" : ""}`,
      [roomId],
    );
    return result.rows[0] ?? null;
  }

  private async authenticate(
    client: PoolClient,
    roomId: string,
    token: unknown,
    pepper: Uint8Array,
    allowPending = false,
  ): Promise<ParticipantRow> {
    const result = await client.query<ParticipantRow>(
      `SELECT id, display_name, role, status, capability_hash,
              capability_expires_at, eligible_voter, last_sequence
         FROM consensus.participants
        WHERE room_id = $1
        ORDER BY id`,
      [roomId],
    );
    for (const participant of result.rows) {
      if (
        authorizeCapability(
          token,
          pepper,
          asStoredCapability(roomId, participant),
          { roomId, allowPending },
        )
      ) {
        return participant;
      }
    }
    authorizeCapability(token, pepper, null, { roomId });
    throw new RoomStoreError("unauthorized-or-missing");
  }

  private async applyCommand(
    client: PoolClient,
    room: RoomRow,
    actor: ParticipantRow,
    command: RoomCommand,
    acceptedRevision: number,
  ): Promise<void> {
    if (room.phase === "expired") throw new RoomStoreError("room-expired");
    const hostOnly =
      command.type !== "vote.submit" &&
      command.type !== "commitment.set" &&
      command.type !== "participant.leave";
    const participantOnly = command.type === "participant.leave";
    if (
      (hostOnly && actor.role !== "host") ||
      (participantOnly && actor.role !== "participant")
    ) {
      throw new RoomStoreError("unauthorized-or-missing");
    }

    switch (command.type) {
      case "room.rename":
        if (room.phase === "voting" || room.phase === "resolved") {
          throw new RoomStoreError("room-locked");
        }
        await client.query(
          `UPDATE consensus.rooms SET title = $2, revision = $3,
                  updated_at = transaction_timestamp() WHERE id = $1`,
          [room.id, command.payload.title, acceptedRevision],
        );
        return;
      case "room.end":
        await client.query(
          `UPDATE consensus.rooms SET phase = 'expired', ended_at = transaction_timestamp(),
                  deletion_due_at = LEAST(
                    deletion_due_at,
                    transaction_timestamp() + interval '7 days'
                  ),
                  revision = $2, updated_at = transaction_timestamp() WHERE id = $1`,
          [room.id, acceptedRevision],
        );
        return;
      case "participant.approve":
        if (room.roster_locked_at !== null) {
          throw new RoomStoreError("room-locked");
        }
        if (
          (
            await client.query(
              `UPDATE consensus.participants
                  SET status = 'active'
                WHERE room_id = $1 AND id = $2 AND role = 'participant'
                  AND status = 'pending'`,
              [room.id, command.payload.participantId],
            )
          ).rowCount !== 1
        ) {
          throw new RoomStoreError("invalid-request");
        }
        await this.advanceRevision(client, room.id, acceptedRevision);
        return;
      case "participant.remove":
        if (
          (
            await client.query(
              `UPDATE consensus.participants
                  SET status = 'left', left_at = transaction_timestamp()
                WHERE room_id = $1 AND id = $2 AND role = 'participant'
                  AND status IN ('pending', 'active')`,
              [room.id, command.payload.participantId],
            )
          ).rowCount !== 1
        ) {
          throw new RoomStoreError("invalid-request");
        }
        await this.advanceRevision(client, room.id, acceptedRevision);
        return;
      case "participant.leave":
        if (actor.status !== "active") {
          throw new RoomStoreError("unauthorized-or-missing");
        }
        await client.query(
          `UPDATE consensus.participants
              SET status = 'left', left_at = transaction_timestamp()
            WHERE room_id = $1 AND id = $2`,
          [room.id, actor.id],
        );
        await this.advanceRevision(client, room.id, acceptedRevision);
        return;
      case "roster.lock":
        if (room.phase !== "lobby" && room.phase !== "candidate-review") {
          throw new RoomStoreError("room-locked");
        }
        await client.query(
          `UPDATE consensus.participants SET eligible_voter = (status = 'active')
            WHERE room_id = $1`,
          [room.id],
        );
        await client.query(
          `UPDATE consensus.rooms SET phase = 'voting',
                  roster_locked_at = transaction_timestamp(), revision = $2,
                  updated_at = transaction_timestamp() WHERE id = $1`,
          [room.id, acceptedRevision],
        );
        return;
      case "candidate.add":
      case "candidate.remove": {
        if (room.phase !== "lobby" && room.phase !== "candidate-review") {
          throw new RoomStoreError("room-locked");
        }
        const status = command.type === "candidate.add" ? "active" : "removed";
        const result = await client.query(
          `UPDATE consensus.candidates
              SET status = $3,
                  removed_at = CASE WHEN $3 = 'removed' THEN transaction_timestamp() ELSE NULL END
            WHERE room_id = $1 AND id = $2`,
          [room.id, command.payload.candidateId, status],
        );
        if (result.rowCount !== 1) throw new RoomStoreError("invalid-request");
        await client.query(
          `UPDATE consensus.rooms SET phase = 'candidate-review', revision = $2,
                  updated_at = transaction_timestamp() WHERE id = $1`,
          [room.id, acceptedRevision],
        );
        return;
      }
      case "vote.submit": {
        if (room.phase !== "voting" || !actor.eligible_voter) {
          throw new RoomStoreError("room-locked");
        }
        const candidate = await client.query(
          `SELECT 1 FROM consensus.candidates
            WHERE room_id = $1 AND id = $2 AND status = 'active'`,
          [room.id, command.payload.candidateId],
        );
        if (candidate.rowCount !== 1)
          throw new RoomStoreError("invalid-request");
        await client.query(
          `INSERT INTO consensus.votes
             (room_id, participant_id, candidate_id, command_id, preference, must_pick)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (room_id, participant_id, candidate_id) DO UPDATE
             SET command_id = EXCLUDED.command_id,
                 preference = EXCLUDED.preference,
                 must_pick = EXCLUDED.must_pick,
                 submitted_at = transaction_timestamp()`,
          [
            room.id,
            actor.id,
            command.payload.candidateId,
            command.commandId,
            command.payload.preference,
            command.payload.mustPick,
          ],
        );
        await this.advanceRevision(client, room.id, acceptedRevision);
        return;
      }
      case "decision.resolve":
        if (room.phase !== "voting") throw new RoomStoreError("room-locked");
        await this.resolveRoom(client, room.id, acceptedRevision);
        return;
      case "commitment.set": {
        if (room.phase !== "resolved") throw new RoomStoreError("room-locked");
        const decision = await client.query<{ resolved_revision: string }>(
          "SELECT resolved_revision FROM consensus.decisions WHERE room_id = $1",
          [room.id],
        );
        const resolvedRevision = decision.rows[0]?.resolved_revision;
        if (!resolvedRevision) throw new RoomStoreError("invalid-request");
        await client.query(
          `INSERT INTO consensus.commitments
             (room_id, participant_id, decision_revision, response)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (room_id, participant_id) DO UPDATE
             SET response = EXCLUDED.response, updated_at = transaction_timestamp()`,
          [
            room.id,
            actor.id,
            resolvedRevision,
            command.payload.committed ? "in" : "out",
          ],
        );
        await this.advanceRevision(client, room.id, acceptedRevision);
        return;
      }
    }
  }

  private async advanceRevision(
    client: PoolClient,
    roomId: string,
    revision: number,
  ): Promise<void> {
    await client.query(
      `UPDATE consensus.rooms SET revision = $2,
              updated_at = transaction_timestamp() WHERE id = $1`,
      [roomId, revision],
    );
  }

  private async resolveRoom(
    client: PoolClient,
    roomId: string,
    revision: number,
  ): Promise<void> {
    const participantRows = await client.query<{ id: string }>(
      `SELECT id FROM consensus.participants
        WHERE room_id = $1 AND eligible_voter = true ORDER BY id`,
      [roomId],
    );
    const constraintRows = await client.query<{ id: string; kind: string }>(
      `SELECT id, kind FROM consensus.constraints
        WHERE room_id = $1 AND active = true ORDER BY id`,
      [roomId],
    );
    const candidateRows = await client.query<{
      id: string;
      name: string;
      distance_meters: number;
      open_confidence: Candidate["openConfidence"];
      constraint_evidence: Record<string, true | false | "unknown">;
      source: string;
    }>(
      `SELECT id, name, distance_meters, open_confidence,
              constraint_evidence, source
         FROM consensus.candidates
        WHERE room_id = $1 AND status = 'active' ORDER BY id`,
      [roomId],
    );
    const voteRows = await client.query<{
      participant_id: string;
      candidate_id: string;
      preference: "prefer" | "accept" | "avoid";
      must_pick: boolean;
    }>(
      `SELECT participant_id, candidate_id, preference, must_pick
         FROM consensus.votes WHERE room_id = $1`,
      [roomId],
    );
    const participants = participantRows.rows.map(({ id }) => id);
    const constraints: HardConstraint[] = constraintRows.rows.map(
      ({ id, kind }) => ({
        id,
        label: kind,
        required: true,
      }),
    );
    const candidates: Candidate[] = candidateRows.rows.map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      summary: "",
      distanceMeters: candidate.distance_meters,
      priceLabel: null,
      openConfidence: candidate.open_confidence,
      constraintEvidence: candidate.constraint_evidence,
      sourceLabel: candidate.source,
      websiteUrl: null,
    }));
    const ballots: Record<
      string,
      Record<
        string,
        { preference: "prefer" | "accept" | "avoid"; mustPick: boolean }
      >
    > = {};
    for (const vote of voteRows.rows) {
      ballots[vote.participant_id] ??= {};
      ballots[vote.participant_id]![vote.candidate_id] = {
        preference: vote.preference,
        mustPick: vote.must_pick,
      };
    }
    if (participants.length === 0 || candidates.length === 0) {
      throw new RoomStoreError("invalid-request");
    }
    const result = resolveDecision({
      participantIds: participants,
      constraints,
      candidates,
      ballots,
    });
    if (result.status === "incomplete")
      throw new RoomStoreError("invalid-request");
    await client.query(
      `INSERT INTO consensus.decisions
         (room_id, winner_candidate_id, status, eligible_participant_ids,
          ruleset_version, reason_codes, scores, resolved_revision)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        roomId,
        result.status === "decided" ? result.winnerCandidateId : null,
        result.status,
        JSON.stringify(participants),
        DECISION_RULESET_VERSION,
        JSON.stringify(
          result.status === "decided"
            ? result.reasons
            : result.failedConstraintIds,
        ),
        Object.fromEntries(
          result.evaluations.map((entry) => [entry.candidateId, entry]),
        ),
        revision,
      ],
    );
    await client.query(
      `UPDATE consensus.rooms SET phase = 'resolved', revision = $2,
              updated_at = transaction_timestamp() WHERE id = $1`,
      [roomId, revision],
    );
  }

  private async buildProjection(
    client: PoolClient,
    room: RoomRow,
  ): Promise<RoomProjection> {
    const participants = await client.query<{
      id: string;
      display_name: string;
      status: "pending" | "active" | "left";
      eligible_voter: boolean;
    }>(
      `SELECT id, display_name, status, eligible_voter
         FROM consensus.participants WHERE room_id = $1 ORDER BY joined_at, id`,
      [room.id],
    );
    const constraints = await client.query<{ id: string }>(
      `SELECT id FROM consensus.constraints
        WHERE room_id = $1 AND active = true ORDER BY id`,
      [room.id],
    );
    const candidates = await client.query<{
      id: string;
      name: string;
      status: "active" | "removed";
    }>(
      `SELECT id, name, status FROM consensus.candidates
        WHERE room_id = $1 ORDER BY created_at, id`,
      [room.id],
    );
    const progress = await client.query<{
      participant_id: string;
      completed: number;
    }>(
      `SELECT participant_id, count(*)::int AS completed
         FROM consensus.votes WHERE room_id = $1 GROUP BY participant_id`,
      [room.id],
    );
    const decision = await client.query<{
      status: "decided" | "no-safe-result";
      ruleset_version: string;
      winner_candidate_id: string | null;
    }>(
      `SELECT status, ruleset_version, winner_candidate_id
         FROM consensus.decisions WHERE room_id = $1`,
      [room.id],
    );
    const completedByParticipant = new Map(
      progress.rows.map((row) => [row.participant_id, row.completed]),
    );
    const activeCandidateCount = candidates.rows.filter(
      ({ status }) => status === "active",
    ).length;
    const eligibleParticipants = participants.rows.filter(
      ({ eligible_voter }) => eligible_voter,
    );
    const projection: RoomProjection = {
      protocolVersion: ROOM_PROTOCOL_VERSION,
      roomId: room.id,
      revision: Number(room.revision),
      phase: room.phase,
      title: room.title,
      targetAt: toIso(room.target_at),
      createdAt: toIso(room.created_at),
      expiresAt: toIso(room.expires_at),
      rosterLocked: room.roster_locked_at !== null,
      participants: participants.rows.map(({ id, display_name, status }) => ({
        id,
        displayName: display_name,
        status,
      })),
      constraintIds: constraints.rows.map(({ id }) => id),
      candidates: candidates.rows.map(({ id, name, status }) => ({
        id,
        name,
        status,
      })),
      ballotProgress: eligibleParticipants.map(({ id }) => ({
        participantId: id,
        completed: completedByParticipant.get(id) ?? 0,
        total: activeCandidateCount,
      })),
      decision: decision.rows[0]
        ? {
            status: decision.rows[0].status,
            rulesetVersion: decision.rows[0].ruleset_version,
            winnerCandidateId: decision.rows[0].winner_candidate_id,
          }
        : null,
    };
    return parseProjection(projection);
  }
}
