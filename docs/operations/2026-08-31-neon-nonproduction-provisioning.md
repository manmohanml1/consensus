# Neon non-production provisioning record

**CQ:** CQ-201 / GitHub #10  
**Owner authorization:** 2026-08-31  
**Provisioning date:** 2026-08-31 (America/New_York)  
**Status:** In progress; the first owner-authorized shared migration completed on
2026-09-02 (America/New_York). Runtime activation, restore evidence, and teardown
remain separately gated.

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
logs, or CI. The application does not consume these variables yet.

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

- Provision and verify a distinct pooled runtime login with only
  `consensus_runtime` membership before enabling application use of
  `CONSENSUS_DATABASE_URL`. That runtime activation remains separately owner
  authorized.
- CQ-212 adds a localhost-only disposable schema/fixture recovery and teardown
  rehearsal plus the shared-provider runbook. Its CI evidence does not authorize
  a Neon restore or teardown; each remains a destructive, separately authorized
  action.

CQ-201 remains open until recovery/teardown evidence is complete. No Production
deployment, tag, release, migration, schema, or application code change is
authorized by this record.

## Sources checked 2026-08-31

- [Neon pricing](https://neon.com/pricing)
- [Neon network transfer](https://neon.com/docs/introduction/network-transfer)
- [Neon for Vercel Marketplace](https://vercel.com/marketplace/neon/neon)
