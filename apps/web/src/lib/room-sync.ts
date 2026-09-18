import type { RoomUpdateEvent } from "@consensus/domain";

export type RoomSyncMode =
  | "connecting"
  | "current"
  | "reconciling"
  | "degraded"
  | "offline"
  | "terminal";

export interface RoomSyncState {
  mode: RoomSyncMode;
  confirmedRevision: number;
  consecutiveFailures: number;
  pendingCommand: boolean;
}

export type RoomSyncSignal =
  | { type: "projection-confirmed"; revision: number; terminal?: boolean }
  | { type: "reconcile-started" }
  | { type: "sync-failed" }
  | { type: "browser-offline" }
  | { type: "browser-online" }
  | { type: "command-started" }
  | { type: "command-uncertain" }
  | { type: "command-settled" };

export const createRoomSyncState = (revision = 0): RoomSyncState => ({
  mode: revision > 0 ? "current" : "connecting",
  confirmedRevision: revision,
  consecutiveFailures: 0,
  pendingCommand: false,
});

export function reduceRoomSync(
  state: RoomSyncState,
  signal: RoomSyncSignal,
): RoomSyncState {
  if (state.mode === "terminal") return state;
  if (signal.type === "projection-confirmed") {
    return {
      mode: signal.terminal ? "terminal" : "current",
      confirmedRevision: Math.max(state.confirmedRevision, signal.revision),
      consecutiveFailures: 0,
      pendingCommand: false,
    };
  }
  if (signal.type === "browser-offline") {
    return { ...state, mode: "offline" };
  }
  if (signal.type === "browser-online") {
    return { ...state, mode: "reconciling" };
  }
  if (signal.type === "reconcile-started") {
    return state.mode === "current" && state.consecutiveFailures === 0
      ? state
      : { ...state, mode: "reconciling" };
  }
  if (signal.type === "sync-failed") {
    const consecutiveFailures = state.consecutiveFailures + 1;
    return {
      ...state,
      mode: consecutiveFailures >= 2 ? "degraded" : "reconciling",
      consecutiveFailures,
    };
  }
  if (signal.type === "command-started") {
    return { ...state, pendingCommand: true };
  }
  if (signal.type === "command-uncertain") {
    return { ...state, mode: "degraded", pendingCommand: true };
  }
  return { ...state, pendingCommand: false };
}

export type RoomEventDisposition = "ignore" | "refresh" | "gap";

export function classifyRoomUpdate(
  event: RoomUpdateEvent,
  roomId: string,
  confirmedRevision: number,
): RoomEventDisposition {
  if (event.roomId !== roomId || event.revision <= confirmedRevision) {
    return "ignore";
  }
  return event.revision === confirmedRevision + 1 ? "refresh" : "gap";
}

export const roomSyncCopy: Record<RoomSyncMode, string> = {
  connecting: "Connecting",
  current: "Live · auto-sync on",
  reconciling: "Catching up",
  degraded: "Delayed · retrying",
  offline: "Offline · changes paused",
  terminal: "Room closed",
};
