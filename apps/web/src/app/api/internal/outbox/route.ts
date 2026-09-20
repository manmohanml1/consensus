import { PostgresRoomStore } from "@consensus/persistence";
import {
  publishEnabledRoomUpdates,
  roomEventsEnabled,
} from "../../v1/rooms/_server/room-event-delivery";
import { handleOutboxWorker } from "./outbox-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function run(request: Request): Promise<Response> {
  return handleOutboxWorker(
    request,
    process.env.CONSENSUS_OUTBOX_WORKER_SECRET,
    {
      isEnabled: roomEventsEnabled,
      publish: publishEnabledRoomUpdates,
      health: async () => {
        const connectionString = process.env.CONSENSUS_DATABASE_URL;
        if (!connectionString) throw new Error("Store unavailable.");
        const store = PostgresRoomStore.fromConnectionString(connectionString);
        try {
          return await store.getOutboxHealth();
        } finally {
          await store.close();
        }
      },
    },
  );
}

export const GET = run;
export const POST = run;
