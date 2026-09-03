# Database migration runbook

CQ-202 uses portable PostgreSQL SQL and a small checksum-protected runner in
`packages/persistence`. This runbook describes the contract; it does not authorize
any provider mutation.

Migration `0004_participant_roster_lifecycle.sql` adds the explicit `pending`
participant state and a partial pending-roster index. Migration
`0005_host_recovery.sql` adds one cascade-owned, expiring recovery challenge per
room and grants only runtime CRUD on that table. Both are forward-only and must
pass the same separately authorized shared-provider gate as earlier files; their
presence in a PR does not authorize applying them to Neon.

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

The persistence CI job then runs `test:recovery` against the same localhost test
database. A second explicit guard, `CONSENSUS_RECOVERY_REHEARSAL=true`, is
required. The rehearsal refuses remote hosts and database names without `test`,
recreates the schemas, inserts one synthetic fixture, clones a consistent
PostgreSQL template database, verifies all migration-ledger rows and the fixture,
then deletes the restore database and both source schemas. Output contains only
aggregate evidence. See the
[database recovery and teardown runbook](operations/database-recovery-and-teardown.md)
for shared-environment gates and forward recovery.

## First Neon migration gate

Before requesting authorization for any shared migration, attach to its pull
request or operating record:

- green static/unit checks and disposable PostgreSQL integration evidence;
- the exact migration file checksums and target commit;
- verified migration/runtime login separation;
- a provider recovery point and restore/teardown plan;
- expected data and cost impact (currently schema-only and Free-plan bounded).

Owner authorization must name the target and commit. It does not authorize
Production credentials, promotion, a tag, a GitHub Release, or teardown.

## Shared non-production evidence

The first shared Neon execution completed on 2026-09-02 (America/New_York)
against the approved non-production resource at commit
`2fc5d2045cf872df404a3f7094187df2b74890ad`. The bootstrap created the two
NOLOGIN groups, granted the migration identity `consensus_migrator` membership
and database `CREATE`, and revoked `PUBLIC` schema creation. Migrations 0001
through 0005 then committed with their repository checksums in the migration
ledger. The non-secret operational evidence is recorded in
[the provisioning record](operations/2026-08-31-neon-nonproduction-provisioning.md).

This proves schema application only. It does not authorize a separate pooled
runtime login, application consumption of the database URL, restore, teardown,
Preview promotion, Production credentials, a tag, or a release.
