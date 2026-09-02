import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { inspect } from "node:util";

export const CAPABILITY_VERSION = "c1" as const;
export const CAPABILITY_RANDOM_BYTES = 32;
export const CAPABILITY_HASH_BYTES = 32;
export const CAPABILITY_MAX_TTL_MS = 24 * 60 * 60 * 1_000;
export const CAPABILITY_COOKIE_NAME = "__Secure-consensus_room";
export const ROOM_LOCATOR_VERSION = "r1" as const;
export const ROOM_LOCATOR_RANDOM_BYTES = 16;
export const HOST_RECOVERY_VERSION = "hr1" as const;
export const HOST_RECOVERY_RANDOM_BYTES = 24;
export const HOST_RECOVERY_TTL_MS = 10 * 60 * 1_000;

const capabilityPattern = /^c1\.[A-Za-z0-9_-]{43}$/;
const identifierPattern = /^[A-Za-z0-9_-]{8,64}$/;
const domainSeparator = "consensus:room-capability:v1\0";
const locatorDomainSeparator = "consensus:room-locator:v1\0";
const locatorPattern = /^r1\.[A-Za-z0-9_-]{22}$/;
const recoveryDomainSeparator = "consensus:host-recovery:v1\0";
const recoveryPattern = /^hr1\.[A-Za-z0-9_-]{32}$/;
const dummyCapability = "invalid-capability";
const redacted = "[REDACTED]";

export type CapabilityRole = "host" | "participant";

export interface CapabilityScope {
  roomId: string;
  memberId: string;
  role: CapabilityRole;
}

export interface StoredCapability extends CapabilityScope {
  hash: Uint8Array;
  expiresAt: Date;
  status: "pending" | "active" | "left";
}

export interface CapabilityExpectation {
  roomId: string;
  memberId?: string;
  role?: CapabilityRole;
  allowPending?: boolean;
}

export class IssuedCapability {
  readonly scope: Readonly<CapabilityScope>;
  #hash: Uint8Array;
  #expiresAtMs: number;
  #token: string | null;

  constructor(
    token: string,
    hash: Uint8Array,
    scope: CapabilityScope,
    expiresAt: Date,
  ) {
    this.#token = token;
    this.#hash = Uint8Array.from(hash);
    this.scope = Object.freeze({ ...scope });
    this.#expiresAtMs = expiresAt.getTime();
  }

