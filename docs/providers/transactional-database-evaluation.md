# CQ-201 transactional database evaluation

**Decision date:** 2026-08-31  
**Scope:** non-production room persistence only  
**Selected provider:** Neon PostgreSQL; owner-approved non-production provisioning began 2026-08-31

| Criterion                   | Neon PostgreSQL                                                                       | Supabase Postgres                                                                  | Decision impact                                         |
| --------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Database model              | PostgreSQL                                                                            | PostgreSQL                                                                         | Both preserve transactional room authority.             |
| Published Free allowance    | 0.5 GB/project; 100 CU-hours/project/month; 5 GB public transfer/month; scale-to-zero | 500 MB/project; pauses after one week inactive                                     | Neon is selected for disposable validation sessions.    |
| Recovery on Free            | Up to 6 hours of time travel/restores                                                 | No automatic backups or point-in-time recovery                                     | Neither is acceptable as a production recovery promise. |
| Realtime coupling           | None selected by this decision                                                        | Bundled Realtime, but 200 Free peak connections                                    | Keep realtime separate for CQ-301.                      |
| Portability                 | Standard PostgreSQL export/migrations                                                 | Standard PostgreSQL export/migrations                                              | Keep SQL/provider-neutral application boundary.         |
| Spend control               | No paid plan or payment method in this scope                                          | No paid plan or payment method in this scope                                       | Any paid upgrade needs a new owner decision.            |
| Commercial/production terms | Free plan is published for building and learning; recheck terms before provisioning   | Free plan is published for hobby/experiment use; recheck terms before provisioning | This decision does not approve commercial production.   |

## Provisioning gate

The owner must explicitly authorize a single non-production project before anyone:

1. creates the project;
2. stores its connection string in the non-production environment; or
3. runs a migration against it.

The owner authorized item 1 and the non-production secret connection on 2026-08-31. This authorization does not include the first migration, Production credentials, a paid plan, or teardown. Current state is tracked in [the provisioning record](../operations/2026-08-31-neon-nonproduction-provisioning.md).

Use no production or personal data. Record only environment names, provider project
identifier, approval date, migration version, and teardown date in the operating
record—never the connection string or credentials.

## Non-production environment contract

Reserve these server-only names before CQ-202 adds a database client:

- `CONSENSUS_DATABASE_URL`: pooled application connection used only by server-side room persistence in Development and explicitly approved Preview environments;
- `CONSENSUS_MIGRATION_DATABASE_URL`: direct, least-privileged migration connection used only by an owner-approved migration command or protected workflow.

Neither variable is public, exposed to browser bundles, available to pull-request jobs, or configured in Vercel Production during milestone 0.3. Local values belong only in an ignored developer environment file. Hosted values belong only in the matching non-production environment. CQ-202 must define separate runtime and migration roles, validate that missing configuration fails closed, and ensure logs expose neither URL.

## Teardown and recovery

Teardown is an owner-approved, non-production-only action. First export a sanitized
schema/fixture proof, verify a restore into a disposable target, revoke both named
environment variables, then delete the provider project. A teardown is not a
production deletion plan; CQ-212 adds the production-grade migration, backup,
restore, and teardown runbook after the schema exists.
