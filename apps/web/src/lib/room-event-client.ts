import { parseRoomUpdateEvent, type RoomUpdateEvent } from "@consensus/domain";
import { roomEventChannel } from "./room-event-channel";

export type RoomEventConnection = "disabled" | "connected" | "interrupted";

function isSignedTokenRequest(value: unknown): value is {
  keyName: string;
  mac: string;
  nonce: string;
  timestamp: number;
  ttl: number;
  capability: string;
} {
  return (
    typeof value === "object" &&
    value !== null &&
    "keyName" in value &&
    typeof value.keyName === "string" &&
    "mac" in value &&
    typeof value.mac === "string" &&
    "nonce" in value &&
    typeof value.nonce === "string" &&
    "timestamp" in value &&
    typeof value.timestamp === "number" &&
    "ttl" in value &&
    typeof value.ttl === "number" &&
    "capability" in value &&
    typeof value.capability === "string"
  );
}

/** Hints are untrusted; callers must fetch the authorized HTTP projection. */
export async function connectRoomEventHints(
  roomId: string,
  onHint: (event: RoomUpdateEvent) => void,
  onConnection: (state: RoomEventConnection) => void,
  signal: AbortSignal,
): Promise<() => void> {
  const tokenUrl = `/api/v1/rooms/${encodeURIComponent(roomId)}/events/token`;
  const fetchToken = async () => {
    const response = await fetch(tokenUrl, {
      credentials: "same-origin",
      cache: "no-store",
      signal,
    });
    if (response.status === 204) return null;
    if (!response.ok) throw new Error("Room notifications unavailable.");
    const token: unknown = await response.json();
    if (!isSignedTokenRequest(token))
      throw new Error("Room notifications unavailable.");
    return token;
  };
  let initialToken = await fetchToken();
  if (!initialToken || signal.aborted) {
    if (!signal.aborted) onConnection("disabled");
    return () => {};
  }

  const Ably = await import("ably");
  if (signal.aborted) return () => {};
  const realtime = new Ably.Realtime({
    authCallback: (_tokenParams, callback) => {
      void (async () => {
        const token = initialToken ?? (await fetchToken());
        initialToken = null;
        if (!token) throw new Error("Room notifications disabled.");
        callback(null, token);
      })().catch(() => callback("Room notifications unavailable.", null));
    },
  });
  const channel = realtime.channels.get(roomEventChannel(roomId));
  const handleMessage = (message: { data?: unknown }) => {
    const parsed = parseRoomUpdateEvent(message.data);
    if (parsed.success && parsed.data.roomId === roomId) onHint(parsed.data);
  };
  const handleConnection = (change: { current: string }) => {
    if (change.current === "connected") onConnection("connected");
    else if (
      change.current === "disconnected" ||
      change.current === "suspended" ||
      change.current === "failed"
    )
      onConnection("interrupted");
  };
  realtime.connection.on(handleConnection);
  try {
    await channel.subscribe("room.updated", handleMessage);
  } catch {
    realtime.close();
    throw new Error("Room notifications unavailable.");
  }
  if (signal.aborted) {
    realtime.close();
    return () => {};
  }
  return () => {
    channel.unsubscribe("room.updated", handleMessage);
    realtime.close();
  };
}
