import type { RoomUpdateEvent } from "@consensus/domain";
import type { PostgresRoomStore } from "./room-store";

export interface RoomUpdateTransport {
  /** Publish must use eventId as its provider-side idempotency key. */
  publish(event: RoomUpdateEvent): Promise<void>;
}

export interface PublishBatchResult {
  claimed: number;
  published: number;
  retried: number;
  poisoned: number;
  lostLease: number;
}

export function outboxRetryDelayMs(attemptCount: number, eventId: string) {
  const exponent = Math.min(Math.max(attemptCount - 1, 0), 8);
  const base = Math.min(300_000, 1_000 * 2 ** exponent);
  let hash = 0;
  for (const character of eventId)
    hash = (hash * 31 + character.charCodeAt(0)) | 0;
  return base + (Math.abs(hash) % Math.max(1, Math.floor(base / 4)));
}

export async function publishRoomUpdateBatch(
  store: PostgresRoomStore,
  transport: RoomUpdateTransport,
  options: {
    leaseOwner: string;
    limit?: number;
    leaseMs?: number;
    maxAttempts?: number;
    now?: Date;
  },
): Promise<PublishBatchResult> {
  const now = options.now ?? new Date();
  const claimed = await store.claimRoomUpdates(options.leaseOwner, {
    ...(options.limit === undefined ? {} : { limit: options.limit }),
    ...(options.leaseMs === undefined ? {} : { leaseMs: options.leaseMs }),
    now,
  });
  const result: PublishBatchResult = {
    claimed: claimed.length,
    published: 0,
    retried: 0,
    poisoned: 0,
    lostLease: 0,
  };

  for (const delivery of claimed) {
    try {
      await transport.publish(delivery.event);
      if (
        await store.markRoomUpdatePublished(
          delivery.event.eventId,
          options.leaseOwner,
          now,
        )
      ) {
        result.published += 1;
      } else {
        result.lostLease += 1;
      }
    } catch {
      const retryAt = new Date(
        now.getTime() +
          outboxRetryDelayMs(delivery.attemptCount, delivery.event.eventId),
      );
      const outcome = await store.markRoomUpdateFailed(
        delivery.event.eventId,
        options.leaseOwner,
        "transport-failed",
        {
          retryAt,
          ...(options.maxAttempts === undefined
            ? {}
            : { maxAttempts: options.maxAttempts }),
          now,
        },
      );
      if (outcome === "retry") result.retried += 1;
      else if (outcome === "poison") result.poisoned += 1;
      else result.lostLease += 1;
    }
  }
  return result;
}
