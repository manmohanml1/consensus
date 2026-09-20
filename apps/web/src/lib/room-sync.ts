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
      mode: signal.terminal
        ? "terminal"
        : state.mode === "offline"
          ? "offline"
          : "current",
      confirmedRevision: Math.max(state.confirmedRevision, signal.revision),
      consecutiveFailures: 0,
      // A projection can arrive while the command HTTP response is still
      // uncertain; only that command's own acknowledgement settles it.
      pendingCommand: state.pendingCommand,
    };
  }
  if (signal.type === "browser-offline") {
    return { ...state, mode: "offline" };
  }
  if (signal.type === "browser-online") {
    return { ...state, mode: "reconciling" };
  }
  if (signal.type === "reconcile-started") {
    return state.mode === "offline" ||
      (state.mode === "current" && state.consecutiveFailures === 0)
      ? state
      : { ...state, mode: "reconciling" };
  }
  if (signal.type === "sync-failed") {
    const consecutiveFailures = state.consecutiveFailures + 1;
    return {
      ...state,
      mode:
        state.mode === "offline"
          ? "offline"
          : consecutiveFailures >= 2
            ? "degraded"
            : "reconciling",
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

export function nextRoomPollDelayMs(failures: number, jitter: number): number {
  const safeFailures = Number.isFinite(failures)
    ? Math.max(0, Math.floor(failures))
    : 0;
  const safeJitter = Number.isFinite(jitter)
    ? Math.min(1, Math.max(0, jitter))
    : 0;
  return Math.min(
    30_000,
    2_500 * 2 ** Math.min(safeFailures, 4) + safeJitter * 500,
  );
}

export const roomSyncCopy: Record<RoomSyncMode, string> = {
  connecting: "Connecting",
  current: "Auto-sync on",
  reconciling: "Catching up",
  degraded: "Delayed · retrying",
  offline: "Offline · changes paused",
  terminal: "Room closed",
};
