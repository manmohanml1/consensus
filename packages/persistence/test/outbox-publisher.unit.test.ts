import { describe, expect, it, vi } from "vitest";
import {
  outboxRetryDelayMs,
  publishRoomUpdateBatch,
  type LeasedRoomUpdate,
  type PostgresRoomStore,
} from "../src/index";

const delivery = (id: string, attemptCount = 1): LeasedRoomUpdate => ({
  event: {
    eventVersion: "1.0.0",
    eventId: id,
    roomId: "room_outbox_001",
    revision: 4,
    type: "room.updated",
    occurredAt: "2026-09-18T03:00:00.000Z",
  },
  attemptCount,
  leaseExpiresAt: "2026-09-18T03:00:30.000Z",
  expiresAt: "2026-09-25T03:00:00.000Z",
});

describe("outbox publisher", () => {
  it("publishes safe envelopes and acknowledges the matching lease", async () => {
    const store = {
      claimRoomUpdates: vi
        .fn()
        .mockResolvedValue([delivery("evt_publish_001")]),
      markRoomUpdatePublished: vi.fn().mockResolvedValue(true),
    } as unknown as PostgresRoomStore;
    const publish = vi.fn().mockResolvedValue(undefined);
    await expect(
      publishRoomUpdateBatch(
        store,
        { publish },
        { leaseOwner: "worker.test.001" },
      ),
    ).resolves.toEqual({
      claimed: 1,
      published: 1,
      retried: 0,
      poisoned: 0,
      lostLease: 0,
    });
    expect(publish).toHaveBeenCalledWith(delivery("evt_publish_001").event);
  });

  it("records transport failure without persisting exception text", async () => {
    const store = {
      claimRoomUpdates: vi
        .fn()
        .mockResolvedValue([delivery("evt_retry_001", 3)]),
      markRoomUpdateFailed: vi.fn().mockResolvedValue("retry"),
    } as unknown as PostgresRoomStore;
    const publish = vi
      .fn()
      .mockRejectedValue(new Error("secret provider detail"));
    const now = new Date("2026-09-18T03:00:00.000Z");
    const result = await publishRoomUpdateBatch(
      store,
      { publish },
      { leaseOwner: "worker.test.001", now },
    );
    expect(result.retried).toBe(1);
    expect(store.markRoomUpdateFailed).toHaveBeenCalledWith(
      "evt_retry_001",
      "worker.test.001",
      "transport-failed",
      expect.objectContaining({ retryAt: expect.any(Date), now }),
    );
  });

  it("uses deterministic bounded exponential backoff", () => {
    expect(outboxRetryDelayMs(1, "evt_retry_001")).toBeGreaterThanOrEqual(
      1_000,
    );
    expect(outboxRetryDelayMs(4, "evt_retry_001")).toBeGreaterThanOrEqual(
      8_000,
    );
    expect(outboxRetryDelayMs(99, "evt_retry_001")).toBeLessThan(375_000);
    expect(outboxRetryDelayMs(4, "evt_retry_001")).toBe(
      outboxRetryDelayMs(4, "evt_retry_001"),
    );
  });
});
