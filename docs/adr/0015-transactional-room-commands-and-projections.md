# ADR 0015: Transactional room commands and projections

**Status:** Accepted

## Context

Anonymous clients retry on weak mobile networks and may submit concurrently.
Realtime delivery cannot decide authority, and regenerating a response after an
idempotent retry can return state from a later revision. A generic database-row
serializer would also expose private votes, constraints, or provider metadata.

## Decision

Serialize commands by locking the room row in PostgreSQL. Authenticate the
room-scoped capability, compare the expected aggregate revision and actor
sequence, apply the state transition, store the normalized-command SHA-256
fingerprint and exact result projection, append its outbox event, and advance the
revision in one transaction.

Return the stored result for the same actor/idempotency key/fingerprint. Reject a
different fingerprint under that key. Snapshot `eligible_voter` when the roster
locks. Build current and command-result projections through one allowlisted query
path, validate them against the protocol, and never serialize persistence rows.

## Consequences

- Exact retries are harmless and stable even after later room changes.
- Competing valid commands serialize; stale revisions receive the trusted current
  revision and must rebase explicitly.
- Late participants remain visible but do not enter the locked electorate.
- Realtime work publishes the committed outbox projection and cannot finalize
  state independently.
- The additional migration is forward-only. Applying it to shared Neon remains a
  separate owner-authorized operation.
