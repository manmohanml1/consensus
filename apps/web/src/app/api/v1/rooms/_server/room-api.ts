import { createHmac, randomUUID } from "node:crypto";
import {
  ROOM_PROTOCOL_LIMITS,
  ROOM_PROTOCOL_VERSION,
  createRoomProtocolError,
  parseCreateHostRecoveryRequest,
  parseCreateRoomRequest,
  parseJoinRoomRequest,
  parseRedeemHostRecoveryRequest,
  parseRoomCommand,
  type RoomProtocolErrorCode,
} from "@consensus/domain";
import { PostgresRoomStore, RoomStoreError } from "@consensus/persistence";
import {
  CAPABILITY_MAX_TTL_MS,
  CAPABILITY_COOKIE_NAME,
  fingerprintRoomLocator,
  issueCapability,
  issueHostRecoveryCode,
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
const JOIN_MAX_ATTEMPTS = 20;
const RECOVERY_MAX_ATTEMPTS = 10;
const MAX_CREATE_BUCKETS = 1_000;
const ROOM_ACTIVE_TTL_MS = 2 * 60 * 60 * 1_000;
const ROOM_DELETION_GRACE_MS = 7 * 24 * 60 * 60 * 1_000;
const roomIdPattern = /^[A-Za-z0-9_-]{8,64}$/;

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

function enabled(
  name:
    | "CONSENSUS_ROOM_CREATION_ENABLED"
    | "CONSENSUS_ROOM_JOIN_ENABLED"
    | "CONSENSUS_HOST_RECOVERY_ENABLED",
): boolean {
  return process.env[name] !== "false";
}

function mayRecover(
  request: NextRequest,
  roomId: string,
  pepper: Uint8Array,
): boolean {
  const source =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const bucketKey = createHmac("sha256", pepper)
    .update("consensus:host-recovery-rate-limit:v1\0")
    .update(source)
    .update("\0")
    .update(roomId)
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
  if (current.count >= RECOVERY_MAX_ATTEMPTS) return false;
  current.count += 1;
  return true;
}

function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  return origin !== null && origin === new URL(request.url).origin;
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
  if (!sameOrigin(request)) {
    return protocolErrorResponse("unauthorized-or-missing");
  }
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
  const expiresAt = new Date(now.getTime() + ROOM_ACTIVE_TTL_MS);
  const capabilityExpiresAt = new Date(now.getTime() + CAPABILITY_MAX_TTL_MS);
  const roomId = `room_${randomUUID().replaceAll("-", "")}`;
  const memberId = `member_${randomUUID().replaceAll("-", "")}`;
  const capability = issueCapability(
    { roomId, memberId, role: "host" },
    capabilityExpiresAt,
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
      capabilityExpiresAt,
      expiresAt,
      deletionDueAt: new Date(expiresAt.getTime() + ROOM_DELETION_GRACE_MS),
      candidates: parsed.data.candidateNames?.map((name) => ({
        id: `candidate_${randomUUID().replaceAll("-", "")}`,
        name,
      })),
    });
    const token = capability.takeToken();
    return new Response(
      JSON.stringify({
        room: projection,
        actor: {
          memberId,
          role: "host",
          nextSequence: 1,
        },
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
            capabilityExpiresAt,
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

export async function handleRoomJoin(request: NextRequest): Promise<Response> {
  if (!sameOrigin(request)) {
    return protocolErrorResponse("unauthorized-or-missing");
  }
  if (!enabled("CONSENSUS_ROOM_JOIN_ENABLED")) {
    return protocolErrorResponse("temporarily-unavailable");
  }
  const value = await readJson(request);
  const parsed =
    value === null ? { success: false as const } : parseJoinRoomRequest(value);
  if (!parsed.success) return protocolErrorResponse("unauthorized-or-missing");
  const configured = configuredStore();
  if (!configured) return protocolErrorResponse("temporarily-unavailable");

  const source =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const locatorHash = fingerprintRoomLocator(
    parsed.data.locator,
    configured.pepper,
  );
  const joinBucket = createHmac("sha256", configured.pepper)
    .update("consensus:join-rate-limit:v1\0")
    .update(source)
    .update(locatorHash)
    .digest("base64url");
  const nowMs = Date.now();
  const current = attempts.get(joinBucket);
  if (
    current &&
    nowMs - current.startedAt < CREATE_WINDOW_MS &&
    current.count >= JOIN_MAX_ATTEMPTS
  ) {
    return protocolErrorResponse("rate-limited");
  }
  if (!current || nowMs - current.startedAt >= CREATE_WINDOW_MS) {
    if (!current && attempts.size >= MAX_CREATE_BUCKETS) {
      const oldest = attempts.keys().next().value;
      if (oldest) attempts.delete(oldest);
    }
    attempts.set(joinBucket, { startedAt: nowMs, count: 1 });
  } else {
    current.count += 1;
  }

  const now = new Date();
  const capabilityExpiresAt = new Date(now.getTime() + CAPABILITY_MAX_TTL_MS);
  const memberId = `member_${randomUUID().replaceAll("-", "")}`;
  try {
    const roomId = await configured.store.locateJoinableRoom(locatorHash);
    const capability = issueCapability(
      { roomId, memberId, role: "participant" },
      capabilityExpiresAt,
      configured.pepper,
      now,
    );
    const result = await configured.store.joinRoom({
      roomId,
      memberId,
      displayName: parsed.data.displayName,
      inviteCodeHash: locatorHash,
      capabilityHash: capability.hash,
      capabilityExpiresAt,
    });
    return new Response(
      JSON.stringify({
        room: result.projection,
        actor: {
          memberId,
          role: "participant",
          nextSequence: 1,
        },
      }),
      {
        status: 202,
        headers: {
          ...noStoreHeaders,
          "Set-Cookie": serializeCapabilityCookie(
            capability.takeToken(),
            result.roomId,
            capabilityExpiresAt,
            now,
          ),
        },
      },
    );
  } catch (error) {
    if (error instanceof RoomStoreError) {
      return protocolErrorResponse("unauthorized-or-missing");
    }
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
    const state = await configured.store.getAuthorizedProjection(
      roomId,
      request.cookies.get(CAPABILITY_COOKIE_NAME)?.value,
      configured.pepper,
    );
    return new Response(
      JSON.stringify({ room: state.projection, actor: state.actor }),
      {
        status: 200,
        headers: noStoreHeaders,
      },
    );
  } catch (error) {
    if (error instanceof RoomStoreError) {
      return protocolErrorResponse(error.code, error.currentRevision);
    }
    return protocolErrorResponse("temporarily-unavailable");
  }
}

export async function handleCreateHostRecovery(
  request: NextRequest,
  roomId: string,
): Promise<Response> {
  if (!roomIdPattern.test(roomId)) {
    return protocolErrorResponse("unauthorized-or-missing");
  }
  if (!sameOrigin(request)) {
    return protocolErrorResponse("unauthorized-or-missing");
  }
  if (!enabled("CONSENSUS_HOST_RECOVERY_ENABLED")) {
    return protocolErrorResponse("temporarily-unavailable");
  }
  const value = await readJson(request);
  const parsed =
    value === null
      ? { success: false as const }
      : parseCreateHostRecoveryRequest(value);
  if (!parsed.success) return protocolErrorResponse("invalid-request");
  const configured = configuredStore();
  if (!configured) return protocolErrorResponse("temporarily-unavailable");

  const now = new Date();
  const recovery = issueHostRecoveryCode(configured.pepper, now);
  try {
    await configured.store.createHostRecoveryChallenge(
      roomId,
      request.cookies.get(CAPABILITY_COOKIE_NAME)?.value,
      configured.pepper,
      recovery.hash,
      recovery.expiresAt,
      now,
    );
    return new Response(
      JSON.stringify({
        protocolVersion: ROOM_PROTOCOL_VERSION,
        recoveryCode: recovery.takeCode(),
        expiresAt: recovery.expiresAt.toISOString(),
      }),
      { status: 201, headers: noStoreHeaders },
    );
  } catch (error) {
    if (error instanceof RoomStoreError) {
      return protocolErrorResponse(error.code);
    }
    return protocolErrorResponse("temporarily-unavailable");
  }
}

export async function handleRedeemHostRecovery(
  request: NextRequest,
  roomId: string,
): Promise<Response> {
  if (!roomIdPattern.test(roomId)) {
    return protocolErrorResponse("unauthorized-or-missing");
  }
  if (!sameOrigin(request)) {
    return protocolErrorResponse("unauthorized-or-missing");
  }
  if (!enabled("CONSENSUS_HOST_RECOVERY_ENABLED")) {
    return protocolErrorResponse("temporarily-unavailable");
  }
  const configured = configuredStore();
  if (!configured) return protocolErrorResponse("temporarily-unavailable");
  if (!mayRecover(request, roomId, configured.pepper)) {
    return protocolErrorResponse("rate-limited");
  }
  const value = await readJson(request);
  const parsed =
    value === null
      ? { success: false as const }
      : parseRedeemHostRecoveryRequest(value);
  if (!parsed.success) {
    return protocolErrorResponse("unauthorized-or-missing");
  }

  const now = new Date();
  try {
    const result = await configured.store.recoverHost(
      roomId,
      parsed.data.recoveryCode,
      configured.pepper,
      now,
    );
    const { capability, projection, actor } = result;
    return new Response(JSON.stringify({ room: projection, actor }), {
      status: 200,
      headers: {
        ...noStoreHeaders,
        "Set-Cookie": serializeCapabilityCookie(
          capability.takeToken(),
          roomId,
          capability.expiresAt,
          now,
        ),
      },
    });
  } catch (error) {
    if (error instanceof RoomStoreError) {
      return protocolErrorResponse("unauthorized-or-missing");
    }
    return protocolErrorResponse("temporarily-unavailable");
  }
}

export async function handleCommand(
  request: NextRequest,
  roomId: string,
): Promise<Response> {
  if (!sameOrigin(request)) {
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
    return new Response(
      JSON.stringify({ room: result.projection, actor: result.actor }),
      {
        status: result.replayed ? 200 : 201,
        headers: {
          ...noStoreHeaders,
          "Idempotency-Replayed": result.replayed ? "true" : "false",
        },
      },
    );
  } catch (error) {
    if (error instanceof RoomStoreError) {
      return protocolErrorResponse(error.code, error.currentRevision);
    }
    return protocolErrorResponse("temporarily-unavailable");
  }
}
