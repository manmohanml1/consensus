import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadMigrations } from "../src/migrations.mjs";

describe("migration discovery", () => {
  it("loads repository migrations in a contiguous order with checksums", async () => {
    const migrations = await loadMigrations();

    expect(migrations.map(({ version }) => version)).toEqual([1, 2, 3]);
    expect(
      migrations.every(({ checksum }) => /^[a-f0-9]{64}$/.test(checksum)),
    ).toBe(true);
  });

  it("rejects a version gap before connecting to a database", async () => {
    const directory = await mkdtemp(join(tmpdir(), "consensus-migrations-"));
    await writeFile(join(directory, "0001_first.sql"), "SELECT 1;");
    await writeFile(join(directory, "0003_third.sql"), "SELECT 3;");

    await expect(loadMigrations(directory)).rejects.toThrow("contiguous");
  });
});
