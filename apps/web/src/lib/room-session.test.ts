import { describe, expect, it, vi, afterEach } from "vitest";
import {
  reconcileRoom,
  requestRoomJson,
  isUncertainRoomError,
  type RoomState,
} from "./room-session";

const state = (revision: number, nextSequence: number): RoomState => ({
  room: { roomId: "room_session_001", revision } as RoomState["room"],
  actor: { memberId: "member_session_001", role: "participant", nextSequence },
});

afterEach(() => vi.unstubAllGlobals());

describe("room session reconciliation", () => {
  it("does not roll back the room or command sequence", () => {
    expect(reconcileRoom(state(8, 5), state(3, 2))).toEqual(state(8, 5));
    expect(reconcileRoom(state(8, 5), state(9, 4))).toEqual(state(9, 5));
    expect(reconcileRoom(state(8, 5), state(3, 6))).toEqual(state(8, 6));
  });
  it("ignores another room or membership", () => {
    const current = state(8, 5);
    const next = state(9, 6);
    expect(
      reconcileRoom(current, {
        ...next,
        actor: { ...next.actor, memberId: "other" },
      }),
    ).toBe(current);
    expect(
      reconcileRoom(current, {
        ...next,
        room: { ...next.room, roomId: "other" },
      }),
    ).toBe(current);
  });
  it("bounds requests and treats server failure as uncertain", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: "temporarily-unavailable" }), {
        status: 503,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(requestRoomJson("/api/v1/rooms")).rejects.toMatchObject({
      uncertain: true,
    });
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    expect(fetchMock.mock.calls[0][1].cache).toBe("no-store");
  });
  it("distinguishes rejected commands from uncertain network delivery", () => {
    expect(
      isUncertainRoomError({ code: "stale-revision", uncertain: false }),
    ).toBe(false);
    expect(isUncertainRoomError(new TypeError("Network failed"))).toBe(true);
  });
});
