import type { NextRequest } from "next/server";
import { handleRoomCreation } from "./_server/room-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return handleRoomCreation(request);
}
