import type { NextRequest } from "next/server";
import { handleRoomJoin } from "../_server/room-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return handleRoomJoin(request);
}
