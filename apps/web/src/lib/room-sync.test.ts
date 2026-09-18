import { describe, expect, it } from "vitest";
import {
  classifyRoomUpdate,
  createRoomSyncState,
  reduceRoomSync,
} from "./room-sync";

describe("room sync state machine", () => {
  it("moves through reconnect, degraded, recovery, and terminal states", () => {
    let state = createRoomSyncState(7);
    state = reduceRoomSync(state, { type: "sync-failed" });
    expect(state.mode).toBe("reconciling");
    state = reduceRoomSync(state, { type: "sync-failed" });
    expect(state.mode).toBe("degraded");
    state = reduceRoomSync(state, { type: "browser-offline" });
    expect(state.mode).toBe("offline");
    state = reduceRoomSync(state, { type: "browser-online" });
    expect(state.mode).toBe("reconciling");
    state = reduceRoomSync(state, {
      type: "projection-confirmed",
      revision: 9,
    });
    expect(state).toMatchObject({
      mode: "current",
      confirmedRevision: 9,
      consecutiveFailures: 0,
    });
    state = reduceRoomSync(state, {
      type: "projection-confirmed",
      revision: 9,
      terminal: true,
    });
    expect(state.mode).toBe("terminal");
    expect(reduceRoomSync(state, { type: "browser-online" })).toBe(state);
  });

  it("never regresses a confirmed revision", () => {
    const state = reduceRoomSync(createRoomSyncState(9), {
      type: "projection-confirmed",
      revision: 4,
    });
    expect(state.confirmedRevision).toBe(9);
  });

  it("classifies duplicate, next, gap, and cross-room events", () => {
    const event = {
      eventVersion: "1.0.0" as const,
      eventId: "evt_disorder_001",
      roomId: "room_disorder_001",
      revision: 8,
      type: "room.updated" as const,
      occurredAt: "2026-09-18T03:00:00.000Z",
    };
    expect(classifyRoomUpdate(event, event.roomId, 8)).toBe("ignore");
    expect(classifyRoomUpdate(event, event.roomId, 7)).toBe("refresh");
    expect(classifyRoomUpdate(event, event.roomId, 3)).toBe("gap");
    expect(classifyRoomUpdate(event, "room_other_001", 3)).toBe("ignore");
  });
});
