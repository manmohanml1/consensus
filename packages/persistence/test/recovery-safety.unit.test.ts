import { describe, expect, it } from "vitest";
import { parseDisposableRecoveryTarget } from "../src/recovery-safety.mjs";

describe("disposable recovery guard", () => {
  it("requires an explicit opt-in", () => {
    expect(() =>
      parseDisposableRecoveryTarget(
        "postgresql://postgres@localhost/consensus_test",
        false,
      ),
    ).toThrow("Recovery rehearsal is not explicitly enabled.");
  });

  it.each([
    "postgresql://postgres@example.com/consensus_test",
    "postgresql://postgres@localhost/consensus",
    "postgresql://postgres@127.0.0.1/production",
  ])("rejects unsafe target %s", (connectionString) => {
    expect(() => parseDisposableRecoveryTarget(connectionString, true)).toThrow(
      "Recovery rehearsal target is not a local test database.",
    );
  });

  it("accepts a localhost test database without exposing credentials", () => {
    const result = parseDisposableRecoveryTarget(
      "postgresql://postgres:secret@localhost:5432/consensus_test",
      true,
    );
    expect(result.sourceDatabase).toBe("consensus_test");
    expect(result.sourceUrl.hostname).toBe("localhost");
  });
});
