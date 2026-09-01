import type { NextRequest } from "next/server";
import { handleProjection } from "../../_server/room-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await context.params;
  return handleProjection(request, roomId);
}
