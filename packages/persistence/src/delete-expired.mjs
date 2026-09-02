import process from "node:process";
import pg from "pg";
import { deleteDueRoomAggregates } from "./retention.mjs";

const connectionString = process.env.CONSENSUS_DATABASE_URL;
const executionEnabled =
  process.env.CONSENSUS_RETENTION_DELETE_ENABLED === "true";
const limit = Number(process.env.CONSENSUS_RETENTION_DELETE_LIMIT ?? "100");

if (!connectionString || !executionEnabled) {
  console.error(
    "Retention deletion requires CONSENSUS_DATABASE_URL and CONSENSUS_RETENTION_DELETE_ENABLED=true.",
  );
  process.exitCode = 1;
} else {
  const pool = new pg.Pool({
    connectionString,
    max: 1,
    application_name: "consensus-retention",
  });
  try {
    const result = await deleteDueRoomAggregates(pool, limit, new Date());
    console.info(
      JSON.stringify({ status: "completed", deleted: result.deleted }),
    );
  } catch {
    console.error(
      "Retention deletion failed; no room identifiers were logged.",
    );
    process.exitCode = 1;
  } finally {
    await pool.end().catch(() => undefined);
  }
}
