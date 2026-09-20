import type { NextRequest } from "next/server";
import { handleRoomJoin } from "../_server/room-api";
import { scheduleRoomUpdatePublish } from "../_server/room-event-delivery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const response = await handleRoomJoin(request);
  if (response.status === 202) scheduleRoomUpdatePublish();
  return response;
}
