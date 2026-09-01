# ADR 0013: Forward-only SQL and database role separation

**Status:** Accepted

## Context

Secure rooms require database constraints and repeatable migration evidence, but
an ORM-owned schema or owner-level runtime connection would weaken portability and
turn a compromised web process into a schema administrator. Migration execution
also must remain observable and separately owner-gated.

## Decision

Keep versioned migrations as portable PostgreSQL SQL. A repository runner orders
files by a contiguous numeric prefix, stores SHA-256 checksums, rejects edits to
applied files, serializes concurrent runners with an advisory transaction lock,
and applies pending work transactionally. Corrections are new forward migrations;
there is no automated down migration.

Use separate provider login identities mapped to NOLOGIN group roles:

- `consensus_migrator` owns/changes the application and migration-ledger schemas;
- `consensus_runtime` receives only the application-table privileges needed by
  server-side room operations, treats accepted commands and decisions as
  insert/select-only records, and has no schema-creation or role-administration
  power.

The browser receives neither credential. Pull-request integration tests use only
an isolated disposable PostgreSQL service and synthetic records.

## Consequences

- The schema does not depend on Neon APIs and can move to compatible PostgreSQL.
- Applied SQL is immutable; expand-and-contract changes require additional files.
- Role bootstrap and provider login membership are explicit administrative steps,
  not hidden application startup behavior.
- The first shared Neon migration still needs exact owner authorization and
  recovery evidence; accepting this ADR does not grant it.
