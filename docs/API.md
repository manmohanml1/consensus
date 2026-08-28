# API outline

The concrete OpenAPI contract begins with milestone 0.3. This document fixes resource semantics, not provider implementation. The versioned provider-neutral command, projection, and public-error shapes are defined in [ROOM_PROTOCOL.md](ROOM_PROTOCOL.md); OpenAPI must reference those semantics rather than create a parallel model.

All room reads and mutations are private request-time data and return `Cache-Control: no-store`. Capabilities are carried by the approved transport boundary and never appear in request or response bodies.

## Commands

- `POST /api/v1/rooms` — create draft room and host capability;
- `POST /api/v1/rooms/{roomId}/participants` — join by invite capability;
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
