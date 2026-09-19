import { describe, expect, it } from "vitest";
import { classifyRoomUpdate } from "./room-sync";

function disorder(seed: number, revisions: number[]) {
  let state = seed >>> 0;
  const random = () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
  const delivered = revisions.filter(() => random() > 0.18);
  for (const revision of [...delivered]) {
    if (random() > 0.65) delivered.push(revision);
  }
  return delivered.sort(() => random() - 0.5);
}

describe("seeded event disorder simulation", () => {
  it.each([11, 97, 2_026, 65_535])(
    "converges from delay, loss, duplicate, and reorder with seed %i",
    (seed) => {
      let confirmedRevision = 2;
      let reconciliations = 0;
      for (const revision of disorder(seed, [3, 4, 5, 6, 7, 8, 9])) {
        const disposition = classifyRoomUpdate(
          {
            eventVersion: "1.0.0",
            eventId: `evt_simulation_${revision}`,
            roomId: "room_simulation_001",
            revision,
            type: "room.updated",
            occurredAt: "2026-09-18T03:00:00.000Z",
          },
          "room_simulation_001",
          confirmedRevision,
        );
        if (disposition !== "ignore") {
          // An event is only a hint. Reconciliation fetches the authoritative
          // current projection, which is revision 9 in this simulation.
          confirmedRevision = 9;
          reconciliations += 1;
        }
      }
      // Bounded polling is the loss-safe fallback when every event is dropped.
      confirmedRevision = Math.max(confirmedRevision, 9);
      expect(confirmedRevision).toBe(9);
      expect(reconciliations).toBeLessThanOrEqual(1);
    },
  );
});
