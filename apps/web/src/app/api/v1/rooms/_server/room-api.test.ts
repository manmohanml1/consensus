import { ROOM_PROTOCOL_VERSION } from "@consensus/domain";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import { handleCommand, handleProjection } from "./room-api";

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
});
