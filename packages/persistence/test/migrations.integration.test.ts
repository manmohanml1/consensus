import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyMigrations, loadMigrations } from "../src/migrations.mjs";

const connectionString = process.env.CONSENSUS_TEST_DATABASE_URL;
const describeDatabase = connectionString ? describe : describe.skip;

describeDatabase("room migrations on disposable PostgreSQL", () => {
  const client = new pg.Client({ connectionString });

  beforeAll(async () => {
    await client.connect();
    const rolesSql = await readFile(
      resolve("migrations/bootstrap/roles.sql"),
      "utf8",
    );
    await client.query(rolesSql);
    await applyMigrations(client, await loadMigrations());
  });

  afterAll(async () => {
    await client.query("DROP SCHEMA IF EXISTS consensus CASCADE");
    await client.query("DROP SCHEMA IF EXISTS consensus_internal CASCADE");
    await client.end();
  });

  it("records ordered migrations and can run them idempotently", async () => {
    await applyMigrations(client, await loadMigrations());
    const result = await client.query(
      "SELECT version FROM consensus_internal.schema_migrations ORDER BY version",
    );
    expect(result.rows.map(({ version }) => version)).toEqual([1, 2, 3]);
  });

  it("enforces room, participant, revision, foreign-key, and idempotency invariants", async () => {
    await client.query(`
      INSERT INTO consensus.rooms
        (id, invite_code_hash, title, protocol_version, ruleset_version, target_at, expires_at, deletion_due_at)
      VALUES
        ('room_00000001', decode('01', 'hex'), 'Dinner', '1.0.0', '1.0.0', now() + interval '1 hour', now() + interval '2 hours', now() + interval '7 days');

      INSERT INTO consensus.participants
        (room_id, id, display_name, role, capability_hash, capability_expires_at)
      VALUES
        ('room_00000001', 'member_000001', 'Host', 'host', decode('02', 'hex'), now() + interval '2 hours');

      INSERT INTO consensus.candidates (room_id, id, name, source)
      VALUES ('room_00000001', 'candidate_0001', 'Sample', 'fixture');

      INSERT INTO consensus.commands
        (room_id, command_id, participant_id, idempotency_key, command_type, expected_revision, accepted_revision, participant_sequence, issued_at, payload_hash, result_projection)
      VALUES
        ('room_00000001', 'command_000001', 'member_000001', 'idempotency-key-0001', 'vote.submit', 0, 1, 1, now(), decode(repeat('01', 32), 'hex'), '{}');
    `);

    await expect(
      client.query(`
        INSERT INTO consensus.commands
          (room_id, command_id, participant_id, idempotency_key, command_type, expected_revision, accepted_revision, participant_sequence, issued_at, payload_hash, result_projection)
        VALUES
          ('room_00000001', 'command_000002', 'member_000001', 'idempotency-key-0001', 'vote.submit', 1, 2, 2, now(), decode(repeat('02', 32), 'hex'), '{}');
      `),
    ).rejects.toMatchObject({ code: "23505" });

    await expect(
      client.query(
        "UPDATE consensus.rooms SET revision = -1 WHERE id = 'room_00000001'",
      ),
    ).rejects.toMatchObject({ code: "23514" });

    await expect(
      client.query(`
        INSERT INTO consensus.votes
          (room_id, participant_id, candidate_id, command_id, preference, must_pick)
        VALUES
          ('room_00000001', 'missing_member', 'candidate_0001', 'command_000001', 'accept', false);
      `),
    ).rejects.toMatchObject({ code: "23503" });
  });

  it("keeps accepted commands and decisions immutable to the runtime role", async () => {
    await client.query(`
      INSERT INTO consensus.decisions
        (room_id, winner_candidate_id, status, eligible_participant_ids, ruleset_version, reason_codes, scores, resolved_revision)
      VALUES
        ('room_00000001', 'candidate_0001', 'decided', '["member_000001"]', '1.0.0', '["consensus"]', '{}', 1);
    `);

    await client.query("SET ROLE consensus_runtime");
    try {
      await expect(
        client.query("UPDATE consensus.commands SET command_type = 'room.end'"),
      ).rejects.toMatchObject({ code: "42501" });
      await expect(
        client.query(
          "UPDATE consensus.decisions SET status = 'no-safe-result'",
        ),
      ).rejects.toMatchObject({ code: "42501" });
    } finally {
      await client.query("RESET ROLE");
    }
  });

  it("deletes the complete room aggregate through the bounded retention target", async () => {
    await client.query(
      "DELETE FROM consensus.rooms WHERE id = 'room_00000001'",
    );

    for (const table of ["participants", "candidates", "commands", "votes"]) {
      const result = await client.query(
        `SELECT count(*)::int AS count FROM consensus.${table}`,
      );
      expect(result.rows[0].count).toBe(0);
    }
  });
});
