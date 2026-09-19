import { describe, expect, it } from "vitest";
import {
  ROOM_EVENT_VERSION,
  parseRoomUpdateEvent,
  type RoomUpdateEvent,
} from "./room-protocol";

const fixture: RoomUpdateEvent = {
  eventVersion: ROOM_EVENT_VERSION,
  eventId: "evt_0123456789abcdef",
  roomId: "room_0123456789abcdef",
  revision: 12,
  type: "room.updated",
  occurredAt: "2026-09-18T03:00:00.000Z",
};

describe("room update event envelope", () => {
  it("accepts the documented privacy-minimized v1 fixture", () => {
    expect(parseRoomUpdateEvent(fixture)).toEqual({
      success: true,
      data: fixture,
    });
  });

  it.each([
    ["unknown event versions", { ...fixture, eventVersion: "2.0.0" }],
    ["unknown fields", { ...fixture, participantName: "private" }],
    ["unsafe authentication material", { ...fixture, token: "secret" }],
    ["invalid revisions", { ...fixture, revision: 0 }],
    ["unknown types", { ...fixture, type: "room.ballot.cast" }],
  ])("rejects %s", (_name, value) => {
    expect(parseRoomUpdateEvent(value).success).toBe(false);
  });
});
