import type { Preference } from "./types";

export const ROOM_PROTOCOL_VERSION = "1.0.0" as const;
export const ROOM_PROTOCOL_LIMITS = {
  maxSerializedBytes: 16_384,
  maxParticipants: 8,
  maxCandidates: 12,
  maxConstraints: 12,
  maxRoomTitleLength: 80,
  maxDisplayNameLength: 48,
} as const;

export type RoomRole = "host" | "participant";
export type RoomPhase =
  "lobby" | "candidate-review" | "voting" | "resolved" | "expired";

export type RoomCommandType =
  | "room.rename"
  | "room.end"
  | "roster.lock"
  | "candidate.add"
  | "candidate.remove"
  | "vote.submit"
  | "decision.resolve"
  | "commitment.set";

interface RoomCommandBase<TType extends RoomCommandType, TPayload> {
  protocolVersion: typeof ROOM_PROTOCOL_VERSION;
  commandId: string;
  idempotencyKey: string;
  roomId: string;
  expectedRevision: number;
  sequence: number;
  issuedAt: string;
  actor: {
    memberId: string;
    role: RoomRole;
  };
  type: TType;
  payload: TPayload;
}

export type RoomCommand =
  | RoomCommandBase<"room.rename", { title: string }>
  | RoomCommandBase<"room.end", Record<string, never>>
  | RoomCommandBase<"roster.lock", Record<string, never>>
  | RoomCommandBase<"candidate.add", { candidateId: string }>
  | RoomCommandBase<"candidate.remove", { candidateId: string }>
  | RoomCommandBase<
      "vote.submit",
      { candidateId: string; preference: Preference; mustPick: boolean }
    >
  | RoomCommandBase<"decision.resolve", Record<string, never>>
  | RoomCommandBase<"commitment.set", { committed: boolean }>;

export interface RoomProjection {
  protocolVersion: typeof ROOM_PROTOCOL_VERSION;
  roomId: string;
  revision: number;
  phase: RoomPhase;
  title: string;
  targetAt: string;
  createdAt: string;
  expiresAt: string;
  rosterLocked: boolean;
  participants: Array<{
    id: string;
    displayName: string;
    status: "active" | "left";
  }>;
  constraintIds: string[];
  candidates: Array<{
    id: string;
    name: string;
    status: "active" | "removed";
  }>;
  ballotProgress: Array<{
    participantId: string;
    completed: number;
    total: number;
  }>;
  decision: null | {
    status: "decided" | "no-safe-result";
    rulesetVersion: string;
    winnerCandidateId: string | null;
  };
}

/** Public, non-authoritative request made by the person creating a room. */
export interface CreateRoomRequest {
  protocolVersion: typeof ROOM_PROTOCOL_VERSION;
  title: string;
  hostDisplayName: string;
  targetAt: string;
}

/** The friendly invitation locator may be shared, but grants no access itself. */
export interface RoomInvitation {
  locator: string;
  expiresAt: string;
}

export type RoomProtocolErrorCode =
  | "invalid-request"
  | "unsupported-version"
  | "unauthorized-or-missing"
  | "stale-revision"
  | "sequence-conflict"
  | "room-locked"
  | "room-expired"
  | "command-conflict"
  | "rate-limited"
  | "temporarily-unavailable";

export interface RoomProtocolError {
  protocolVersion: typeof ROOM_PROTOCOL_VERSION;
  code: RoomProtocolErrorCode;
  message: string;
  retryable: boolean;
  correlationId: string;
  currentRevision?: number;
}

export interface RoomProtocolParseIssue {
  path: string;
  code:
    | "invalid-type"
    | "invalid-value"
    | "missing-field"
    | "unknown-field"
    | "unsafe-field"
    | "too-large";
  message: string;
}

export type RoomProtocolParseResult<T> =
  | { success: true; data: T }
  | { success: false; issues: RoomProtocolParseIssue[] };

type JsonRecord = Record<string, unknown>;

const identifierPattern = /^[A-Za-z0-9_-]{8,64}$/;
const idempotencyPattern = /^[A-Za-z0-9._:-]{16,128}$/;
const forbiddenKeyPattern =
  /^(authorization|capability|cookie|password|secret|token)$/i;
