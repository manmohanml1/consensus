import type { NextRequest } from "next/server";
import { handleRedeemHostRecovery } from "../../../_server/room-api";
import { scheduleRoomUpdatePublish } from "../../../_server/room-event-delivery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await context.params;
  const response = await handleRedeemHostRecovery(request, roomId);
  if (response.status === 200) scheduleRoomUpdatePublish();
  return response;
}
