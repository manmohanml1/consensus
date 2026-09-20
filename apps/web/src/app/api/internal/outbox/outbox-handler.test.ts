import { describe, expect, it, vi } from "vitest";
import { handleOutboxWorker, type OutboxDependencies } from "./outbox-handler";

const secret = "a".repeat(32);
const request = (method: "GET" | "POST", credential = secret) =>
  new Request("https://consensus.test/api/internal/outbox", {
    method,
    headers: { authorization: `Bearer ${credential}` },
  });
const dependencies = (): OutboxDependencies => ({
  isEnabled: () => true,
  publish: vi.fn().mockResolvedValue({
    claimed: 2,
    published: 2,
    retried: 0,
    poisoned: 0,
    lostLease: 0,
  }),
  health: vi.fn().mockResolvedValue({
    ready: 0,
    leased: 0,
    poisoned: 0,
    oldestReadyAt: null,
  }),
});

describe("outbox worker boundary", () => {
  it("never invokes publication without the correct separate secret", async () => {
    const deps = dependencies();
    for (const response of [
      await handleOutboxWorker(request("POST"), undefined, deps),
      await handleOutboxWorker(request("POST", "wrong"), secret, deps),
    ]) {
      expect(response.status).toBe(401);
    }
    expect(deps.publish).not.toHaveBeenCalled();
  });

  it("fails closed while delivery is disabled", async () => {
    const deps = { ...dependencies(), isEnabled: () => false };
    const response = await handleOutboxWorker(request("POST"), secret, deps);
    expect(response.status).toBe(503);
    expect(deps.publish).not.toHaveBeenCalled();
  });

  it("returns count-only health and bounded batch results", async () => {
    const deps = dependencies();
    const health = await handleOutboxWorker(request("GET"), secret, deps);
    expect(health.status).toBe(200);
    await expect(health.json()).resolves.toMatchObject({
      poisoned: 0,
      status: "healthy",
      oldestReadyAgeMs: null,
    });
    const batch = await handleOutboxWorker(request("POST"), secret, deps);
    expect(batch.status).toBe(200);
    expect(batch.headers.get("cache-control")).toContain("no-store");
    await expect(batch.json()).resolves.toEqual({
      claimed: 2,
      published: 2,
      retried: 0,
      poisoned: 0,
      lostLease: 0,
    });
  });

  it("flags poison records and lag without exposing event payloads", async () => {
    const deps = {
      ...dependencies(),
      health: vi.fn().mockResolvedValue({
        ready: 1,
        leased: 0,
        poisoned: 1,
        oldestReadyAt: "2026-09-01T00:00:00.000Z",
      }),
    };
    const response = await handleOutboxWorker(request("GET"), secret, deps);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: "degraded",
    });
  });

  it("keeps provider errors out of the response", async () => {
    const deps = {
      ...dependencies(),
      publish: vi.fn().mockRejectedValue(new Error("sensitive vendor detail")),
    };
    const response = await handleOutboxWorker(request("POST"), secret, deps);
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("sensitive vendor detail");
  });
});
