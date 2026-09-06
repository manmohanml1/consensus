import { describe, expect, it, vi } from "vitest";
import {
  handleRetentionCron,
  RETENTION_BATCH_LIMIT,
} from "./retention-handler";

const secret = "a".repeat(32);

function cronRequest(value = secret): Request {
  return new Request("https://consensus.test/api/internal/retention", {
    headers: { authorization: `Bearer ${value}` },
  });
}

describe("retention cron boundary", () => {
  it("rejects missing, malformed, and mismatched authorization", async () => {
    const deleteDue = vi.fn();
    const dependencies = { isEnabled: () => true, deleteDue };

    for (const request of [
      new Request("https://consensus.test/api/internal/retention"),
      cronRequest("different-secret"),
    ]) {
      const response = await handleRetentionCron(request, secret, dependencies);
      expect(response.status).toBe(401);
      expect(response.headers.get("cache-control")).toContain("no-store");
    }
    expect(deleteDue).not.toHaveBeenCalled();
  });

  it("fails closed when deletion is disabled", async () => {
    const deleteDue = vi.fn();
    const response = await handleRetentionCron(cronRequest(), secret, {
      isEnabled: () => false,
      deleteDue,
    });

    expect(response.status).toBe(503);
    expect(deleteDue).not.toHaveBeenCalled();
  });

  it("uses the fixed bounded limit and returns only the deleted count", async () => {
    const deleteDue = vi.fn().mockResolvedValue({ deleted: 7 });
    const now = new Date("2026-09-05T03:00:00.000Z");
    const response = await handleRetentionCron(cronRequest(), secret, {
      isEnabled: () => true,
      deleteDue,
      now: () => now,
    });

    expect(response.status).toBe(200);
    expect(deleteDue).toHaveBeenCalledWith(RETENTION_BATCH_LIMIT, now);
    await expect(response.json()).resolves.toEqual({
      status: "completed",
      deleted: 7,
    });
  });

  it("returns a safe retryable failure when the store fails", async () => {
    const response = await handleRetentionCron(cronRequest(), secret, {
      isEnabled: () => true,
      deleteDue: vi.fn().mockRejectedValue(new Error("database unavailable")),
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "temporarily-unavailable",
    });
  });
});
