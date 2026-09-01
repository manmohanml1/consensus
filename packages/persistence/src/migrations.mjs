import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const defaultMigrationsDirectory = resolve(
  fileURLToPath(new URL("../migrations", import.meta.url)),
);

const migrationNamePattern = /^\d{4}_[a-z0-9_]+\.sql$/;

/** @param {string} directory */
export async function loadMigrations(directory = defaultMigrationsDirectory) {
  const names = (await readdir(directory))
    .filter((name) => migrationNamePattern.test(name))
    .sort((left, right) => left.localeCompare(right));

  if (names.length === 0) throw new Error("No migrations were found.");

  const versions = names.map((name) => Number.parseInt(name.slice(0, 4), 10));
  for (let index = 0; index < versions.length; index += 1) {
    if (versions[index] !== index + 1) {
      throw new Error(
        "Migration versions must be contiguous and start at 0001.",
      );
    }
  }

  return Promise.all(
    names.map(async (name) => {
      const path = resolve(directory, name);
      const sql = await readFile(path, "utf8");
      return {
        version: Number.parseInt(name.slice(0, 4), 10),
        name: basename(name),
        checksum: createHash("sha256").update(sql).digest("hex"),
        sql,
      };
    }),
  );
}

/**
 * @param {import('pg').Client} client
 * @param {{version: number, name: string, checksum: string, sql: string}[]} migrations
 */
export async function applyMigrations(client, migrations) {
  await client.query("BEGIN");
  try {
    await client.query("SELECT pg_advisory_xact_lock($1)", [830_202]);
    await client.query("SET LOCAL ROLE consensus_migrator");
    await client.query(`
      CREATE SCHEMA IF NOT EXISTS consensus_internal;
      CREATE TABLE IF NOT EXISTS consensus_internal.schema_migrations (
        version integer PRIMARY KEY CHECK (version > 0),
        name text NOT NULL UNIQUE,
        checksum char(64) NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT transaction_timestamp()
      );
    `);

    const result = await client.query(
      "SELECT version, name, checksum FROM consensus_internal.schema_migrations ORDER BY version",
    );
    const applied = new Map(
      result.rows.map((row) => [Number(row.version), row]),
    );

    for (const migration of migrations) {
      const existing = applied.get(migration.version);
      if (existing) {
        if (
          existing.name !== migration.name ||
          existing.checksum.trim() !== migration.checksum
        ) {
          throw new Error(
            `Applied migration ${migration.version} does not match the repository.`,
          );
        }
        continue;
      }

      await client.query(migration.sql);
      await client.query(
        `INSERT INTO consensus_internal.schema_migrations (version, name, checksum)
         VALUES ($1, $2, $3)`,
        [migration.version, migration.name, migration.checksum],
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}
