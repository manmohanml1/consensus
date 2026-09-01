# Database migration runbook

CQ-202 uses portable PostgreSQL SQL and a small checksum-protected runner in
`packages/persistence`. This runbook describes the contract; it does not authorize
any provider mutation.

## Roles and credentials

- An administrator runs `migrations/bootstrap/roles.sql` once. It creates only
  NOLOGIN `consensus_migrator` and `consensus_runtime` group roles and revokes
  public schema creation from `PUBLIC`.
- A provider-managed migration login receives `consensus_migrator` membership and
  owns or can alter the `consensus` and `consensus_internal` schemas.
- A distinct pooled application login receives only `consensus_runtime`
  membership. It may use application tables, but accepted command and decision
  records are insert/select-only; it cannot create schemas, alter tables, manage
  roles, or read the migration connection.
- Login creation, passwords, and memberships are provider administration. They
  never appear in SQL migrations, source control, logs, issues, or pull requests.

Until those two provider login identities exist and their effective grants are
verified, the application must not consume `CONSENSUS_DATABASE_URL` and the first
Neon migration must not run.

## Forward-only execution

1. Confirm the exact commit, target environment, PostgreSQL identity, recovery
   point, expected migration list, and owner authorization.
2. Confirm `CONSENSUS_MIGRATION_DATABASE_URL` is server-only and targets the
   intended non-production database. Never print or parse its value into logs.
3. Run `pnpm --filter @consensus/persistence migrate` from the reviewed commit.
4. The runner acquires a transaction-scoped advisory lock, creates its internal
   ledger, verifies every previously applied name/checksum, and applies pending
   files in numeric order inside one transaction.
5. Verify the ledger, table constraints, effective runtime privileges, retention
   query plan, and synthetic create/delete flow. Record only non-secret evidence.

There is no `down` command. A failure before commit rolls back the transaction. A
post-commit correction is a new forward migration. Destructive contracts require
an expand-and-contract deployment and a separate recovery/restore rehearsal.

## Disposable test database

`CONSENSUS_TEST_DATABASE_URL` is accepted only by the opt-in integration suite.
The test database must be isolated, synthetic, non-production, and disposable. The
suite creates the roles/schemas, applies migrations twice, exercises constraints,
deletes a bounded room aggregate, and drops only the schemas it created.

## First Neon migration gate

Before requesting authorization, attach to the CQ-202 PR:

- green static/unit checks and disposable PostgreSQL integration evidence;
- the exact migration file checksums and target commit;
- verified migration/runtime login separation;
- a provider recovery point and restore/teardown plan;
- expected data and cost impact (currently schema-only and Free-plan bounded).

Owner authorization must name the target and commit. It does not authorize
Production credentials, promotion, a tag, a GitHub Release, or teardown.
