import { PostgresRoomStore } from "@consensus/persistence";
import {
  handleRetentionCron,
  type RetentionDependencies,
} from "./retention-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let store: PostgresRoomStore | undefined;

function configuredDependencies(): RetentionDependencies | null {
  const connectionString = process.env.CONSENSUS_DATABASE_URL;
  if (!connectionString) return null;
  store ??= PostgresRoomStore.fromConnectionString(connectionString);
  return {
    isEnabled: () => process.env.CONSENSUS_RETENTION_DELETE_ENABLED === "true",
    deleteDue: (limit, now) => store!.deleteRoomsDueForDeletion(limit, now),
    onCompleted: (deleted) => {
      console.info("consensus.retention.sweep.completed", { deleted });
    },
  };
}

export async function GET(request: Request): Promise<Response> {
  const dependencies = configuredDependencies();
  if (!dependencies) {
    return new Response(JSON.stringify({ error: "temporarily-unavailable" }), {
      status: 503,
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "Content-Type": "application/json",
      },
    });
  }
  return handleRetentionCron(request, process.env.CRON_SECRET, dependencies);
}
