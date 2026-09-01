import { randomUUID } from "node:crypto";
import {
  ROOM_PROTOCOL_LIMITS,
  ROOM_PROTOCOL_VERSION,
  createRoomProtocolError,
  parseRoomCommand,
  type RoomProtocolErrorCode,
} from "@consensus/domain";
import { PostgresRoomStore, RoomStoreError } from "@consensus/persistence";
import {
  CAPABILITY_COOKIE_NAME,
  parseCapabilityPepper,
} from "@consensus/security";
import type { NextRequest } from "next/server";

const noStoreHeaders = {
  "Cache-Control": "no-store, max-age=0",
  "Content-Type": "application/json",
} as const;

let store: PostgresRoomStore | undefined;

function correlationId(): string {
  return `correlation_${randomUUID().replaceAll("-", "")}`;
}

function errorStatus(code: RoomProtocolErrorCode): number {
  if (code === "unauthorized-or-missing") return 404;
  if (code === "rate-limited") return 429;
  if (code === "temporarily-unavailable") return 503;
  if (
    code === "stale-revision" ||
    code === "sequence-conflict" ||
    code === "room-locked" ||
    code === "room-expired" ||
    code === "command-conflict"
  ) {
    return 409;
  }
  return 400;
}

export function protocolErrorResponse(
  code: RoomProtocolErrorCode,
  currentRevision?: number,
): Response {
  const body = createRoomProtocolError(code, correlationId(), {
    ...(currentRevision === undefined ? {} : { currentRevision }),
  });
  return new Response(JSON.stringify(body), {
    status: errorStatus(code),
    headers: noStoreHeaders,
  });
}

function configuredStore(): {
  store: PostgresRoomStore;
  pepper: Uint8Array;
} | null {
  const connectionString = process.env.CONSENSUS_DATABASE_URL;
  if (!connectionString) return null;
  try {
    const pepper = parseCapabilityPepper(
      process.env.CONSENSUS_CAPABILITY_PEPPER,
    );
    store ??= PostgresRoomStore.fromConnectionString(connectionString);
    return { store, pepper };
  } catch {
    return null;
  }
}

export async function handleProjection(
  request: NextRequest,
  roomId: string,
): Promise<Response> {
  const configured = configuredStore();
  if (!configured) return protocolErrorResponse("temporarily-unavailable");
  try {
    const projection = await configured.store.getProjection(
      roomId,
      request.cookies.get(CAPABILITY_COOKIE_NAME)?.value,
      configured.pepper,
    );
    return new Response(JSON.stringify(projection), {
      status: 200,
      headers: noStoreHeaders,
    });
  } catch (error) {
    if (error instanceof RoomStoreError) {
      return protocolErrorResponse(error.code, error.currentRevision);
    }
    return protocolErrorResponse("temporarily-unavailable");
  }
}

export async function handleCommand(
  request: NextRequest,
  roomId: string,
): Promise<Response> {
  const requestOrigin = request.headers.get("origin");
  if (!requestOrigin || requestOrigin !== new URL(request.url).origin) {
    return protocolErrorResponse("unauthorized-or-missing");
  }
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return protocolErrorResponse("invalid-request");
  }
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (
    !Number.isFinite(contentLength) ||
    contentLength > ROOM_PROTOCOL_LIMITS.maxSerializedBytes
  ) {
    return protocolErrorResponse("invalid-request");
  }
  let value: unknown;
  try {
    const text = await request.text();
    if (
      new TextEncoder().encode(text).byteLength >
      ROOM_PROTOCOL_LIMITS.maxSerializedBytes
    ) {
      return protocolErrorResponse("invalid-request");
    }
    value = JSON.parse(text) as unknown;
  } catch {
    return protocolErrorResponse("invalid-request");
  }
  const parsed = parseRoomCommand(value);
  if (!parsed.success || parsed.data.roomId !== roomId) {
    const unsupported =
      typeof value === "object" &&
      value !== null &&
      "protocolVersion" in value &&
      value.protocolVersion !== ROOM_PROTOCOL_VERSION;
    return protocolErrorResponse(
      unsupported ? "unsupported-version" : "invalid-request",
    );
  }
  const configured = configuredStore();
  if (!configured) return protocolErrorResponse("temporarily-unavailable");
  try {
    const result = await configured.store.executeCommand(
      parsed.data,
      request.cookies.get(CAPABILITY_COOKIE_NAME)?.value,
      configured.pepper,
    );
    return new Response(JSON.stringify(result.projection), {
      status: result.replayed ? 200 : 201,
      headers: {
        ...noStoreHeaders,
        "Idempotency-Replayed": result.replayed ? "true" : "false",
      },
    });
  } catch (error) {
    if (error instanceof RoomStoreError) {
      return protocolErrorResponse(error.code, error.currentRevision);
    }
    return protocolErrorResponse("temporarily-unavailable");
  }
}
