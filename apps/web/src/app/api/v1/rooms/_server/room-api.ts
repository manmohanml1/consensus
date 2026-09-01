import { createHmac, randomUUID } from "node:crypto";
import {
  ROOM_PROTOCOL_LIMITS,
  ROOM_PROTOCOL_VERSION,
  createRoomProtocolError,
  parseCreateRoomRequest,
  parseRoomCommand,
  type RoomProtocolErrorCode,
} from "@consensus/domain";
import { PostgresRoomStore, RoomStoreError } from "@consensus/persistence";
import {
  CAPABILITY_COOKIE_NAME,
  issueCapability,
  issueRoomLocator,
  parseCapabilityPepper,
  serializeCapabilityCookie,
} from "@consensus/security";
import type { NextRequest } from "next/server";

const noStoreHeaders = {
  "Cache-Control": "no-store, max-age=0",
  "Content-Type": "application/json",
} as const;

let store: PostgresRoomStore | undefined;
const attempts = new Map<string, { startedAt: number; count: number }>();
const CREATE_WINDOW_MS = 10 * 60 * 1_000;
const CREATE_MAX_ATTEMPTS = 5;
const MAX_CREATE_BUCKETS = 1_000;

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

function enabled(name: "CONSENSUS_ROOM_CREATION_ENABLED"): boolean {
  return process.env[name] !== "false";
}

/** Per-instance privacy-preserving circuit breaker; durable/global limits are CQ-507 work. */
function mayCreate(request: NextRequest, pepper: Uint8Array): boolean {
  const forwarded = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  const origin = forwarded || request.headers.get("x-real-ip") || "unknown";
  // Do not retain a raw address. The process only keeps a keyed bucket digest.
  const bucketKey = createHmac("sha256", pepper)
    .update("consensus:create-rate-limit:v1\0")
    .update(origin)
    .digest("base64url");
  const now = Date.now();
  const current = attempts.get(bucketKey);
  if (!current || now - current.startedAt >= CREATE_WINDOW_MS) {
    if (!current && attempts.size >= MAX_CREATE_BUCKETS) {
      const oldest = attempts.keys().next().value;
      if (oldest) attempts.delete(oldest);
    }
    attempts.set(bucketKey, { startedAt: now, count: 1 });
    return true;
  }
  if (current.count >= CREATE_MAX_ATTEMPTS) return false;
  current.count += 1;
  return true;
}

async function readJson(request: NextRequest): Promise<unknown | null> {
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return null;
  }
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (
    !Number.isFinite(contentLength) ||
    contentLength > ROOM_PROTOCOL_LIMITS.maxSerializedBytes
  ) {
    return null;
  }
  try {
    const text = await request.text();
    if (
      new TextEncoder().encode(text).byteLength >
      ROOM_PROTOCOL_LIMITS.maxSerializedBytes
    )
      return null;
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export async function handleRoomCreation(
  request: NextRequest,
): Promise<Response> {
  if (!enabled("CONSENSUS_ROOM_CREATION_ENABLED")) {
    return protocolErrorResponse("temporarily-unavailable");
  }
  const value = await readJson(request);
  const parsed =
    value === null
      ? { success: false as const }
      : parseCreateRoomRequest(value);
  if (!parsed.success) {
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
  if (!mayCreate(request, configured.pepper))
    return protocolErrorResponse("rate-limited");

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 2 * 60 * 60 * 1_000);
  const roomId = `room_${randomUUID().replaceAll("-", "")}`;
  const memberId = `member_${randomUUID().replaceAll("-", "")}`;
  const capability = issueCapability(
    { roomId, memberId, role: "host" },
    expiresAt,
    configured.pepper,
    now,
  );
  const locator = issueRoomLocator(configured.pepper);
  try {
    const projection = await configured.store.createRoom({
      roomId,
      hostMemberId: memberId,
      title: parsed.data.title,
      hostDisplayName: parsed.data.hostDisplayName,
      targetAt: parsed.data.targetAt,
      inviteCodeHash: locator.hash,
      hostCapabilityHash: capability.hash,
      capabilityExpiresAt: expiresAt,
      expiresAt,
      deletionDueAt: new Date(expiresAt.getTime() + 7 * 24 * 60 * 60 * 1_000),
    });
    const token = capability.takeToken();
    return new Response(
      JSON.stringify({
        room: projection,
        invitation: {
          locator: locator.locator,
          expiresAt: expiresAt.toISOString(),
        },
      }),
      {
        status: 201,
        headers: {
          ...noStoreHeaders,
          "Set-Cookie": serializeCapabilityCookie(
            token,
            roomId,
            expiresAt,
            now,
          ),
        },
      },
    );
  } catch (error) {
    if (error instanceof RoomStoreError)
      return protocolErrorResponse(error.code);
    return protocolErrorResponse("temporarily-unavailable");
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
