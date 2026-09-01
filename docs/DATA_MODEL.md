# Data model

This logical model is provider-neutral. ADRs 0007, 0012, and 0013 authorize a portable PostgreSQL implementation while keeping provider provisioning and migration execution separately owner-gated.

## Core records

| Record       | Purpose                      | Key invariants                                                          |
| ------------ | ---------------------------- | ----------------------------------------------------------------------- |
| Room         | Temporary decision aggregate | Random id, human code, status, revision, expiry, ruleset version        |
| Participant  | Room-scoped member           | Server-issued capability hash, display name, role, join/leave state     |
| Constraint   | Hard feasibility rule        | Typed, validated, visibility-scoped, never reduced to preference        |
| Candidate    | Normalized option            | Provider id/version, field provenance, freshness, coordinates minimized |
| Vote         | Accepted reaction            | Unique room/participant/candidate, command id and sequence              |
| Decision     | Immutable resolution         | Winning candidate, eligible roster, ruleset, reason codes, scores       |
| Commitment   | Post-result response         | In/unsure/out with timestamp; cannot rewrite decision                   |
| Outbox event | Durable projection message   | Unique event id, aggregate revision, publish state                      |

The physical model lives in ordered SQL under `packages/persistence/migrations`.
Room identifiers are aggregate keys; child records use composite foreign keys so
a participant, constraint, candidate, command, vote, decision, or commitment
cannot cross room boundaries. The database uniquely enforces one host, accepted
aggregate revisions, participant command sequences, idempotency keys, and one
vote per participant/candidate pair.

Participant `capability_hash` contains only the 32-byte keyed fingerprint defined
by `packages/security`; raw capability material is delivered once and never
persisted. Reissuing or recovering a capability replaces the stored fingerprint,
immediately invalidating the earlier token. Role, room, member status, and expiry
remain separate database facts and must all match during authorization.

## Retention

Unregistered room data is temporary. The initial policy is a two-hour active TTL, a 24-hour recovery window, and deletion within seven days. Production values require privacy review and verification. Aggregate product metrics must not retain room codes, names, precise coordinates, individual votes, or constraints.

## Migration rules

- forward-only migrations;
- expand-and-contract compatibility;
- unique idempotency constraints enforced by the database;
- destructive retention jobs tested against explicit bounded targets;
- migration verification in an isolated database before production approval.

Migration files are immutable after application. Their SHA-256 checksums are
stored in `consensus_internal.schema_migrations`; a mismatch fails closed. The
runner takes an advisory transaction lock and applies every pending migration in
one transaction. There are no down migrations: corrections use a new expand or
contract migration with an explicit recovery plan.
