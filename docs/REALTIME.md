# Realtime contract

Realtime is a projection channel over committed room state.

## Command path

```text
client command
  -> authorize room capability
  -> validate schema, room revision and participant sequence
  -> transaction: append command + update aggregate + append outbox
  -> acknowledge committed revision
  -> publish projection event
```

Every command includes `commandId`, `roomId`, `participantId`, `expectedRevision`, `participantSequence`, and a typed payload. The database enforces uniqueness of command ids and vote identity.

## Projection events

The v1 envelope is the privacy-minimized `RoomUpdateEvent` contract:

```json
{
  "eventVersion": "1.0.0",
  "eventId": "evt_0123456789abcdef",
  "roomId": "room_0123456789abcdef",
  "revision": 12,
  "type": "room.updated",
  "occurredAt": "2026-09-18T03:00:00.000Z"
}
```

It is a hint that a committed revision exists, not a projection. It excludes
capabilities, locators, participant data, ballots, constraints, provider
payloads, precise location, and analytics identifiers. Every recipient must use
its HTTP-only capability to fetch the current authorized projection. The parser
rejects unknown versions, types, fields, unsafe authentication-shaped keys, and
invalid revisions.

## Durable publication

Migration `0006_outbox_delivery.sql` adds bounded publish availability, an
expiring lease owner, retry attempts, poison visibility, and expiry. Publishers
claim deadline-ordered rows with `FOR UPDATE SKIP LOCKED`, publish using
`eventId` as the idempotency key, then acknowledge only the matching lease.
Expired leases are recoverable after worker failure. Provider exception text is
discarded; the database stores a bounded error code only.

The reusable publisher is deliberately transport-neutral. No provider may be
connected or provisioned until CQ-301 has an accepted comparison and explicit
owner approval. Applying migration `0006` to shared Preview or Production is a
separate migration authorization.

## Recovery

- Ignore an event at or below the client’s applied revision.
- On a revision gap, fetch the current authorized projection.
- The current browser client holds at most one uncertain command in memory and
  visibly offers an explicit retry with the same idempotency key. It does not
  persist or automatically replay an offline command queue. Expiring queued
  replay remains future work and must have separate safety and UX evidence.
- After reconnect, fetch the authorized projection; retry an uncertain command
  only with its original command id and accept server reconciliation.
- Never resolve a match from uncommitted peer broadcasts.
- Today the browser polls the authorized projection sequentially while visible
  with jittered bounded backoff, and shows `Delayed` or `Offline` on known
  interruption. Notification transport has not been connected.

## Performance targets

Measure p50/p95/p99 command acknowledgement and projection delay separately. Initial beta objectives are p95 under 750 ms for acknowledgement and under 1.5 seconds for visible peer convergence on supported networks. These are service objectives, not universal mobile-network guarantees.
