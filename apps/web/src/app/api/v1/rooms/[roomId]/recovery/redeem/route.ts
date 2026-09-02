import type { NextRequest } from "next/server";
import { handleRedeemHostRecovery } from "../../../_server/room-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await context.params;
  return handleRedeemHostRecovery(request, roomId);
}
