import { describe, expect, it } from "vitest";
import {
  classifyRoomUpdate,
  createRoomSyncState,
  nextRoomPollDelayMs,
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

  it("does not clear an outstanding command on an unrelated projection", () => {
    let state = reduceRoomSync(createRoomSyncState(4), {
      type: "command-started",
    });
    state = reduceRoomSync(state, {
      type: "projection-confirmed",
      revision: 5,
    });
    expect(state).toMatchObject({
      mode: "current",
      confirmedRevision: 5,
      pendingCommand: true,
    });
    expect(
      reduceRoomSync(state, { type: "command-settled" }).pendingCommand,
    ).toBe(false);
  });

  it("keeps an offline signal until an explicit reconnect", () => {
    let state = reduceRoomSync(createRoomSyncState(4), {
      type: "browser-offline",
    });
    state = reduceRoomSync(state, { type: "reconcile-started" });
    expect(state.mode).toBe("offline");
    state = reduceRoomSync(state, { type: "sync-failed" });
    state = reduceRoomSync(state, {
      type: "projection-confirmed",
      revision: 5,
    });
    expect(state).toMatchObject({ mode: "offline", confirmedRevision: 5 });
    expect(reduceRoomSync(state, { type: "browser-online" }).mode).toBe(
      "reconciling",
    );
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

  it("keeps polling backup visible until push transport reconnects", () => {
    let state = createRoomSyncState(4);
    state = reduceRoomSync(state, { type: "transport-connected" });
    state = reduceRoomSync(state, { type: "hint-received", revision: 6 });
    expect(state.mode).toBe("stale");
    state = reduceRoomSync(state, { type: "reconcile-started" });
    expect(state.mode).toBe("reconciling");
    state = reduceRoomSync(state, { type: "transport-interrupted" });
    state = reduceRoomSync(state, {
      type: "projection-confirmed",
      revision: 6,
    });
    expect(state).toMatchObject({
      mode: "degraded",
      transport: "interrupted",
      confirmedRevision: 6,
    });
    state = reduceRoomSync(state, { type: "transport-connected" });
    state = reduceRoomSync(state, {
      type: "projection-confirmed",
      revision: 6,
    });
    expect(state).toMatchObject({ mode: "current", transport: "connected" });
    expect(reduceRoomSync(state, { type: "hint-received", revision: 5 })).toBe(
      state,
    );
  });

  it("bounds retry scheduling even after repeated failures", () => {
    expect(nextRoomPollDelayMs(0, 0)).toBe(2_500);
    expect(nextRoomPollDelayMs(1, 1)).toBe(5_500);
    expect(nextRoomPollDelayMs(3, 0)).toBe(20_000);
    expect(nextRoomPollDelayMs(50, 1)).toBe(30_000);
    expect(nextRoomPollDelayMs(-2, Number.NaN)).toBe(2_500);
    expect(nextRoomPollDelayMs(0, 0, true)).toBe(15_000);
    expect(nextRoomPollDelayMs(0, 1, true)).toBe(17_000);
    expect(nextRoomPollDelayMs(1, 0, true)).toBe(5_000);
  });
});
