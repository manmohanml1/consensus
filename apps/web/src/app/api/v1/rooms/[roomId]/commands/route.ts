import type { NextRequest } from "next/server";
import { handleCommand } from "../../_server/room-api";
import { scheduleRoomUpdatePublish } from "../../_server/room-event-delivery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await context.params;
  const startedAt = performance.now();
  const response = await handleCommand(request, roomId);
  console.info("consensus.room.command.ack", {
    status: response.status,
    latencyMs: Math.round(performance.now() - startedAt),
  });
  if (response.status === 201) scheduleRoomUpdatePublish();
  return response;
}