const commandTypes: readonly RoomCommandType[] = [
  "room.rename",
  "room.end",
  "roster.lock",
  "candidate.add",
  "candidate.remove",
  "vote.submit",
  "decision.resolve",
  "commitment.set",
];
const phases: readonly RoomPhase[] = [
  "lobby",
  "candidate-review",
  "voting",
  "resolved",
  "expired",
];

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pushIssue(
  issues: RoomProtocolParseIssue[],
  path: string,
  code: RoomProtocolParseIssue["code"],
  message: string,
) {
  issues.push({ path, code, message });
}

function checkSerializedSize(
  value: unknown,
  issues: RoomProtocolParseIssue[],
): boolean {
  try {
    const serialized = JSON.stringify(value);
    if (serialized === undefined) {
      pushIssue(issues, "$", "invalid-type", "Payload must be JSON data.");
      return false;
    }
    if (
      new TextEncoder().encode(serialized).byteLength >
      ROOM_PROTOCOL_LIMITS.maxSerializedBytes
    ) {
      pushIssue(
        issues,
        "$",
        "too-large",
        `Payload exceeds ${ROOM_PROTOCOL_LIMITS.maxSerializedBytes} bytes.`,
      );
      return false;
    }
    return true;
  } catch {
    pushIssue(
      issues,
      "$",
      "invalid-type",
      "Payload must be serializable JSON.",
    );
    return false;
  }
}

function scanUnsafeKeys(
  value: unknown,
  issues: RoomProtocolParseIssue[],
  path = "$",
) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      scanUnsafeKeys(entry, issues, `${path}[${index}]`),
    );
    return;
  }
  if (!isRecord(value)) return;

  for (const [key, entry] of Object.entries(value)) {
    if (forbiddenKeyPattern.test(key)) {
      pushIssue(
        issues,
        `${path}.${key}`,
        "unsafe-field",
        "Authentication material belongs in the transport boundary, not the protocol payload.",
      );
    }
    scanUnsafeKeys(entry, issues, `${path}.${key}`);
  }
}

function rejectUnknownKeys(
  value: JsonRecord,
  allowed: readonly string[],
  path: string,
  issues: RoomProtocolParseIssue[],
) {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      pushIssue(issues, `${path}.${key}`, "unknown-field", "Unknown field.");
    }
  }
}

function readString(
  value: JsonRecord,
  key: string,
  path: string,
  issues: RoomProtocolParseIssue[],
  options: { max: number; pattern?: RegExp; allowEmpty?: boolean },
): string | undefined {
  const entry = value[key];
  if (entry === undefined) {
    pushIssue(issues, `${path}.${key}`, "missing-field", "Required field.");
    return undefined;
  }
  if (typeof entry !== "string") {
    pushIssue(issues, `${path}.${key}`, "invalid-type", "Expected a string.");
    return undefined;
  }
  const normalized = entry.trim();
  if (
    (!options.allowEmpty && normalized.length === 0) ||
    normalized.length > options.max
  ) {
    pushIssue(
      issues,
      `${path}.${key}`,
      "invalid-value",
      "String length is outside the allowed range.",
    );
    return undefined;
  }
  if (options.pattern && !options.pattern.test(normalized)) {
    pushIssue(
      issues,
      `${path}.${key}`,
      "invalid-value",
      "String format is invalid.",
    );
    return undefined;
  }
  return normalized;
}

function readInteger(
  value: JsonRecord,
  key: string,
  path: string,
  issues: RoomProtocolParseIssue[],
  min: number,
  max = Number.MAX_SAFE_INTEGER,
): number | undefined {
  const entry = value[key];
  if (entry === undefined) {
    pushIssue(issues, `${path}.${key}`, "missing-field", "Required field.");
    return undefined;
  }
  if (
    !Number.isSafeInteger(entry) ||
    Number(entry) < min ||
    Number(entry) > max
  ) {
    pushIssue(
      issues,
      `${path}.${key}`,
      "invalid-value",
      "Expected a bounded integer.",
    );
    return undefined;
  }
  return Number(entry);
}

function readBoolean(
  value: JsonRecord,
  key: string,
  path: string,
  issues: RoomProtocolParseIssue[],
): boolean | undefined {
  const entry = value[key];
  if (typeof entry !== "boolean") {
    pushIssue(
      issues,
      `${path}.${key}`,
      entry === undefined ? "missing-field" : "invalid-type",
      "Expected a boolean.",
    );
    return undefined;
  }
  return entry;
}

