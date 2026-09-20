import { afterEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({
  deleteRoomsDueForDeletion: vi.fn().mockResolvedValue({ deleted: 0 }),
  deleteExpiredOutboxEvents: vi.fn().mockResolvedValue(2),
}));

vi.mock("@consensus/persistence", () => ({
  PostgresRoomStore: {
    fromConnectionString: () => store,
  },
}));

const original = {
  database: process.env.CONSENSUS_DATABASE_URL,
  cron: process.env.CRON_SECRET,
  roomRetention: process.env.CONSENSUS_RETENTION_DELETE_ENABLED,
  outboxRetention: process.env.CONSENSUS_OUTBOX_RETENTION_ENABLED,
  realtime: process.env.CONSENSUS_REALTIME_ENABLED,
};

afterEach(() => {
  store.deleteRoomsDueForDeletion.mockClear();
  store.deleteExpiredOutboxEvents.mockClear();
  for (const [name, value] of Object.entries({
    CONSENSUS_DATABASE_URL: original.database,
    CRON_SECRET: original.cron,
    CONSENSUS_RETENTION_DELETE_ENABLED: original.roomRetention,
    CONSENSUS_OUTBOX_RETENTION_ENABLED: original.outboxRetention,
    CONSENSUS_REALTIME_ENABLED: original.realtime,
  })) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

describe("outbox expiry on the daily retention route", () => {
  it("continues expiry cleanup while realtime delivery is off", async () => {
    process.env.CONSENSUS_DATABASE_URL =
      "postgresql://unused:unused@localhost/unused";
    process.env.CRON_SECRET = "a".repeat(32);
    process.env.CONSENSUS_RETENTION_DELETE_ENABLED = "true";
    process.env.CONSENSUS_OUTBOX_RETENTION_ENABLED = "true";
    process.env.CONSENSUS_REALTIME_ENABLED = "false";
    const { GET } = await import("./route");
    const response = await GET(
      new Request("https://consensus.test/api/internal/retention", {
        headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
      }),
    );
    expect(response.status).toBe(200);
    expect(store.deleteExpiredOutboxEvents).toHaveBeenCalledOnce();
    expect(store.deleteExpiredOutboxEvents.mock.calls[0]?.[0]).toBe(500);
  });
});
