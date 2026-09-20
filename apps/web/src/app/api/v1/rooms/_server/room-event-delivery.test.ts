import { PostgresRoomStore, RoomStoreError } from "@consensus/persistence";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { roomEventChannel } from "../../../../../lib/room-event-channel";
import { handleRoomEventToken } from "./room-api";

const roomId = "room_12345678";
const request = () =>
  new NextRequest(`https://consensus.test/api/v1/rooms/${roomId}/events/token`);
const original = {
  enabled: process.env.CONSENSUS_REALTIME_ENABLED,
  key: process.env.CONSENSUS_ABLY_API_KEY,
  database: process.env.CONSENSUS_DATABASE_URL,
  pepper: process.env.CONSENSUS_CAPABILITY_PEPPER,
};

afterEach(() => {
  vi.restoreAllMocks();
  for (const [name, value] of Object.entries({
    CONSENSUS_REALTIME_ENABLED: original.enabled,
    CONSENSUS_ABLY_API_KEY: original.key,
    CONSENSUS_DATABASE_URL: original.database,
    CONSENSUS_CAPABILITY_PEPPER: original.pepper,
  })) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

describe("room event subscription boundary", () => {
  it("returns an inert response when the provider switch is off", async () => {
    delete process.env.CONSENSUS_REALTIME_ENABLED;
    const response = await handleRoomEventToken(request(), roomId);
    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("reports incomplete active configuration instead of silently pretending delivery is off", async () => {
    process.env.CONSENSUS_REALTIME_ENABLED = "true";
    delete process.env.CONSENSUS_ABLY_API_KEY;
    const response = await handleRoomEventToken(request(), roomId);
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("requires an authorized projection before minting a room-scoped subscribe-only token", async () => {
    process.env.CONSENSUS_REALTIME_ENABLED = "true";
    process.env.CONSENSUS_ABLY_API_KEY = `app.key:${"A".repeat(43)}`;
    process.env.CONSENSUS_DATABASE_URL =
      "postgresql://unused:unused@localhost/unused";
    process.env.CONSENSUS_CAPABILITY_PEPPER = "A".repeat(43);
    const getAuthorizedProjection = vi
      .fn()
      .mockRejectedValueOnce(new RoomStoreError("unauthorized-or-missing"))
      .mockResolvedValueOnce({ projection: { phase: "lobby" } });
    vi.spyOn(PostgresRoomStore, "fromConnectionString").mockReturnValue({
      getAuthorizedProjection,
    } as unknown as PostgresRoomStore);

    const denied = await handleRoomEventToken(request(), roomId);
    expect(denied.status).toBe(404);
    const allowed = await handleRoomEventToken(request(), roomId);
    expect(allowed.status).toBe(200);
    const token = (await allowed.json()) as { capability: string; ttl: number };
    expect(JSON.parse(token.capability)).toEqual({
      [roomEventChannel(roomId)]: ["subscribe"],
    });
    expect(token.ttl).toBe(60_000);
    expect(JSON.stringify(token)).not.toContain("publish");
    expect(getAuthorizedProjection).toHaveBeenCalledTimes(2);
  });
});
