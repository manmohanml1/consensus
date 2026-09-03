# CQ-212: Migration, backup, restore, and provider teardown

**Milestone:** 0.3.0  
**Type:** operations  
**Depends on:** CQ-201, CQ-202

**Status:** provider-neutral rehearsal complete; hosted Neon restore/teardown
evidence awaits separate exact owner authorization.

Keep database changes forward-only and make restore/teardown procedures
repeatable without exposing credentials or room data.

**Done when:**

- CI creates a local PostgreSQL test database from the migrated source database,
  verifies all migration-ledger entries plus a synthetic room/participant, then
  removes the restore database and source schemas;
- the rehearsal requires an explicit opt-in, accepts localhost only, and requires
  a database name containing `test` before any destructive operation;
- the runbook defines pre-migration recovery points, logical export, isolated
  restore verification, forward-fix behavior, credential revocation, and
  provider teardown verification;
- logs and evidence contain counts, schema versions, checksums, dates, and
  provider identifiers only—never URLs, credentials, capabilities, or payloads.

## Owner gates

The CI rehearsal proves the provider-neutral procedure against disposable data.
Applying migrations to the shared Neon project, creating a provider recovery
point, running a shared restore, deleting the Neon resource, configuring
Production, or promoting Production each requires its own explicit authorization.
