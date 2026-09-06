import { timingSafeEqual } from "node:crypto";

export const RETENTION_BATCH_LIMIT = 100;

export interface RetentionDependencies {
  isEnabled: () => boolean;
  deleteDue: (limit: number, now: Date) => Promise<{ deleted: number }>;
  now?: () => Date;
}

const noStoreHeaders = {
  "Cache-Control": "no-store, max-age=0",
  "Content-Type": "application/json",
} as const;

function response(
  status: number,
  body: Record<string, number | string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: noStoreHeaders,
  });
}

export function hasValidCronAuthorization(
  request: Request,
  cronSecret: string | undefined,
): boolean {
  if (!cronSecret) return false;
  const authorization = request.headers.get("authorization");
  const expected = `Bearer ${cronSecret}`;
  if (!authorization || authorization.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(authorization), Buffer.from(expected));
}

export async function handleRetentionCron(
  request: Request,
  cronSecret: string | undefined,
  dependencies: RetentionDependencies,
): Promise<Response> {
  if (!hasValidCronAuthorization(request, cronSecret)) {
    return response(401, { error: "unauthorized" });
  }
  if (!dependencies.isEnabled()) {
    return response(503, { error: "temporarily-unavailable" });
  }

  try {
    const result = await dependencies.deleteDue(
      RETENTION_BATCH_LIMIT,
      dependencies.now?.() ?? new Date(),
    );
    return response(200, { status: "completed", deleted: result.deleted });
  } catch {
    return response(503, { error: "temporarily-unavailable" });
  }
}