function readTimestamp(
  value: JsonRecord,
  key: string,
  path: string,
  issues: RoomProtocolParseIssue[],
): string | undefined {
  const timestamp = readString(value, key, path, issues, { max: 35 });
  if (
    timestamp &&
    (!timestamp.endsWith("Z") || Number.isNaN(Date.parse(timestamp)))
  ) {
    pushIssue(
      issues,
      `${path}.${key}`,
      "invalid-value",
      "Expected an ISO-8601 UTC timestamp.",
    );
    return undefined;
  }
  return timestamp;
}

function parseEmptyPayload(
  payload: JsonRecord,
  issues: RoomProtocolParseIssue[],
): Record<string, never> {
  rejectUnknownKeys(payload, [], "$.payload", issues);
  return {};
}

function parseCommandPayload(
  type: RoomCommandType,
  payload: JsonRecord,
  actorRole: RoomRole | undefined,
  issues: RoomProtocolParseIssue[],
): RoomCommand["payload"] | undefined {
  const participantOnly = type === "vote.submit" || type === "commitment.set";
  const requiredRole: RoomRole = participantOnly ? "participant" : "host";
  if (actorRole && actorRole !== requiredRole) {
    pushIssue(
      issues,
      "$.actor.role",
      "invalid-value",
      `${type} requires the ${requiredRole} role.`,
    );
  }

  if (type === "room.rename") {
    rejectUnknownKeys(payload, ["title"], "$.payload", issues);
    const title = readString(payload, "title", "$.payload", issues, {
      max: ROOM_PROTOCOL_LIMITS.maxRoomTitleLength,
    });
    return title ? { title } : undefined;
  }
  if (type === "candidate.add" || type === "candidate.remove") {
    rejectUnknownKeys(payload, ["candidateId"], "$.payload", issues);
    const candidateId = readString(
      payload,
      "candidateId",
      "$.payload",
      issues,
      {
        max: 64,
        pattern: identifierPattern,
      },
    );
    return candidateId ? { candidateId } : undefined;
  }
  if (type === "vote.submit") {
    rejectUnknownKeys(
      payload,
      ["candidateId", "preference", "mustPick"],
      "$.payload",
      issues,
    );
    const candidateId = readString(
      payload,
      "candidateId",
      "$.payload",
      issues,
      {
        max: 64,
        pattern: identifierPattern,
      },
    );
    const preference = readString(payload, "preference", "$.payload", issues, {
      max: 8,
    });
    const mustPick = readBoolean(payload, "mustPick", "$.payload", issues);
    if (preference && !["prefer", "accept", "avoid"].includes(preference)) {
      pushIssue(
        issues,
        "$.payload.preference",
        "invalid-value",
        "Unknown preference.",
      );
    }
    return candidateId &&
      (preference === "prefer" ||
        preference === "accept" ||
        preference === "avoid") &&
      mustPick !== undefined
      ? { candidateId, preference, mustPick }
      : undefined;
  }
  if (type === "commitment.set") {
    rejectUnknownKeys(payload, ["committed"], "$.payload", issues);
    const committed = readBoolean(payload, "committed", "$.payload", issues);
    return committed === undefined ? undefined : { committed };
  }
  return parseEmptyPayload(payload, issues);
}

