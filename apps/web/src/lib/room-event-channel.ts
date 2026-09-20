const roomIdPattern = /^room_[A-Za-z0-9_-]{8,59}$/;

/** A routing name, never an authority or invitation credential. */
export function roomEventChannel(roomId: string): string {
  if (!roomIdPattern.test(roomId)) throw new Error("Invalid room id.");
  return `consensus:room:${roomId}`;
}
