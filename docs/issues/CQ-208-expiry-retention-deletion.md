# CQ-208: Room expiry, retention, and deletion

**Milestone:** 0.3.0  
**Type:** privacy  
**Depends on:** CQ-202, CQ-204

Expire temporary rooms server-side and remove the complete room aggregate through
a bounded, idempotent retention worker.

**Done when:**

- natural expiry blocks every mutation and an authenticated projection reports
  the `expired` phase without revealing whether an unauthenticated room exists;
- `room.end` immediately makes the room terminal and can only shorten its
  deletion deadline;
- a deletion sweep selects at most 1–1000 due rooms in deadline order with
  `FOR UPDATE SKIP LOCKED`, deletes the aggregate through database cascades, and
  emits only a count;
- concurrent and repeated sweeps delete each due aggregate once, covering rooms,
  participants/capabilities, constraints, candidates/provider references,
  commands/stored projections, votes, decisions, commitments, and outbox payloads;
- no expired room can be revived by duplicate or concurrent commands.

## Operational boundary

`pnpm --filter @consensus/persistence retention:delete` is disabled unless
`CONSENSUS_RETENTION_DELETE_ENABLED=true` and a server-only runtime connection is
present. Adding the worker does not schedule it, enable it in Vercel, apply a
shared migration, or authorize deletion in a shared provider environment.
