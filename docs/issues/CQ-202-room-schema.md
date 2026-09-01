# CQ-202: Room schema and forward migrations

**Milestone:** 0.3.0  
**Type:** feature  
**Depends on:** CQ-201

Implement rooms, participants, constraints, candidates, commands, votes, decisions, commitments, and outbox tables with revision and idempotency constraints. Use portable forward-only SQL, separate runtime/migration privileges, and a checksum-protected runner.

**Done when:**

- ordered migrations pass disposable PostgreSQL integration tests;
- uniqueness, revision, foreign-key, cross-room, and idempotency constraints fail closed;
- retention targets and aggregate deletion are represented and tested;
- migration files are immutable after application and concurrent runners serialize;
- no provider credential, raw capability, or Production data enters source or CI.

## Execution boundary

Writing and reviewing the migration is not authorization to apply it to Neon. The
first shared non-production migration, role membership changes, Production
credentials, deployment promotion, tag, and release each retain their explicit
owner gates.
