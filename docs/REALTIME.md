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

Events include `eventId`, `roomId`, `roomRevision`, `type`, `occurredAt`, and a minimum client-safe payload. They exclude capability tokens, private constraint ownership, provider secrets, and precise location when unnecessary.

## Recovery

- Ignore an event at or below the client’s applied revision.
- On a revision gap, fetch the current authorized projection.
- Queue unsent commands locally only with an expiry and visible pending state.
- After reconnect, submit each command id once and accept server reconciliation.
- Never resolve a match from uncommitted peer broadcasts.

## Performance targets

Measure p50/p95/p99 command acknowledgement and projection delay separately. Initial beta objectives are p95 under 750 ms for acknowledgement and under 1.5 seconds for visible peer convergence on supported networks. These are service objectives, not universal mobile-network guarantees.
