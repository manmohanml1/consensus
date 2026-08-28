# Room protocol contract

Milestone 0.3 introduces a provider-neutral protocol before it introduces a database or public room API. The runtime contract lives in `packages/domain/src/room-protocol.ts`; persistence, HTTP handlers, capabilities, and realtime transports must adapt to it rather than redefining it.

## Versioning

`ROOM_PROTOCOL_VERSION` identifies the command and projection wire shape independently from the decision ruleset. A breaking field, semantic, authorization, or state-machine change requires a new protocol version and compatibility fixtures. Database migrations and realtime event versions remain related but separate concerns.

## Transport and authority boundary

- Capabilities belong in an HTTP-only cookie or authorization transport selected by CQ-203. They are forbidden in command and projection payloads.
- Friendly room codes locate invitations but grant no authority.
- The server authenticates the capability, derives its room/member/role scope, and verifies that it matches the command actor before applying anything.
- Parsing proves only shape and boundedness. Authorization, expected revision, participant sequence, room phase, and idempotency are enforced transactionally by CQ-204.
- Commands and authorized projections are private, request-time data and must use `Cache-Control: no-store`.

## Command envelope

Every command includes the protocol version, command id, idempotency key, room id, expected aggregate revision, actor sequence, UTC issue time, actor scope, command type, and a type-specific payload.

| Command            | Required role | Purpose                                                  |
| ------------------ | ------------- | -------------------------------------------------------- |
| `room.rename`      | Host          | Change the bounded room title before policy disallows it |
| `room.end`         | Host          | End the room and begin its deletion lifecycle            |
| `roster.lock`      | Host          | Snapshot eligible voters before voting starts            |
| `candidate.add`    | Host          | Add a normalized candidate reference                     |
| `candidate.remove` | Host          | Remove a candidate when the room phase permits           |
| `vote.submit`      | Participant   | Submit one idempotent preference command                 |
| `decision.resolve` | Host          | Request authoritative resolution after completion checks |
| `commitment.set`   | Participant   | Record post-decision intent separately from the ballot   |

Unknown fields, unsupported versions, invalid roles, invalid identifiers, malformed timestamps, secret-like keys, and payloads over 16 KiB fail before command handling. Limits are deliberately small because a room contains at most eight participants and twelve candidates.

Room creation, invitation location, and join/recovery request contracts are delivered by CQ-206 and CQ-209 because their transport and capability issuance semantics are not ordinary room commands.

## Projection boundary

The current projection exposes only the data needed to render a room: revision and phase, bounded room intent, roster status, constraint identifiers, candidate summaries, coarse ballot completion, and the final decision summary.

It does not contain capabilities, authorization material, individual votes, private constraint ownership, provider payloads, precise location, or analytics identifiers. Every projection is parsed again at the client/realtime boundary so malformed or privacy-expanding data fails closed.

## Public errors

Public errors use stable codes, a safe message, correlation id, retryability, and an optional trusted current revision. Missing and unauthorized rooms share `unauthorized-or-missing` and the message “The room is unavailable,” preventing the API from becoming a room-enumeration oracle.

Validation diagnostics are for the trusted boundary and tests. Production responses must not echo input values, capability material, internal database details, or provider errors.

## Current non-scope

This contract does not select or provision PostgreSQL, implement migrations, expose route handlers, issue capabilities, accept real rooms, or publish realtime events. Those remain CQ-201 through CQ-204 and milestone 0.4 work, with their owner and provider gates intact.