  get hash(): Uint8Array {
    return Uint8Array.from(this.#hash);
  }

  get expiresAt(): Date {
    return new Date(this.#expiresAtMs);
  }

  takeToken(): string {
    if (this.#token === null) {
      throw new Error("Capability token has already been consumed.");
    }
    const token = this.#token;
    this.#token = null;
    return token;
  }

  toJSON() {
    return { token: redacted };
  }

  toString() {
    return redacted;
  }

  [inspect.custom]() {
    return this.toJSON();
  }
}

export class IssuedHostRecoveryCode {
  #code: string | null;
  #hash: Uint8Array;
  #expiresAtMs: number;

  constructor(code: string, hash: Uint8Array, expiresAt: Date) {
    this.#code = code;
    this.#hash = Uint8Array.from(hash);
    this.#expiresAtMs = expiresAt.getTime();
  }

  get hash(): Uint8Array {
    return Uint8Array.from(this.#hash);
  }

  get expiresAt(): Date {
    return new Date(this.#expiresAtMs);
  }

  takeCode(): string {
    if (this.#code === null) {
      throw new Error("Host recovery code has already been consumed.");
    }
    const code = this.#code;
    this.#code = null;
    return code;
  }

  toJSON() {
    return { code: redacted };
  }

  toString() {
    return redacted;
  }

  [inspect.custom]() {
    return this.toJSON();
  }
}

export function parseCapabilityPepper(value: string | undefined): Uint8Array {
  if (!value || !/^[A-Za-z0-9_-]{43}$/.test(value)) {
    throw new Error("Capability pepper configuration is invalid.");
  }
  const pepper = Buffer.from(value, "base64url");
  if (pepper.byteLength !== CAPABILITY_RANDOM_BYTES) {
    throw new Error("Capability pepper configuration is invalid.");
  }
  return Uint8Array.from(pepper);
}

export function fingerprintCapability(
  token: string,
  pepper: Uint8Array,
): Uint8Array {
  if (!capabilityPattern.test(token)) {
    throw new Error("Capability token is invalid.");
  }
  assertPepper(pepper);
  return fingerprintUntrusted(token, pepper);
}

/**
 * Creates a random, shareable room locator. It is deliberately distinct from
 * a capability: persistence receives only this keyed fingerprint, and knowing
 * the locator never authenticates a caller.
 */
export function issueRoomLocator(pepper: Uint8Array): {
  locator: string;
  hash: Uint8Array;
} {
  assertPepper(pepper);
  const locator = `${ROOM_LOCATOR_VERSION}.${randomBytes(ROOM_LOCATOR_RANDOM_BYTES).toString("base64url")}`;
  return { locator, hash: fingerprintRoomLocator(locator, pepper) };
}

export function fingerprintRoomLocator(
  locator: string,
  pepper: Uint8Array,
): Uint8Array {
  if (!locatorPattern.test(locator)) {
    throw new Error("Room locator is invalid.");
  }
  assertPepper(pepper);
  return Uint8Array.from(
    createHmac("sha256", pepper)
      .update(locatorDomainSeparator)
      .update(locator)
      .digest(),
  );
}

export function issueHostRecoveryCode(
  pepper: Uint8Array,
  now = new Date(),
): IssuedHostRecoveryCode {
  assertPepper(pepper);
  const code = `${HOST_RECOVERY_VERSION}.${randomBytes(HOST_RECOVERY_RANDOM_BYTES).toString("base64url")}`;
  const expiresAt = new Date(now.getTime() + HOST_RECOVERY_TTL_MS);
  return new IssuedHostRecoveryCode(
    code,
    fingerprintHostRecoveryCode(code, pepper),
    expiresAt,
  );
}

export function fingerprintHostRecoveryCode(
  code: string,
  pepper: Uint8Array,
): Uint8Array {
  if (!recoveryPattern.test(code)) {
    throw new Error("Host recovery code is invalid.");
  }
  assertPepper(pepper);
  return fingerprintRecoveryCandidate(code, pepper);
}

export function authorizeHostRecoveryCode(
  code: unknown,
  pepper: Uint8Array,
  storedHash: Uint8Array | null,
  expiresAt: Date | null,
  now = new Date(),
): boolean {
  assertPepper(pepper);
  const candidate =
    typeof code === "string" && recoveryPattern.test(code)
      ? code
      : "invalid-recovery-code";
  const candidateHash = Buffer.from(
    fingerprintRecoveryCandidate(candidate, pepper),
  );
  const expectedHash =
    storedHash?.byteLength === CAPABILITY_HASH_BYTES
      ? Buffer.from(storedHash)
      : Buffer.alloc(CAPABILITY_HASH_BYTES);
  const matches = timingSafeEqual(candidateHash, expectedHash);
  return Boolean(matches && expiresAt && expiresAt.getTime() > now.getTime());
}

export function issueCapability(
  scope: CapabilityScope,
  expiresAt: Date,
  pepper: Uint8Array,
  now = new Date(),
): IssuedCapability {
  assertScope(scope);
  assertPepper(pepper);
  assertExpiry(expiresAt, now);

  const token = `${CAPABILITY_VERSION}.${randomBytes(CAPABILITY_RANDOM_BYTES).toString("base64url")}`;
  return new IssuedCapability(
    token,
    fingerprintUntrusted(token, pepper),
    scope,
    expiresAt,
  );
}

export function authorizeCapability(
  token: unknown,
  pepper: Uint8Array,
  stored: StoredCapability | null,
  expected: CapabilityExpectation,
  now = new Date(),
): CapabilityScope | null {
  assertPepper(pepper);
  assertExpectation(expected);

  const candidateToken =
    typeof token === "string" &&
    token.length === CAPABILITY_VERSION.length + 1 + 43 &&
    capabilityPattern.test(token)
      ? token
      : dummyCapability;
  const candidateHash = Buffer.from(
    fingerprintUntrusted(candidateToken, pepper),
  );
  const storedHash =
    stored?.hash.byteLength === CAPABILITY_HASH_BYTES
      ? Buffer.from(stored.hash)
      : Buffer.alloc(CAPABILITY_HASH_BYTES);
  const hashMatches = timingSafeEqual(candidateHash, storedHash);

  const scopeMatches = Boolean(
    stored &&
    stored.roomId === expected.roomId &&
    (expected.memberId === undefined ||
      stored.memberId === expected.memberId) &&
    (expected.role === undefined || stored.role === expected.role),
  );
  const active = Boolean(
    stored &&
    (stored.status === "active" ||
      (expected.allowPending === true && stored.status === "pending")) &&
    stored.expiresAt.getTime() > now.getTime(),
  );

  if (!stored || !hashMatches || !scopeMatches || !active) return null;
  return {
    roomId: stored.roomId,
    memberId: stored.memberId,
    role: stored.role,
  };
}

export function serializeCapabilityCookie(
  token: string,
  roomId: string,
  expiresAt: Date,
  now = new Date(),
): string {
  if (!capabilityPattern.test(token)) {
    throw new Error("Capability token is invalid.");
  }
  assertIdentifier(roomId, "room");
  assertExpiry(expiresAt, now);
  const maxAge = Math.max(
    1,
    Math.floor((expiresAt.getTime() - now.getTime()) / 1_000),
  );
  return [
    `${CAPABILITY_COOKIE_NAME}=${token}`,
    `Path=/api/v1/rooms/${encodeURIComponent(roomId)}`,
    `Max-Age=${maxAge}`,
    `Expires=${expiresAt.toUTCString()}`,
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
  ].join("; ");
}

export function serializeClearedCapabilityCookie(roomId: string): string {
  assertIdentifier(roomId, "room");
  return [
    `${CAPABILITY_COOKIE_NAME}=`,
    `Path=/api/v1/rooms/${encodeURIComponent(roomId)}`,
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
  ].join("; ");
}

function fingerprintUntrusted(token: string, pepper: Uint8Array): Uint8Array {
  return Uint8Array.from(
    createHmac("sha256", pepper).update(domainSeparator).update(token).digest(),
  );
}

function fingerprintRecoveryCandidate(
  code: string,
  pepper: Uint8Array,
): Uint8Array {
  return Uint8Array.from(
    createHmac("sha256", pepper)
      .update(recoveryDomainSeparator)
      .update(code)
      .digest(),
  );
}

function assertPepper(pepper: Uint8Array) {
  if (pepper.byteLength !== CAPABILITY_RANDOM_BYTES) {
    throw new Error("Capability pepper configuration is invalid.");
  }
}

function assertScope(scope: CapabilityScope) {
  assertIdentifier(scope.roomId, "room");
  assertIdentifier(scope.memberId, "member");
  if (scope.role !== "host" && scope.role !== "participant") {
    throw new Error("Capability scope is invalid.");
  }
}

function assertExpectation(expected: CapabilityExpectation) {
  assertIdentifier(expected.roomId, "room");
  if (expected.memberId !== undefined) {
    assertIdentifier(expected.memberId, "member");
  }
  if (
    expected.role !== undefined &&
    expected.role !== "host" &&
    expected.role !== "participant"
  ) {
    throw new Error("Capability expectation is invalid.");
  }
}

function assertIdentifier(value: string, kind: "room" | "member") {
  if (!identifierPattern.test(value)) {
    throw new Error(`Capability ${kind} scope is invalid.`);
  }
}

function assertExpiry(expiresAt: Date, now: Date) {
  const ttl = expiresAt.getTime() - now.getTime();
  if (!Number.isFinite(ttl) || ttl <= 0 || ttl > CAPABILITY_MAX_TTL_MS) {
    throw new Error("Capability expiry is invalid.");
  }
}
