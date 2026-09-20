import { randomUUID } from "node:crypto";
import * as Ably from "ably";
import {
  publishRoomUpdateBatch,
  PostgresRoomStore,
  type PublishBatchResult,
} from "@consensus/persistence";
import type { RoomUpdateEvent } from "@consensus/domain";
import { after } from "next/server";
import { roomEventChannel } from "../../../../../lib/room-event-channel";

export function roomEventsEnabled(): boolean {
  return (
    process.env.CONSENSUS_REALTIME_ENABLED === "true" &&
    Boolean(process.env.CONSENSUS_ABLY_API_KEY) &&
    Boolean(process.env.CONSENSUS_DATABASE_URL)
  );
}

let rest: Ably.Rest | undefined;
function ablyRest(): Ably.Rest {
  const key = process.env.CONSENSUS_ABLY_API_KEY;
  if (!key) throw new Error("Realtime transport is not configured.");
  rest ??= new Ably.Rest({ key });
  return rest;
}

export async function issueRoomSubscribeToken(roomId: string) {
  return ablyRest().auth.createTokenRequest({
    ttl: 60_000,
    capability: JSON.stringify({ [roomEventChannel(roomId)]: ["subscribe"] }),
  });
}

export async function publishEnabledRoomUpdates(): Promise<PublishBatchResult | null> {
  if (!roomEventsEnabled()) return null;
  const connectionString = process.env.CONSENSUS_DATABASE_URL;
  if (!connectionString) return null;
  const store = PostgresRoomStore.fromConnectionString(connectionString);
  const client = ablyRest();
  const publishLagMs: number[] = [];
  try {
    const result = await publishRoomUpdateBatch(
      store,
      {
        publish: async (event: RoomUpdateEvent) => {
          await client.channels.get(roomEventChannel(event.roomId)).publish({
            id: event.eventId,
            name: "room.updated",
            data: event,
          });
          publishLagMs.push(
            Math.max(0, Date.now() - Date.parse(event.occurredAt)),
          );
        },
      },
      { leaseOwner: `worker.${randomUUID()}`, limit: 10 },
    );
    const sortedLag = publishLagMs.sort((left, right) => left - right);
    const percentile = (fraction: number) =>
      sortedLag[Math.ceil(sortedLag.length * fraction) - 1] ?? null;
    console.info("consensus.realtime.outbox.batch", {
      ...result,
      p50PublishLagMs: percentile(0.5),
      p95PublishLagMs: percentile(0.95),
      p99PublishLagMs: percentile(0.99),
    });
    return result;
  } finally {
    await store.close();
  }
}

/** Best-effort low-latency path; durable outbox and HTTP polling remain authority. */
export function scheduleRoomUpdatePublish(): void {
  if (!roomEventsEnabled()) return;
  after(async () => {
    try {
      await publishEnabledRoomUpdates();
    } catch {
      console.error("consensus.realtime.outbox.batch-failed");
    }
  });
}
