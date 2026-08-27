# Data model

This logical model is provider-neutral. A migration is added only after ADR 0007 is resolved for milestone 0.3.

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

## Retention

Unregistered room data is temporary. The initial policy is a two-hour active TTL, a 24-hour recovery window, and deletion within seven days. Production values require privacy review and verification. Aggregate product metrics must not retain room codes, names, precise coordinates, individual votes, or constraints.

## Migration rules

- forward-only migrations;
- expand-and-contract compatibility;
- unique idempotency constraints enforced by the database;
- destructive retention jobs tested against explicit bounded targets;
- migration verification in an isolated database before production approval.