export function parseRoomCommand(
  value: unknown,
): RoomProtocolParseResult<RoomCommand> {
  const issues: RoomProtocolParseIssue[] = [];
  if (!checkSerializedSize(value, issues)) return { success: false, issues };
  scanUnsafeKeys(value, issues);
  if (!isRecord(value)) {
    pushIssue(issues, "$", "invalid-type", "Expected a command object.");
    return { success: false, issues };
  }

  rejectUnknownKeys(
    value,
    [
      "protocolVersion",
      "commandId",
      "idempotencyKey",
      "roomId",
      "expectedRevision",
      "sequence",
      "issuedAt",
      "actor",
      "type",
      "payload",
    ],
    "$",
    issues,
  );

  const protocolVersion = readString(value, "protocolVersion", "$", issues, {
    max: 16,
  });
  if (protocolVersion && protocolVersion !== ROOM_PROTOCOL_VERSION) {
    pushIssue(
      issues,
      "$.protocolVersion",
      "invalid-value",
      "Unsupported protocol version.",
    );
  }
  const commandId = readString(value, "commandId", "$", issues, {
    max: 64,
    pattern: identifierPattern,
  });
  const idempotencyKey = readString(value, "idempotencyKey", "$", issues, {
    max: 128,
    pattern: idempotencyPattern,
  });
  const roomId = readString(value, "roomId", "$", issues, {
    max: 64,
    pattern: identifierPattern,
  });
  const expectedRevision = readInteger(
    value,
    "expectedRevision",
    "$",
    issues,
    0,
  );
  const sequence = readInteger(value, "sequence", "$", issues, 1);
  const issuedAt = readTimestamp(value, "issuedAt", "$", issues);
  const typeValue = readString(value, "type", "$", issues, { max: 32 });
  const type = commandTypes.includes(typeValue as RoomCommandType)
    ? (typeValue as RoomCommandType)
    : undefined;
  if (typeValue && !type) {
    pushIssue(issues, "$.type", "invalid-value", "Unknown command type.");
  }

  const actorValue = value.actor;
  let actor: RoomCommand["actor"] | undefined;
  if (!isRecord(actorValue)) {
    pushIssue(issues, "$.actor", "invalid-type", "Expected an actor object.");
  } else {
    rejectUnknownKeys(actorValue, ["memberId", "role"], "$.actor", issues);
    const memberId = readString(actorValue, "memberId", "$.actor", issues, {
      max: 64,
      pattern: identifierPattern,
    });
    const roleValue = readString(actorValue, "role", "$.actor", issues, {
      max: 16,
    });
    const role =
      roleValue === "host" || roleValue === "participant"
        ? roleValue
        : undefined;
    if (roleValue && !role) {
      pushIssue(issues, "$.actor.role", "invalid-value", "Unknown room role.");
    }
    if (memberId && role) actor = { memberId, role };
  }

  const payloadValue = value.payload;
  let payload: RoomCommand["payload"] | undefined;
  if (!isRecord(payloadValue)) {
    pushIssue(
      issues,
      "$.payload",
      "invalid-type",
      "Expected a payload object.",
    );
  } else if (type) {
    payload = parseCommandPayload(type, payloadValue, actor?.role, issues);
  }

  if (
    issues.length > 0 ||
    protocolVersion !== ROOM_PROTOCOL_VERSION ||
    !commandId ||
    !idempotencyKey ||
    !roomId ||
    expectedRevision === undefined ||
    sequence === undefined ||
    !issuedAt ||
    !actor ||
    !type ||
    !payload
  ) {
    return { success: false, issues };
  }

  return {
    success: true,
    data: {
      protocolVersion,
      commandId,
      idempotencyKey,
      roomId,
      expectedRevision,
      sequence,
      issuedAt,
      actor,
      type,
      payload,
    } as RoomCommand,
  };
}

export function parseCreateRoomRequest(
  value: unknown,
): RoomProtocolParseResult<CreateRoomRequest> {
  const issues: RoomProtocolParseIssue[] = [];
  if (!checkSerializedSize(value, issues)) return { success: false, issues };
  scanUnsafeKeys(value, issues);
  if (!isRecord(value)) {
    pushIssue(issues, "$", "invalid-type", "Expected a room creation object.");
    return { success: false, issues };
  }
  rejectUnknownKeys(
    value,
    ["protocolVersion", "title", "hostDisplayName", "targetAt"],
    "$",
    issues,
  );
  const protocolVersion = readString(value, "protocolVersion", "$", issues, {
    max: 16,
  });
  if (protocolVersion && protocolVersion !== ROOM_PROTOCOL_VERSION) {
    pushIssue(
      issues,
      "$.protocolVersion",
      "invalid-value",
      "Unsupported protocol version.",
    );
  }
  const title = readString(value, "title", "$", issues, {
    max: ROOM_PROTOCOL_LIMITS.maxRoomTitleLength,
  });
  const hostDisplayName = readString(value, "hostDisplayName", "$", issues, {
    max: ROOM_PROTOCOL_LIMITS.maxDisplayNameLength,
  });
  const targetAt = readTimestamp(value, "targetAt", "$", issues);
  if (issues.length > 0 || !title || !hostDisplayName || !targetAt) {
    return { success: false, issues };
  }
  return {
    success: true,
    data: {
      protocolVersion: ROOM_PROTOCOL_VERSION,
      title,
      hostDisplayName,
      targetAt,
    },
  };
}

