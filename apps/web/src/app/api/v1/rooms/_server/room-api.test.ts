import { ROOM_PROTOCOL_VERSION } from "@consensus/domain";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import {
  handleCommand,
  handleCreateHostRecovery,
  handleProjection,
  handleRedeemHostRecovery,
  handleRoomCreation,
  handleRoomJoin,
} from "./room-api";

const originalDatabaseUrl = process.env.CONSENSUS_DATABASE_URL;
const originalPepper = process.env.CONSENSUS_CAPABILITY_PEPPER;

afterEach(() => {
  if (originalDatabaseUrl === undefined)
    delete process.env.CONSENSUS_DATABASE_URL;
  else process.env.CONSENSUS_DATABASE_URL = originalDatabaseUrl;
  if (originalPepper === undefined)
    delete process.env.CONSENSUS_CAPABILITY_PEPPER;
  else process.env.CONSENSUS_CAPABILITY_PEPPER = originalPepper;
});

const command = JSON.stringify({
  protocolVersion: ROOM_PROTOCOL_VERSION,
  commandId: "command_12345678",
  idempotencyKey: "browser:command:0001",
  roomId: "room_12345678",
  expectedRevision: 0,
  sequence: 1,
  issuedAt: "2026-09-01T12:00:00.000Z",
  actor: { memberId: "member_12345678", role: "host" },
  type: "roster.lock",
  payload: {},
});

describe("room command HTTP boundary", () => {
  it("requires same-origin mutation requests", async () => {
    const response = await handleCommand(
      new NextRequest(
        "https://example.test/api/v1/rooms/room_12345678/commands",
        {
          method: "POST",
          headers: { origin: "https://attacker.test" },
          body: command,
        },
      ),
      "room_12345678",
    );
    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("rejects an oversized or route-mismatched command before persistence", async () => {
    const oversized = await handleCommand(
      new NextRequest(
        "https://example.test/api/v1/rooms/room_12345678/commands",
        {
          method: "POST",
          headers: {
            origin: "https://example.test",
            "content-length": "999999",
          },
          body: command,
        },
      ),
      "room_12345678",
    );
    expect(oversized.status).toBe(400);

    const mismatch = await handleCommand(
      new NextRequest(
        "https://example.test/api/v1/rooms/room_other_0001/commands",
        {
          method: "POST",
          headers: { origin: "https://example.test" },
          body: command,
        },
      ),
      "room_other_0001",
    );
    expect(mismatch.status).toBe(400);
  });

  it("fails closed with a safe retryable response when server config is absent", async () => {
    delete process.env.CONSENSUS_DATABASE_URL;
    delete process.env.CONSENSUS_CAPABILITY_PEPPER;
    const response = await handleProjection(
      new NextRequest(
        "https://example.test/api/v1/rooms/room_12345678/projection",
      ),
      "room_12345678",
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      code: "temporarily-unavailable",
      retryable: true,
    });
  });

  it("keeps host authority out of the creation JSON response when unavailable", async () => {
    delete process.env.CONSENSUS_DATABASE_URL;
    delete process.env.CONSENSUS_CAPABILITY_PEPPER;
    const response = await handleRoomCreation(
      new NextRequest("https://example.test/api/v1/rooms", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://example.test",
        },
        body: JSON.stringify({
          protocolVersion: ROOM_PROTOCOL_VERSION,
          title: "Friday dinner",
          hostDisplayName: "Maya",
          targetAt: "2026-09-02T23:00:00.000Z",
        }),
      }),
    );
    expect(response.status).toBe(503);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("rejects cross-origin anonymous creation", async () => {
    const response = await handleRoomCreation(
      new NextRequest("https://example.test/api/v1/rooms", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://attacker.test",
        },
        body: JSON.stringify({
          protocolVersion: ROOM_PROTOCOL_VERSION,
          title: "Friday dinner",
          hostDisplayName: "Maya",
          targetAt: "2026-09-02T23:00:00.000Z",
        }),
      }),
    );
    expect(response.status).toBe(404);
  });

  it("rejects cross-origin joins without revealing locator validity", async () => {
    const response = await handleRoomJoin(
      new NextRequest("https://example.test/api/v1/rooms/join", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://attacker.test",
        },
        body: JSON.stringify({
          protocolVersion: ROOM_PROTOCOL_VERSION,
          locator: "r1.short",
          displayName: "Sam",
        }),
      }),
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({
      code: "unauthorized-or-missing",
    });
  });

  it("requires same-origin requests for both host recovery steps", async () => {
    const initiation = await handleCreateHostRecovery(
      new NextRequest(
        "https://example.test/api/v1/rooms/room_12345678/recovery",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: "https://attacker.test",
          },
          body: JSON.stringify({ protocolVersion: ROOM_PROTOCOL_VERSION }),
        },
      ),
      "room_12345678",
    );
    const redemption = await handleRedeemHostRecovery(
      new NextRequest(
        "https://example.test/api/v1/rooms/room_12345678/recovery/redeem",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: "https://attacker.test",
          },
          body: JSON.stringify({
            protocolVersion: ROOM_PROTOCOL_VERSION,
            recoveryCode: `hr1.${"A".repeat(32)}`,
          }),
        },
      ),
      "room_12345678",
    );

    expect(initiation.status).toBe(404);
    expect(redemption.status).toBe(404);
    expect(await initiation.json()).toMatchObject({
      code: "unauthorized-or-missing",
    });
    expect(await redemption.json()).toMatchObject({
      code: "unauthorized-or-missing",
    });
  });

  it("bounds recovery guesses by privacy-preserving source and room buckets", async () => {
    process.env.CONSENSUS_DATABASE_URL =
      "postgresql://unused:unused@127.0.0.1:1/unused";
    process.env.CONSENSUS_CAPABILITY_PEPPER = "A".repeat(43);
    const attempt = () =>
      handleRedeemHostRecovery(
        new NextRequest(
          "https://example.test/api/v1/rooms/room_rate_limit1/recovery/redeem",
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              origin: "https://example.test",
              "x-forwarded-for": "192.0.2.10",
            },
            body: JSON.stringify({
              protocolVersion: ROOM_PROTOCOL_VERSION,
              recoveryCode: "invalid",
            }),
          },
        ),
        "room_rate_limit1",
      );

    for (let index = 0; index < 10; index += 1) {
      await expect(attempt()).resolves.toMatchObject({ status: 404 });
    }
    const limited = await attempt();
    expect(limited.status).toBe(429);
    expect(await limited.json()).toMatchObject({ code: "rate-limited" });
  });
});
