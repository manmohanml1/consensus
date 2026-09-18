import type { RoomProjection, RoomRole } from "@consensus/domain";

export type RoomState = {
  room: RoomProjection;
  actor: { memberId: string; role: RoomRole; nextSequence: number };
};

// Replays can contain an old projection with a current actor sequence.
export function reconcileRoom(current: RoomState, next: RoomState): RoomState {
  if (
    current.room.roomId !== next.room.roomId ||
    current.actor.memberId !== next.actor.memberId
  )
    return current;
  const latest = next.room.revision >= current.room.revision ? next : current;
  return {
    room: {
      ...latest.room,
      // Natural expiry is projected without incrementing the durable revision.
      phase:
        current.room.phase === "expired" || next.room.phase === "expired"
          ? "expired"
          : latest.room.phase,
    },
    actor: {
      ...latest.actor,
      nextSequence: Math.max(
        current.actor.nextSequence,
        next.actor.nextSequence,
      ),
    },
  };
}

export const roomErrorCode = (error: unknown): string =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  typeof error.code === "string"
    ? error.code
    : "";

export const isUncertainRoomError = (error: unknown): boolean =>
  error instanceof Error ||
  !roomErrorCode(error) ||
  (typeof error === "object" &&
    error !== null &&
    "uncertain" in error &&
    error.uncertain === true);

export async function requestRoomJson<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    signal: init?.signal ?? AbortSignal.timeout(10_000),
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = await response.json();
  if (!response.ok) throw { ...body, uncertain: response.status >= 500 };
  return body as T;
}
