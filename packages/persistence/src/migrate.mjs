import process from "node:process";
import pg from "pg";
import { applyMigrations, loadMigrations } from "./migrations.mjs";

const connectionString = process.env.CONSENSUS_MIGRATION_DATABASE_URL;
if (!connectionString) {
  console.error("CONSENSUS_MIGRATION_DATABASE_URL is required.");
  process.exitCode = 1;
} else {
  const client = new pg.Client({ connectionString });
  try {
    await client.connect();
    const migrations = await loadMigrations();
    await applyMigrations(client, migrations);
    console.info(`Applied ${migrations.length} ordered migrations.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Migration failed.");
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => undefined);
  }
}
