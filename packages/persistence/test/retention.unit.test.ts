import { describe, expect, it, vi } from "vitest";
import {
  deleteDueRoomAggregates,
  validateRetentionSweep,
} from "../src/retention.mjs";

describe("bounded retention deletion", () => {
  it("rejects invalid limits and timestamps before querying", () => {
    for (const limit of [0, 1.5, 1_001, Number.NaN]) {
      expect(() => validateRetentionSweep(limit, new Date())).toThrow(
        "Retention sweep limit must be between 1 and 1000.",
      );
    }
    expect(() => validateRetentionSweep(100, new Date("invalid"))).toThrow(
      "Retention sweep timestamp is invalid.",
    );
  });

  it("uses a bounded due-order query and returns only an aggregate count", async () => {
    const now = new Date("2026-09-02T12:00:00.000Z");
    const query = vi.fn().mockResolvedValue({ rowCount: 3 });
    await expect(
      deleteDueRoomAggregates({ query } as never, 25, now),
    ).resolves.toEqual({ deleted: 3 });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("FOR UPDATE SKIP LOCKED"),
      [now, 25],
    );
  });
});
