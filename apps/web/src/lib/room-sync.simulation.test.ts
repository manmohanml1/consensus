import { describe, expect, it } from "vitest";
import { classifyRoomUpdate, nextRoomPollDelayMs } from "./room-sync";

const roomId = "room_simulation_001";
const lastRevision = 9;

function randomFrom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

interface SimulatedClient {
  revision: number;
  history: number[];
  nextPollAt: number;
  failures: number;
  fetches: number;
}

function simulate(seed: number, clientCount: number, dropAllEvents = false) {
  const random = randomFrom(seed);
  const clients: SimulatedClient[] = Array.from(
    { length: clientCount },
    () => ({
      revision: 2,
      history: [2],
      nextPollAt: 3,
      failures: 0,
      fetches: 0,
    }),
  );
  let authoritativeRevision = 2;
  let duplicatesIgnored = 0;
  let gapsObserved = 0;
  let blockedFetches = 0;
  const fetch = (client: SimulatedClient, tick: number, blocked: boolean) => {
    client.fetches += 1;
    if (blocked) {
      blockedFetches += 1;
      client.failures += 1;
    } else {
      client.revision = Math.max(client.revision, authoritativeRevision);
      client.history.push(client.revision);
      client.failures = 0;
    }
    client.nextPollAt =
      tick + Math.ceil(nextRoomPollDelayMs(client.failures, random()) / 1_000);
  };

  for (let tick = 1; tick <= 70; tick += 1) {
    if (tick >= 2 && tick <= 8) authoritativeRevision += 1;
    for (let index = 0; index < clients.length; index += 1) {
      const client = clients[index];
      const blocked = index === 0 && tick >= 3 && tick <= 15;
      if (tick >= client.nextPollAt) fetch(client, tick, blocked);
      if (tick >= 2 && tick <= 8 && !dropAllEvents && !blocked) {
        const events = [authoritativeRevision];
        if (random() < 0.5) events.push(authoritativeRevision);
        if (random() < 0.4) events.push(Math.max(2, authoritativeRevision - 2));
        for (let cursor = events.length - 1; cursor > 0; cursor -= 1) {
          const swap = Math.floor(random() * (cursor + 1));
          [events[cursor], events[swap]] = [events[swap], events[cursor]];
        }
        for (const revision of events) {
          if (random() < 0.3) continue;
          const disposition = classifyRoomUpdate(
            {
              eventVersion: "1.0.0",
              eventId: `evt_simulation_${revision}`,
              roomId,
              revision,
              type: "room.updated",
              occurredAt: "2026-09-18T03:00:00.000Z",
            },
            roomId,
            client.revision,
          );
          if (disposition === "ignore") duplicatesIgnored += 1;
          else {
            if (disposition === "gap") gapsObserved += 1;
            fetch(client, tick, false);
          }
        }
      }
      if (blocked) expect(client.revision).toBeLessThan(lastRevision);
    }
  }
  return { clients, duplicatesIgnored, gapsObserved, blockedFetches };
}

describe("seeded multi-device convergence simulation", () => {
  it.each([11, 97, 2_026, 65_535])(
    "converges after loss, duplicate, reorder and partition with seed %i",
    (seed) => {
      const result = simulate(seed, 8);
      expect(result.blockedFetches).toBeGreaterThan(0);
      for (const client of result.clients) {
        expect(client.revision).toBe(lastRevision);
        expect(client.history).toEqual(
          [...client.history].sort((a, b) => a - b),
        );
        expect(client.fetches).toBeLessThan(35);
      }
    },
  );

  it("recovers by polling even when every notification is lost", () => {
    const result = simulate(42, 2, true);
    expect(result.blockedFetches).toBeGreaterThan(0);
    expect(result.clients.map((client) => client.revision)).toEqual([9, 9]);
    expect(result.duplicatesIgnored).toBe(0);
    expect(result.gapsObserved).toBe(0);
  });

  it("replays the same trace for the same seed", () => {
    expect(simulate(93, 4)).toEqual(simulate(93, 4));
  });
});
