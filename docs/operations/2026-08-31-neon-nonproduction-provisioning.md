# Neon non-production provisioning record

**CQ:** CQ-201 / GitHub #10  
**Owner authorization:** 2026-08-31  
**Provisioning date:** 2026-08-31 (America/New_York)  
**Status:** Provider selection, provisioning, migration, least-privilege runtime
access, protected Preview activation, and hosted restore-branch rehearsal are
complete. Deleting the provider project remains a separate destructive gate.

## Resource

- Provider path: Vercel Marketplace native Neon integration
- Vercel project: `consensus-web` (`prj_Puscld2yZYwde6LN7mdHpJOTJv9j`)
- Vercel scope: `team_U2D8pDEjIc8Ct8gsmSfMAbJm`
- Resource name: `consensus-nonprod`
- Vercel store ID: `store_WXM6yIYRyGIe5lu6`
- Neon project ID: `soft-credit-04386949`
- Region: Washington, D.C., USA East (`iad1`)
- Plan: Free; no credit card or paid upgrade
- Neon Auth: disabled
- Deployment database branches: disabled
- Data classification: synthetic non-production data only

The current published Free allowances checked at provisioning were 0.5 GB storage,
100 CU-hours per project per month, up to 2 CU, 5 GB monthly public network
transfer, scale-to-zero, and a six-hour restore window. These are provider limits,
not product reliability or production-capacity promises.

## Project connection

The resource is connected to `consensus-web` for Vercel Preview and Development
only. Production is unchecked. Vercel reports the connection as
`Preview, Development` and labels every generated value `All Pre-Production
Environments`.

The integration prefix is `CONSENSUS`, which creates:

- `CONSENSUS_DATABASE_URL` for the pooled runtime connection;
- `CONSENSUS_DATABASE_URL_UNPOOLED` for the provider-managed direct connection;
- provider-generated component variables under the same prefix.

The owner separately authorized creating `CONSENSUS_MIGRATION_DATABASE_URL` from
the managed unpooled value. Vercel stores it as a Secret in two entries:

- Preview;
- Development.

There is no Production entry.

No current values are recorded in Git, documentation, issue comments, terminal
logs, or CI. Preview consumes the pooled URL through the server-only room API;
Development has the URL but no shared capability pepper, and Production has no
application database values.

## Connectivity evidence

After owner two-factor verification, the Vercel Neon query console ran this
read-only metadata check successfully:

```sql
SELECT current_database() AS database_name,
       current_user AS database_user,
       current_setting('server_version') AS server_version;
```

Observed result: database `neondb`, role `neondb_owner`, PostgreSQL
`18.6 (c5250a2)`, one row in 860 ms. The console read-only control was enabled.
No schema or data mutation ran.

## Credential rotation

While creating the migration alias, Vercel's accessibility representation exposed
the then-current unpooled value despite the destination field being configured as
Secret. The unsaved alias form was discarded immediately. All Neon integration
secrets for `consensus-nonprod` were rotated with the reason recorded in Vercel,
invalidating the exposed value. The alias was then created from the rotated value
without rendering it, and the in-memory copy was cleared. No application or
Production environment consumed the old credential.

## First shared migration evidence

The owner authorized the exact first-migration bootstrap and the five reviewed
forward migrations from merged commit
`2fc5d2045cf872df404a3f7094187df2b74890ad` on 2026-09-02
(America/New_York). The operation targeted this resource only; it did not use a
Production credential or alter a Production deployment.

- The query-console identity created the NOLOGIN `consensus_migrator` and
  `consensus_runtime` groups, received `consensus_migrator` membership, and
  granted that group database `CREATE`.
- `PUBLIC` no longer has `CREATE` on the `public` schema.
- Migrations `0001_room_aggregate.sql` through `0005_host_recovery.sql`
  committed under `consensus_migrator` with the repository checksums recorded in
  `consensus_internal.schema_migrations`.
- The ledger contains exactly five ordered entries. Runtime-group evidence is
  positive for `consensus` schema usage, room CRUD, command select/insert, and
  host-recovery CRUD.
- The applied `consensus` schema contains the ten expected tables: candidates,
  commands, commitments, constraints, decisions, host-recovery challenges,
  outbox events, participants, rooms, and votes.

The query console was returned to read-only after verification. No synthetic
room data was inserted during this schema-only operation.

## Remaining gates

- A distinct pooled login named `consensus_runtime_app` now inherits only
  `consensus_runtime`. Verification recorded login enabled, superuser/database
  creation/role creation disabled, `consensus_migrator` membership absent,
  database connect present, database and `public` schema creation absent, and
  `consensus` schema usage present.
- The owner-authorized protected Preview smoke created one synthetic lobby room,
  returned HTTP `201`, and then deleted the aggregate and its cascaded test rows;
  the follow-up count was zero. See the dedicated activation record.
- CQ-212 adds a localhost-only disposable schema/fixture recovery and teardown
  rehearsal plus the shared-provider runbook. Its separately authorized hosted
  rehearsal was completed on 2026-09-03 and deleted only its temporary branch.

CQ-201 provider selection and non-production activation and CQ-212 hosted
restore-branch evidence are complete. No full provider-project teardown,
Production deployment, tag, release, or Production application configuration is
authorized by this record.

## Sources checked 2026-08-31

- [Neon pricing](https://neon.com/pricing)
- [Neon network transfer](https://neon.com/docs/introduction/network-transfer)
- [Neon for Vercel Marketplace](https://vercel.com/marketplace/neon/neon)
