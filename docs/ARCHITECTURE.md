# Architecture

## Repository boundaries

```text
apps/web/            Next.js application, accessible UI, server actions and route handlers
packages/domain/     Deterministic constraints, scoring, outcome reasons, versioned contracts
packages/security/   Server-only capability issuance, hashing, scope and transport primitives
packages/persistence/Portable PostgreSQL migrations and persistence verification
docs/                Product, architecture, security, operations, milestones and ADRs
.github/             Contribution policy, issue intake and delivery automation
```

## Target topology

```text
Browser/PWA
  -> Next.js server boundary
       -> room application service
            -> transactional room/event store (authority)
            -> decision engine package (pure/versioned)
            -> outbox/realtime publisher
       -> place-provider adapter -> cache -> licensed provider

Realtime subscriber -> UI projection only
Analytics adapter   -> minimized aggregate events only
```

Milestones 0.1–0.2 implement the browser shell and pure domain package. Milestone 0.3 adds provider-neutral persistence and server-only security packages before public room endpoints. Target components do not imply that a provider migration, Production resource, or public API is authorized.

## Module boundaries

- `room`: lifecycle, expiry, host capability, roster lock and participant membership;
- `constraint`: declaration, visibility, validation and feasibility filtering;
- `candidate`: normalized option facts with provenance and freshness;
- `vote`: accepted reactions, sequence, idempotency and submission state;
- `decision`: deterministic evaluation, explanation and rule version;
- `handoff`: map/share and later reservation/order transitions;
- `provider`: external place/realtime/storage/analytics adapters;
- `audit`: security and operational facts without sensitive payloads.

Provider DTOs terminate at adapters. Domain entities contain normalized facts plus field-level provenance and confidence where required.

## Room lifecycle

```text
DRAFT -> LOBBY -> ROSTER_LOCKED -> CANDIDATES_READY -> VOTING
      -> RESOLVING -> DECIDED -> COMMITTED -> EXPIRED
                           \-> NO_SAFE_RESULT
```

Transitions are compare-and-set operations against a room revision. Duplicate commands return the existing result. Invalid transitions fail visibly.

The two-hour wall-clock TTL is also authoritative: after it passes, authenticated
reads project `EXPIRED` even if the stored phase has not been materialized, and
all commands fail before mutation. `room.end` reaches the same terminal state
through the command transaction. A separate bounded worker deletes the aggregate
after its retention deadline; expiry never depends on that worker running.

## Authority and realtime

Clients submit commands with participant capability, room revision, command id, and participant sequence. The server authenticates, validates, commits, computes any resulting transition, and appends an outbox event in one transaction. Realtime publishes the committed projection. Clients reconcile from the server after reconnect; they never elect a master client.

## Failure behavior

- Place provider unavailable: retain host-added or previously validated candidates; otherwise show “unable to build a trustworthy list.”
- Realtime unavailable: bounded polling/reconnect with visible degraded state.
- Duplicate or reordered vote: idempotent acknowledgement or sequence rejection.
- Participant disconnect: roster membership remains fixed for a grace period, then the host chooses wait, remove-and-restart, or apply the predeclared quorum rule.
- No feasible candidate: stop before voting and explain which constraints conflict without identifying a participant.
- Persistence unavailable: do not claim that a vote or decision was saved.