function readRecordArray(
  value: JsonRecord,
  key: string,
  path: string,
  issues: RoomProtocolParseIssue[],
  max: number,
): JsonRecord[] | undefined {
  const entry = value[key];
  if (!Array.isArray(entry)) {
    pushIssue(
      issues,
      `${path}.${key}`,
      entry === undefined ? "missing-field" : "invalid-type",
      "Expected an array.",
    );
    return undefined;
  }
  if (entry.length > max) {
    pushIssue(
      issues,
      `${path}.${key}`,
      "too-large",
      `Array may contain at most ${max} items.`,
    );
  }
  const records: JsonRecord[] = [];
  entry.forEach((item, index) => {
    if (!isRecord(item)) {
      pushIssue(
        issues,
        `${path}.${key}[${index}]`,
        "invalid-type",
        "Expected an object.",
      );
    } else {
      records.push(item);
    }
  });
  return records;
}

function readIdentifierArray(
  value: JsonRecord,
  key: string,
  path: string,
  issues: RoomProtocolParseIssue[],
  max: number,
): string[] | undefined {
  const entry = value[key];
  if (!Array.isArray(entry)) {
    pushIssue(
      issues,
      `${path}.${key}`,
      entry === undefined ? "missing-field" : "invalid-type",
      "Expected an array.",
    );
    return undefined;
  }
  if (entry.length > max) {
    pushIssue(
      issues,
      `${path}.${key}`,
      "too-large",
      `Array may contain at most ${max} items.`,
    );
  }
  const identifiers: string[] = [];
  entry.forEach((item, index) => {
    if (typeof item !== "string" || !identifierPattern.test(item)) {
      pushIssue(
        issues,
        `${path}.${key}[${index}]`,
        "invalid-value",
        "Expected an identifier.",
      );
    } else {
      identifiers.push(item);
    }
  });
  if (new Set(identifiers).size !== identifiers.length) {
    pushIssue(
      issues,
      `${path}.${key}`,
      "invalid-value",
      "Identifiers must be unique.",
    );
  }
  return identifiers;
}

