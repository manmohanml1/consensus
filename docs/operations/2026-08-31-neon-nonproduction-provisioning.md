# Neon non-production provisioning record

**CQ:** CQ-201 / GitHub #10  
**Owner authorization:** 2026-08-31  
**Provisioning date:** 2026-08-31 (America/New_York)  
**Status:** In progress; connectivity and exact environment names verified; no migration has run

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

## Remaining gates

- Define separate least-privileged runtime and migration roles in CQ-202 before
  the first migration.
- Obtain separate owner authorization for the first migration.
- Verify recovery and teardown with disposable schema/fixtures. Teardown remains
  a destructive, separately authorized action.

CQ-201 remains open until recovery/teardown evidence is complete. No Production
deployment, tag, release, migration, schema, or application code change is
authorized by this record.

## Sources checked 2026-08-31

- [Neon pricing](https://neon.com/pricing)
- [Neon network transfer](https://neon.com/docs/introduction/network-transfer)
- [Neon for Vercel Marketplace](https://vercel.com/marketplace/neon/neon)
