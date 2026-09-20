import type { OutboxHealth, PublishBatchResult } from "@consensus/persistence";
import { hasValidCronAuthorization } from "../retention/retention-handler";

export interface OutboxDependencies {
  isEnabled: () => boolean;
  publish: () => Promise<PublishBatchResult | null>;
  health: () => Promise<OutboxHealth>;
}

const headers = {
  "Cache-Control": "no-store, max-age=0",
  "Content-Type": "application/json",
} as const;

export async function handleOutboxWorker(
  request: Request,
  secret: string | undefined,
  dependencies: OutboxDependencies,
): Promise<Response> {
  if (!hasValidCronAuthorization(request, secret)) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers });
  }
  if (!dependencies.isEnabled()) {
    return Response.json(
      { error: "temporarily-unavailable" },
      { status: 503, headers },
    );
  }
  try {
    if (request.method === "GET") {
      const health = await dependencies.health();
      const oldestReadyAgeMs = health.oldestReadyAt
        ? Math.max(0, Date.now() - Date.parse(health.oldestReadyAt))
        : null;
      return Response.json(
        {
          ...health,
          oldestReadyAgeMs,
          status:
            health.poisoned > 0 ||
            (oldestReadyAgeMs !== null && oldestReadyAgeMs > 30_000)
              ? "degraded"
              : "healthy",
        },
        { headers },
      );
    }
    if (request.method === "POST") {
      const result = await dependencies.publish();
      return result
        ? Response.json(result, { headers })
        : Response.json(
            { error: "temporarily-unavailable" },
            { status: 503, headers },
          );
    }
    return Response.json(
      { error: "method-not-allowed" },
      { status: 405, headers },
    );
  } catch {
    return Response.json(
      { error: "temporarily-unavailable" },
      { status: 503, headers },
    );
  }
}