export function parseRoomProjection(
  value: unknown,
): RoomProtocolParseResult<RoomProjection> {
  const issues: RoomProtocolParseIssue[] = [];
  if (!checkSerializedSize(value, issues)) return { success: false, issues };
  scanUnsafeKeys(value, issues);
  if (!isRecord(value)) {
    pushIssue(issues, "$", "invalid-type", "Expected a projection object.");
    return { success: false, issues };
  }

  rejectUnknownKeys(
    value,
    [
      "protocolVersion",
      "roomId",
      "revision",
      "phase",
      "title",
      "targetAt",
      "createdAt",
      "expiresAt",
      "rosterLocked",
      "participants",
      "constraintIds",
      "candidates",
      "ballotProgress",
      "decision",
    ],
    "$",
    issues,
  );

  const protocolVersion = readString(value, "protocolVersion", "$", issues, {
    max: 16,
  });
  if (protocolVersion && protocolVersion !== ROOM_PROTOCOL_VERSION) {
    pushIssue(
      issues,
      "$.protocolVersion",
      "invalid-value",
      "Unsupported protocol version.",
    );
  }
  const roomId = readString(value, "roomId", "$", issues, {
    max: 64,
    pattern: identifierPattern,
  });
  const revision = readInteger(value, "revision", "$", issues, 0);
  const phaseValue = readString(value, "phase", "$", issues, { max: 32 });
  const phase = phases.includes(phaseValue as RoomPhase)
    ? (phaseValue as RoomPhase)
    : undefined;
  if (phaseValue && !phase) {
    pushIssue(issues, "$.phase", "invalid-value", "Unknown room phase.");
  }
  const title = readString(value, "title", "$", issues, {
    max: ROOM_PROTOCOL_LIMITS.maxRoomTitleLength,
  });
  const targetAt = readTimestamp(value, "targetAt", "$", issues);
  const createdAt = readTimestamp(value, "createdAt", "$", issues);
  const expiresAt = readTimestamp(value, "expiresAt", "$", issues);
  const rosterLocked = readBoolean(value, "rosterLocked", "$", issues);
  if (
    createdAt &&
    expiresAt &&
    Date.parse(expiresAt) <= Date.parse(createdAt)
  ) {
    pushIssue(
      issues,
      "$.expiresAt",
      "invalid-value",
      "Expiry must follow creation.",
    );
  }

  const participantRecords = readRecordArray(
    value,
    "participants",
    "$",
    issues,
    ROOM_PROTOCOL_LIMITS.maxParticipants,
  );
  const participants: RoomProjection["participants"] = [];
  participantRecords?.forEach((participant, index) => {
    const path = `$.participants[${index}]`;
    rejectUnknownKeys(
      participant,
      ["id", "displayName", "status"],
      path,
      issues,
    );
    const id = readString(participant, "id", path, issues, {
      max: 64,
      pattern: identifierPattern,
    });
    const displayName = readString(participant, "displayName", path, issues, {
      max: ROOM_PROTOCOL_LIMITS.maxDisplayNameLength,
    });
    const statusValue = readString(participant, "status", path, issues, {
      max: 16,
    });
    const status =
      statusValue === "active" || statusValue === "left"
        ? statusValue
        : undefined;
    if (statusValue && !status) {
      pushIssue(
        issues,
        `${path}.status`,
        "invalid-value",
        "Unknown participant status.",
      );
    }
    if (id && displayName && status)
      participants.push({ id, displayName, status });
  });
  if (new Set(participants.map(({ id }) => id)).size !== participants.length) {
    pushIssue(
      issues,
      "$.participants",
      "invalid-value",
      "Participant identifiers must be unique.",
    );
  }

  const constraintIds =
    readIdentifierArray(
      value,
      "constraintIds",
      "$",
      issues,
      ROOM_PROTOCOL_LIMITS.maxConstraints,
    ) ?? [];

  const candidateRecords = readRecordArray(
    value,
    "candidates",
    "$",
    issues,
    ROOM_PROTOCOL_LIMITS.maxCandidates,
  );
  const candidates: RoomProjection["candidates"] = [];
  candidateRecords?.forEach((candidate, index) => {
    const path = `$.candidates[${index}]`;
    rejectUnknownKeys(candidate, ["id", "name", "status"], path, issues);
    const id = readString(candidate, "id", path, issues, {
      max: 64,
      pattern: identifierPattern,
    });
    const name = readString(candidate, "name", path, issues, { max: 100 });
    const statusValue = readString(candidate, "status", path, issues, {
      max: 16,
    });
    const status =
      statusValue === "active" || statusValue === "removed"
        ? statusValue
        : undefined;
    if (statusValue && !status) {
      pushIssue(
        issues,
        `${path}.status`,
        "invalid-value",
        "Unknown candidate status.",
      );
    }
    if (id && name && status) candidates.push({ id, name, status });
  });
  if (new Set(candidates.map(({ id }) => id)).size !== candidates.length) {
    pushIssue(
      issues,
      "$.candidates",
      "invalid-value",
      "Candidate identifiers must be unique.",
    );
  }

  const progressRecords = readRecordArray(
    value,
    "ballotProgress",
    "$",
    issues,
    ROOM_PROTOCOL_LIMITS.maxParticipants,
  );
  const ballotProgress: RoomProjection["ballotProgress"] = [];
  progressRecords?.forEach((progress, index) => {
    const path = `$.ballotProgress[${index}]`;
    rejectUnknownKeys(
      progress,
      ["participantId", "completed", "total"],
      path,
      issues,
    );
    const participantId = readString(progress, "participantId", path, issues, {
      max: 64,
      pattern: identifierPattern,
    });
    const completed = readInteger(
      progress,
      "completed",
      path,
      issues,
      0,
      ROOM_PROTOCOL_LIMITS.maxCandidates,
    );
    const total = readInteger(
      progress,
      "total",
      path,
      issues,
      0,
      ROOM_PROTOCOL_LIMITS.maxCandidates,
    );
    if (completed !== undefined && total !== undefined && completed > total) {
      pushIssue(
        issues,
        `${path}.completed`,
        "invalid-value",
        "Completed count cannot exceed total.",
      );
    }
    if (participantId && completed !== undefined && total !== undefined) {
      ballotProgress.push({ participantId, completed, total });
    }
  });
  const participantIds = new Set(participants.map(({ id }) => id));
  for (const progress of ballotProgress) {
    if (!participantIds.has(progress.participantId)) {
      pushIssue(
        issues,
        "$.ballotProgress",
        "invalid-value",
        "Ballot progress must reference a projected participant.",
      );
    }
  }

  let decision: RoomProjection["decision"] | undefined;
  if (value.decision === null) {
    decision = null;
  } else if (!isRecord(value.decision)) {
    pushIssue(
      issues,
      "$.decision",
      "invalid-type",
      "Expected a decision object or null.",
    );
  } else {
    const decisionValue = value.decision;
    rejectUnknownKeys(
      decisionValue,
      ["status", "rulesetVersion", "winnerCandidateId"],
      "$.decision",
      issues,
    );
    const statusValue = readString(
      decisionValue,
      "status",
      "$.decision",
      issues,
      {
        max: 24,
      },
    );
    const status =
      statusValue === "decided" || statusValue === "no-safe-result"
        ? statusValue
        : undefined;
    if (statusValue && !status) {
      pushIssue(
        issues,
        "$.decision.status",
        "invalid-value",
        "Unknown decision status.",
      );
    }
    const rulesetVersion = readString(
      decisionValue,
      "rulesetVersion",
      "$.decision",
      issues,
      { max: 24 },
    );
    const winnerValue = decisionValue.winnerCandidateId;
    let winnerCandidateId: string | null | undefined;
    if (winnerValue === null) {
      winnerCandidateId = null;
    } else if (
      typeof winnerValue === "string" &&
      identifierPattern.test(winnerValue)
    ) {
      winnerCandidateId = winnerValue;
    } else {
      pushIssue(
        issues,
        "$.decision.winnerCandidateId",
        winnerValue === undefined ? "missing-field" : "invalid-value",
        "Expected a candidate identifier or null.",
      );
    }
    if (status === "decided" && winnerCandidateId === null) {
      pushIssue(
        issues,
        "$.decision.winnerCandidateId",
        "invalid-value",
        "A decided result requires a winner.",
      );
    }
    if (status === "no-safe-result" && winnerCandidateId !== null) {
      pushIssue(
        issues,
        "$.decision.winnerCandidateId",
        "invalid-value",
        "A no-safe-result projection cannot name a winner.",
      );
    }
    if (status && rulesetVersion && winnerCandidateId !== undefined) {
      decision = { status, rulesetVersion, winnerCandidateId };
    }
  }

  if (phase === "resolved" && decision === null) {
    pushIssue(
      issues,
      "$.decision",
      "invalid-value",
      "Resolved rooms require a decision.",
    );
  }
  if (phase && phase !== "resolved" && decision) {
    pushIssue(
      issues,
      "$.decision",
      "invalid-value",
      "Only resolved rooms may expose a decision.",
    );
  }

  if (
    issues.length > 0 ||
    protocolVersion !== ROOM_PROTOCOL_VERSION ||
    !roomId ||
    revision === undefined ||
    !phase ||
    !title ||
    !targetAt ||
    !createdAt ||
    !expiresAt ||
    rosterLocked === undefined ||
    !participantRecords ||
    !candidateRecords ||
    !progressRecords ||
    decision === undefined
  ) {
    return { success: false, issues };
  }

  return {
    success: true,
    data: {
      protocolVersion,
      roomId,
      revision,
      phase,
      title,
      targetAt,
      createdAt,
      expiresAt,
      rosterLocked,
      participants,
      constraintIds,
      candidates,
      ballotProgress,
      decision,
    },
  };
}

export function createRoomProtocolError(
  code: RoomProtocolErrorCode,
  correlationId: string,
  options: { currentRevision?: number } = {},
): RoomProtocolError {
  const retryable =
    code === "stale-revision" ||
    code === "sequence-conflict" ||
    code === "rate-limited" ||
    code === "temporarily-unavailable";
  const message =
    code === "unauthorized-or-missing"
      ? "The room is unavailable."
      : code === "rate-limited"
        ? "Too many attempts. Try again later."
        : code === "temporarily-unavailable"
          ? "The room service is temporarily unavailable."
          : "The room command could not be accepted.";

  return {
    protocolVersion: ROOM_PROTOCOL_VERSION,
    code,
    message,
    retryable,
    correlationId,
    ...(options.currentRevision === undefined
      ? {}
      : { currentRevision: options.currentRevision }),
  };
}
