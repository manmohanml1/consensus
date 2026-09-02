import { describe, expect, it } from "vitest";
import {
  ROOM_PROTOCOL_LIMITS,
  ROOM_PROTOCOL_VERSION,
  createRoomProtocolError,
  parseCreateRoomRequest,
  parseRoomCommand,
  parseRoomProjection,
} from "./room-protocol";

const validVote = () => ({
  protocolVersion: ROOM_PROTOCOL_VERSION,
  commandId: "command_12345678",
  idempotencyKey: "device-01:vote:0001",
  roomId: "room_12345678",
  expectedRevision: 7,
  sequence: 4,
  issuedAt: "2026-08-28T02:00:00.000Z",
  actor: { memberId: "member_12345678", role: "participant" },
  type: "vote.submit",
  payload: {
    candidateId: "candidate_12345678",
    preference: "accept",
    mustPick: false,
  },
});

const validProjection = () => ({
  protocolVersion: ROOM_PROTOCOL_VERSION,
  roomId: "room_12345678",
  revision: 8,
  phase: "voting",
  title: "Friday dinner",
  targetAt: "2026-08-29T23:00:00.000Z",
  createdAt: "2026-08-28T02:00:00.000Z",
  expiresAt: "2026-08-30T02:00:00.000Z",
  rosterLocked: true,
  participants: [
    { id: "member_12345678", displayName: "Maya", status: "active" },
  ],
  constraintIds: ["constraint_12345678"],
  candidates: [
    { id: "candidate_12345678", name: "Garden Table", status: "active" },
  ],
  ballotProgress: [
    { participantId: "member_12345678", completed: 1, total: 1 },
  ],
  decision: null,
});

describe("room protocol commands", () => {
  it("parses a bounded versioned vote command", () => {
    expect(parseRoomCommand(validVote())).toEqual({
      success: true,
      data: validVote(),
    });
  });

  it("rejects role escalation", () => {
    const command = validVote();
    command.actor.role = "host";

    const result = parseRoomCommand(command);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          path: "$.actor.role",
          code: "invalid-value",
        }),
      );
    }
  });

  it("rejects unsupported versions and unknown fields", () => {
    const result = parseRoomCommand({
      ...validVote(),
      protocolVersion: "2.0.0",
      surprise: true,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues.map(({ code }) => code)).toEqual(
        expect.arrayContaining(["invalid-value", "unknown-field"]),
      );
    }
  });

  it("rejects authentication material anywhere in the payload", () => {
    const result = parseRoomCommand({
      ...validVote(),
      payload: { ...validVote().payload, capability: "do-not-accept" },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          path: "$.payload.capability",
          code: "unsafe-field",
        }),
      );
    }
  });

  it("rejects oversized input before it reaches command handling", () => {
    const result = parseRoomCommand({
      ...validVote(),
      padding: "x".repeat(ROOM_PROTOCOL_LIMITS.maxSerializedBytes),
    });

    expect(result).toEqual({
      success: false,
      issues: [expect.objectContaining({ path: "$", code: "too-large" })],
    });
  });

  it("rejects stale or malformed sequence fields", () => {
    const result = parseRoomCommand({
      ...validVote(),
      expectedRevision: -1,
      sequence: 0,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues.map(({ path }) => path)).toEqual(
        expect.arrayContaining(["$.expectedRevision", "$.sequence"]),
      );
    }
  });
});

describe("room creation requests", () => {
  const validCreation = () => ({
    protocolVersion: ROOM_PROTOCOL_VERSION,
    title: "Friday dinner",
    hostDisplayName: "Maya",
    targetAt: "2026-09-02T23:00:00.000Z",
  });

  it("parses a bounded creation request without transport authority", () => {
    expect(parseCreateRoomRequest(validCreation())).toEqual({
      success: true,
      data: validCreation(),
    });
  });

  it("rejects capabilities, unknown fields, and non-UTC time", () => {
    const result = parseCreateRoomRequest({
      ...validCreation(),
      capability: "never-in-a-body",
      targetAt: "2026-09-02T23:00:00.000+01:00",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues.map(({ code }) => code)).toEqual(
        expect.arrayContaining(["unsafe-field", "invalid-value"]),
      );
    }
  });
});

describe("room projections", () => {
  it("parses a privacy-minimized current projection", () => {
    expect(parseRoomProjection(validProjection())).toEqual({
      success: true,
      data: validProjection(),
    });
  });

  it("rejects private ballots and capability-like fields", () => {
    const result = parseRoomProjection({
      ...validProjection(),
      ballots: { member_12345678: { candidate_12345678: "prefer" } },
      capability: "never-project-this",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues.map(({ code }) => code)).toEqual(
        expect.arrayContaining(["unknown-field", "unsafe-field"]),
      );
    }
  });

  it("rejects duplicate identities and progress for an unknown participant", () => {
    const projection = validProjection();
    projection.participants.push({ ...projection.participants[0]! });
    projection.ballotProgress[0]!.participantId = "member_unknown88";

    const result = parseRoomProjection(projection);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues.map(({ path }) => path)).toEqual(
        expect.arrayContaining(["$.participants", "$.ballotProgress"]),
      );
    }
  });

  it("requires coherent resolved decision state", () => {
    const result = parseRoomProjection({
      ...validProjection(),
      phase: "resolved",
      decision: null,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues).toContainEqual(
        expect.objectContaining({ path: "$.decision", code: "invalid-value" }),
      );
    }
  });
});

describe("room protocol public errors", () => {
  it("does not distinguish a missing room from failed authorization", () => {
    expect(
      createRoomProtocolError(
        "unauthorized-or-missing",
        "correlation_12345678",
      ),
    ).toMatchObject({
      code: "unauthorized-or-missing",
      message: "The room is unavailable.",
      retryable: false,
    });
  });

  it("includes the trusted current revision only when supplied", () => {
    expect(
      createRoomProtocolError("stale-revision", "correlation_12345678", {
        currentRevision: 9,
      }),
    ).toMatchObject({ retryable: true, currentRevision: 9 });
  });
});
