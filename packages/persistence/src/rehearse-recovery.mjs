import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import pg from "pg";
import { applyMigrations, loadMigrations } from "./migrations.mjs";
import { parseDisposableRecoveryTarget } from "./recovery-safety.mjs";

const connectionString = process.env.CONSENSUS_TEST_DATABASE_URL;
const rehearsalEnabled = process.env.CONSENSUS_RECOVERY_REHEARSAL === "true";
const fixtureRoomId = "room_recovery_fixture";
/** @type {URL | undefined} */
let sourceUrl;
let sourceDatabase = "";
let restoreDatabase = "";
/** @type {pg.Client | undefined} */
let admin;
let safeTarget = false;
let expectedMigrationCount = 0;

/** @param {string} value */
function quoteIdentifier(value) {
  return `"${value.replaceAll('"', '""')}"`;
}

async function dropRestoreDatabase() {
  if (!admin || !restoreDatabase) return;
  await admin.query(
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
    [restoreDatabase],
  );
  await admin.query(
    `DROP DATABASE IF EXISTS ${quoteIdentifier(restoreDatabase)}`,
  );
}

async function dropSourceSchemas() {
  if (!sourceUrl || !safeTarget) return;
  const source = new pg.Client({ connectionString: sourceUrl.toString() });
  await source.connect();
  try {
    await source.query("DROP SCHEMA IF EXISTS consensus CASCADE");
    await source.query("DROP SCHEMA IF EXISTS consensus_internal CASCADE");
  } finally {
    await source.end();
  }
}

try {
  ({ sourceUrl, sourceDatabase } = parseDisposableRecoveryTarget(
    connectionString,
    rehearsalEnabled,
  ));
  safeTarget = true;

  const source = new pg.Client({ connectionString: sourceUrl.toString() });
  await source.connect();
  try {
    const identity = await source.query(
      "SELECT current_database() AS database_name",
    );
    if (identity.rows[0]?.database_name !== sourceDatabase) {
      throw new Error(
        "Recovery rehearsal connected to an unexpected database.",
      );
    }
    await source.query(
      await readFile(resolve("migrations/bootstrap/roles.sql"), "utf8"),
    );
    const migrations = await loadMigrations();
    expectedMigrationCount = migrations.length;
    await applyMigrations(source, migrations);
    await source.query("DELETE FROM consensus.rooms WHERE id = $1", [
      fixtureRoomId,
    ]);
    await source.query(
      `INSERT INTO consensus.rooms
         (id, invite_code_hash, title, protocol_version, ruleset_version,
          target_at, expires_at, deletion_due_at)
       VALUES ($1, decode('51', 'hex'), 'Recovery fixture', '1.0.0', '1.0.0',
               now() + interval '1 hour', now() + interval '2 hours',
               now() + interval '7 days')`,
      [fixtureRoomId],
    );
    await source.query(
      `INSERT INTO consensus.participants
         (room_id, id, display_name, role, capability_hash, capability_expires_at)
       VALUES ($1, 'member_recovery_host', 'Recovery host', 'host',
               decode('52', 'hex'), now() + interval '2 hours')`,
      [fixtureRoomId],
    );
  } finally {
    await source.end();
  }

  restoreDatabase = `${sourceDatabase}_restore_${process.pid}_${Date.now()}`
    .toLowerCase()
    .slice(0, 63);
  const adminUrl = new URL(sourceUrl);
  adminUrl.pathname = "/postgres";
  admin = new pg.Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  await admin.query(
    `CREATE DATABASE ${quoteIdentifier(restoreDatabase)} TEMPLATE ${quoteIdentifier(sourceDatabase)}`,
  );

  const restoreUrl = new URL(sourceUrl);
  restoreUrl.pathname = `/${encodeURIComponent(restoreDatabase)}`;
  const restored = new pg.Client({ connectionString: restoreUrl.toString() });
  await restored.connect();
  try {
    const evidence = await restored.query(
      `SELECT
         (SELECT count(*)::int FROM consensus_internal.schema_migrations) AS migrations,
         (SELECT count(*)::int FROM consensus.rooms WHERE id = $1) AS rooms,
         (SELECT count(*)::int FROM consensus.participants WHERE room_id = $1) AS participants`,
      [fixtureRoomId],
    );
    if (
      evidence.rows[0]?.migrations !== expectedMigrationCount ||
      evidence.rows[0]?.rooms !== 1 ||
      evidence.rows[0]?.participants !== 1
    ) {
      throw new Error(
        "Restored database failed schema or fixture verification.",
      );
    }
  } finally {
    await restored.end();
  }

  await dropRestoreDatabase();
  const removed = await admin.query(
    "SELECT count(*)::int AS count FROM pg_database WHERE datname = $1",
    [restoreDatabase],
  );
  if (removed.rows[0]?.count !== 0) {
    throw new Error("Disposable restore database teardown was not verified.");
  }
  restoreDatabase = "";

  await dropSourceSchemas();
  const sourceCheck = new pg.Client({ connectionString: sourceUrl.toString() });
  await sourceCheck.connect();
  try {
    const schemas = await sourceCheck.query(
      "SELECT count(*)::int AS count FROM information_schema.schemata WHERE schema_name IN ('consensus', 'consensus_internal')",
    );
    if (schemas.rows[0]?.count !== 0) {
      throw new Error("Disposable source teardown was not verified.");
    }
  } finally {
    await sourceCheck.end();
  }

  console.info(
    JSON.stringify({
      status: "verified",
      migrations: expectedMigrationCount,
      fixtureRooms: 1,
      fixtureParticipants: 1,
      teardown: "verified",
    }),
  );
} catch {
  console.error(
    "Disposable recovery rehearsal failed; connection details were not logged.",
  );
  process.exitCode = 1;
} finally {
  await dropRestoreDatabase().catch(() => undefined);
  await dropSourceSchemas().catch(() => undefined);
  await admin?.end().catch(() => undefined);
}
