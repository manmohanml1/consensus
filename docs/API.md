# API outline

The concrete milestone 0.3 contract is recorded in [the room API OpenAPI document](openapi/room-api-v1.yaml). The versioned provider-neutral command, projection, and public-error shapes are defined in [ROOM_PROTOCOL.md](ROOM_PROTOCOL.md); implementations adapt those semantics rather than create a parallel model.

All room reads and mutations are private request-time data and return `Cache-Control: no-store`. Capabilities are carried by the approved transport boundary and never appear in request or response bodies.

## Commands

- `POST /api/v1/rooms` — create a temporary room, issue its host capability by
  HTTP-only cookie, and return a shareable non-authoritative invitation locator;
- `POST /api/v1/rooms/join` — request admission with a non-authoritative
  invitation locator and receive a pending participant capability;
- `POST /api/v1/rooms/{roomId}/commands` — submit any versioned room command with compare-and-set revision, participant sequence, and idempotency semantics;
- `POST /api/v1/rooms/{roomId}/lock` — lock roster and rules;
- `POST /api/v1/rooms/{roomId}/candidates` — accept normalized host/provider candidates;
- `POST /api/v1/rooms/{roomId}/votes` — submit idempotent ballot command;
- `POST /api/v1/rooms/{roomId}/commitments` — record post-decision intent;
- `DELETE /api/v1/rooms/{roomId}` — host ends and schedules deletion.

## Reads

- `GET /api/v1/rooms/{roomId}/projection` — capability-scoped current state;
- `GET /api/v1/rooms/{roomId}/events?after={revision}` — bounded recovery path;
- `GET /api/v1/health/live` and `/ready` — operational health without sensitive detail.

## Error model

Errors contain a stable code, safe message, correlation id, and retryability. Unknown and unauthorized rooms return equivalent public responses. Validation errors identify fields without echoing sensitive values.

Parsing establishes shape and boundedness only. Every handler must separately authenticate the capability, authorize its room/member/role scope, enforce aggregate revision and participant sequence, apply idempotency, and commit the mutation with its outbox record in one transaction.

`POST /api/v1/rooms` is implemented for CQ-206. It accepts only the bounded
protocol version, room title, host display name, and UTC target time. The raw host
capability is never in JSON: it is delivered once as a secure room-path cookie.
The response locator has independent random entropy and is stored only as a
domain-separated keyed fingerprint. It may be put in a QR/link but cannot read,
join, or mutate a room on its own. CQ-207 admission creates a pending member;
the host explicitly approves that member before commands are accepted. Pending
capabilities may read the projection so the waiting screen can update. Missing,
expired, full, and locked rooms deliberately share one public join failure.

The command and projection routes remain authoritative. Roster changes use
`participant.approve`, `participant.remove`, and `participant.leave` through the
same command transaction. Locking snapshots active members; later departure does
not silently shrink the electorate. Reserved CQ-208/CQ-209 compatibility routes
must delegate to this boundary rather than duplicate authority rules.
