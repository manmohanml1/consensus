# Database recovery and teardown runbook

This runbook covers PostgreSQL room persistence. It is executable documentation,
not standing authorization for a migration, restore, credential change, data
deletion, provider teardown, paid resource, or Production action.

## Recovery objectives by environment

| Environment         | Data allowed                        | Recovery contract                                                                           |
| ------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------- |
| CI/local disposable | Synthetic test data only            | Recreate or restore during the job; no durability promise                                   |
| Development/Preview | Synthetic non-production rooms only | Provider recovery capability plus verified logical export before a destructive change       |
| Production          | Not approved in milestone 0.3       | Define and rehearse RPO/RTO, backup retention, restore access, and cost before provisioning |

The selected Neon Free recovery window is a provider limit, not an application
SLO. A Production proposal must replace this table with measured RPO/RTO and a
budgeted backup policy.

## Automated disposable rehearsal

The Quality workflow runs:

```text
CONSENSUS_RECOVERY_REHEARSAL=true
CONSENSUS_TEST_DATABASE_URL=<localhost database containing "test">
pnpm --filter @consensus/persistence test:recovery
```

The script refuses remote hosts and non-test database names. It applies the exact
ordered migrations, creates one synthetic fixture, takes a PostgreSQL-consistent
template snapshot into a uniquely named disposable restore database, verifies the
migration ledger and fixture, drops the restore database, drops the two
application schemas from the source, and verifies teardown. It never prints a
connection string, database name, room identifier, capability, or payload.

This proves schema/fixture recoverability and destructive teardown mechanics. It
does not prove a hosted provider backup, cross-region recovery, or Production
RPO/RTO.

## Hosted non-production rehearsal

The owner-authorized Neon rehearsal on 2026-09-03 created one temporary child
branch from the current shared non-production `main` recovery point, verified
the five migration ledger entries, runtime role separation, one synthetic
aggregate, cascade deletion, and zero follow-up counts, then deleted only that
temporary branch. The default branch and provider project remained active. See
[the non-secret evidence record](2026-09-03-neon-hosted-recovery-rehearsal.md).

## Before an authorized shared migration

1. Record the exact environment, commit SHA, ordered migration names/checksums,
   expected lock/write impact, and authorizing owner statement.
2. Confirm the direct migration identity and pooled runtime identity are distinct;
   neither value may appear in logs or command history.
3. Stop if the provider recovery window, available storage, or restore target is
   insufficient for the proposed change.
4. Create a provider recovery point and a schema-only logical export using a
   PostgreSQL client version equal to or newer than the server. Encrypt the export
   at rest and assign a deletion deadline.
5. Restore into an isolated non-production target. Apply the same verification
   queries used by CI: migration ledger, expected schema, one synthetic aggregate,
   runtime grants, and aggregate deletion.
6. Only after restore verification, run the forward migration from the reviewed
   commit and record non-secret evidence.

## Failure and forward recovery

- Before migration commit: the migration transaction rolls back; verify the ledger
  and application health before retrying.
- After migration commit: do not run a down migration and do not deploy older code
  that is incompatible with the schema. Disable affected writes, preserve
  redacted evidence, and ship a reviewed forward-fix migration.
- Data corruption or loss: isolate writes, select the authorized recovery point,
  restore to a separate target, verify before any traffic switch, and document
  the actual recovery point and elapsed recovery time.
- Credential exposure: revoke/rotate first, update only the approved environment
  scopes, and verify the former credential no longer connects.

## Retention deletion operation

Run the worker only from an approved server-side environment:

```text
CONSENSUS_RETENTION_DELETE_ENABLED=true
CONSENSUS_RETENTION_DELETE_LIMIT=100
pnpm --filter @consensus/persistence retention:delete
```

The worker deletes only aggregates whose `deletion_due_at` is due, in batches of
at most 1,000. Repeat until a run reports fewer rows than the configured limit.
Record timestamp, environment, commit, configured limit, deleted count, duration,
and success/failure—never room IDs or content. If backlog exceeds policy, disable
new room creation, preserve the database, investigate worker failures, and resume
only bounded sweeps after the cause is understood.

## Provider teardown

Provider teardown is destructive and separately authorized. For the approved
non-production resource:

1. Stop new room creation/joining and wait for in-flight commands to drain.
2. Run due retention sweeps; record counts only.
3. Create the final encrypted logical export and restore it to a disposable target.
4. Verify the migration ledger, synthetic fixture, runtime grants, and aggregate
   deletion in that target.
5. Remove `CONSENSUS_DATABASE_URL`, `CONSENSUS_MIGRATION_DATABASE_URL`, and every
   provider-generated component variable from Development and Preview.
6. Revoke provider credentials and verify both runtime and migration connections
   fail.
7. Delete the provider resource through its control plane, then verify the resource
   and project identifier no longer resolve.
8. Delete exports/recovery points at their approved deadline and record only the
   authorization, dates, provider/project identifier, evidence links, and outcome.

Never copy shared data into CI, paste connection values into issues, or treat
disconnecting a Vercel integration as proof that provider data was deleted.
