import { inspect } from "node:util";
import { describe, expect, it } from "vitest";
import {
  CAPABILITY_COOKIE_NAME,
  CAPABILITY_HASH_BYTES,
  authorizeCapability,
  fingerprintCapability,
  issueCapability,
  parseCapabilityPepper,
  serializeCapabilityCookie,
  serializeClearedCapabilityCookie,
  type CapabilityScope,
  type StoredCapability,
} from "./capabilities.js";

const pepper = parseCapabilityPepper("A".repeat(43));
const otherPepper = parseCapabilityPepper("B".repeat(43));
const scope: CapabilityScope = {
  roomId: "room_00000001",
  memberId: "member_000001",
  role: "host",
};
const now = new Date("2026-09-01T12:00:00.000Z");
const expiresAt = new Date("2026-09-01T14:00:00.000Z");

function issue() {
  return issueCapability(scope, expiresAt, pepper, now);
}

function stored(hash: Uint8Array): StoredCapability {
  return { ...scope, hash, expiresAt, status: "active" };
}

describe("room capabilities", () => {
  it("issues unique 256-bit opaque tokens and one-way keyed fingerprints", () => {
    const issued = Array.from({ length: 64 }, () => issue());
    const tokens = issued.map((capability) => capability.takeToken());

    expect(new Set(tokens).size).toBe(tokens.length);
    expect(tokens.every((token) => /^c1\.[A-Za-z0-9_-]{43}$/.test(token))).toBe(
      true,
    );
    expect(
      issued.every(({ hash }) => hash.byteLength === CAPABILITY_HASH_BYTES),
    ).toBe(true);
    expect(Buffer.from(issued[0]!.hash).toString("utf8")).not.toContain(
      tokens[0],
    );
  });

  it("uses a pepper and domain-separated deterministic fingerprint", () => {
    const token = issue().takeToken();
    const first = fingerprintCapability(token, pepper);
    const second = fingerprintCapability(token, pepper);
    const withOtherPepper = fingerprintCapability(token, otherPepper);

    expect(first).toEqual(second);
    expect(first).not.toEqual(withOtherPepper);
  });

  it("redacts issued tokens from common logging and permits one delivery", () => {
    const capability = issue();
    const token = capability.takeToken();

    expect(JSON.stringify(capability)).not.toContain(token);
    expect(JSON.stringify(capability)).not.toContain(scope.roomId);
    expect(JSON.stringify(capability)).not.toContain(scope.memberId);
    expect(String(capability)).toBe("[REDACTED]");
    expect(inspect(capability)).not.toContain(token);
    expect(inspect(capability)).not.toContain(scope.roomId);
    expect(() => capability.takeToken()).toThrow("already been consumed");
  });

  it("authorizes only the matching active room, member, role, hash, and expiry", () => {
    const capability = issue();
    const token = capability.takeToken();
    const record = stored(capability.hash);

    expect(authorizeCapability(token, pepper, record, scope, now)).toEqual(
      scope,
    );
    expect(
      authorizeCapability(
        token,
        pepper,
        record,
        { ...scope, roomId: "room_00000002" },
        now,
      ),
    ).toBeNull();
    expect(
      authorizeCapability(
        token,
        pepper,
        record,
        { ...scope, memberId: "member_000002" },
        now,
      ),
    ).toBeNull();
    expect(
      authorizeCapability(
        token,
        pepper,
        record,
        { ...scope, role: "participant" },
        now,
      ),
    ).toBeNull();
    expect(
      authorizeCapability("c1.invalid", pepper, record, scope, now),
    ).toBeNull();
    expect(authorizeCapability(42, pepper, record, scope, now)).toBeNull();
    expect(
      authorizeCapability(token, otherPepper, record, scope, now),
    ).toBeNull();
    expect(
      authorizeCapability(
        token,
        pepper,
        { ...record, status: "left" },
        scope,
        now,
      ),
    ).toBeNull();
    expect(
      authorizeCapability(token, pepper, record, scope, expiresAt),
    ).toBeNull();
    expect(authorizeCapability(token, pepper, null, scope, now)).toBeNull();
  });

  it("serializes a room-path-scoped secure cookie and deterministic clearing cookie", () => {
    const capability = issue();
    const token = capability.takeToken();
    const cookie = serializeCapabilityCookie(
      token,
      scope.roomId,
      expiresAt,
      now,
    );

    expect(cookie).toContain(`${CAPABILITY_COOKIE_NAME}=${token}`);
    expect(cookie).toContain("Path=/api/v1/rooms/room_00000001");
    expect(cookie).toContain("Max-Age=7200");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).not.toContain("Domain=");

    const cleared = serializeClearedCapabilityCookie(scope.roomId);
    expect(cleared).toContain("Max-Age=0");
    expect(cleared).toContain("Expires=Thu, 01 Jan 1970 00:00:00 GMT");
  });

  it("fails closed for invalid configuration, scope, and lifetime", () => {
    expect(() => parseCapabilityPepper(undefined)).toThrow(
      "configuration is invalid",
    );
    expect(() => parseCapabilityPepper("short")).toThrow(
      "configuration is invalid",
    );
    expect(() =>
      issueCapability({ ...scope, roomId: "short" }, expiresAt, pepper, now),
    ).toThrow("room scope is invalid");
    expect(() => issueCapability(scope, now, pepper, now)).toThrow(
      "expiry is invalid",
    );
    expect(() =>
      issueCapability(
        scope,
        new Date(now.getTime() + 24 * 60 * 60 * 1_000 + 1),
        pepper,
        now,
      ),
    ).toThrow("expiry is invalid");
  });
});
