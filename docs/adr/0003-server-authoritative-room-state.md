# ADR 0003: Server-authoritative room state

**Status:** Accepted

## Context

Peer broadcast and master-client resolution allow forged votes, duplicate processing, split-brain matches, and outcome changes when presence fluctuates.

## Decision

Persist room commands and aggregate revisions transactionally. The server authenticates room-scoped capabilities, enforces idempotency and sequence, locks the voter roster, runs the decision engine, and appends an outbox event. Realtime transports committed projections only.

## Consequences

Milestone 0.3 requires transactional storage before real rooms; milestone 0.4 adds realtime. A client-only multiplayer room is not an acceptable intermediate production architecture.
