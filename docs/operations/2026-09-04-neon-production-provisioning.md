# Neon Production provisioning and rehearsal

**Date:** 2026-09-04 EDT  
**Provider:** Neon through Vercel Marketplace  
**Resource:** `consensus-production`  
**Neon project:** `still-shape-81533129`  
**Default branch:** `main` / `br-lively-mountain-aw0y3ixs`  
**Region:** AWS US East 1 (N. Virginia)  
**PostgreSQL:** 18  
**Plan:** Free  
**Application status:** provisioned, staged, and fail-closed

## Isolation and identities

The independent Production project does not share a project, branch,
credentials, capability pepper, or data with `consensus-nonprod`. Neon Auth is
disabled. Provider-owner credentials were not connected to Vercel.

The database has two NOLOGIN group roles and two distinct login identities:

| Identity                         | Membership           | Purpose                           |
| -------------------------------- | -------------------- | --------------------------------- |
| `consensus_prod_migration_login` | `consensus_migrator` | reviewed forward migrations only  |
| `consensus_prod_runtime_login`   | `consensus_runtime`  | application and retention runtime |

`PUBLIC` cannot create in the `public` schema. The runtime identity has schema
usage and the table grants required by the application, but cannot create a
database, create in either application schema, or assume the migration role.
The migration identity alone has the database creation capability needed by the
reviewed migration contract.

An initial pair of generated login passwords appeared in provider query history
during bootstrap. They were treated as compromised before use and rotated in
Neon before any application or GitHub secret was saved. Only the rotated values
were activated. No credential value is recorded here, in source, or in issue
evidence.

## Schema and secret boundary

Reviewed migrations `0001`–`0005` from merged commit `2fc5d20` were applied in
one committed transaction with the repository SHA-256 checksums. Verification
returned five ordered ledger entries and ten application tables.

Secrets are separated by control plane:

- GitHub's protected `Production` environment holds only the direct
  `CONSENSUS_MIGRATION_DATABASE_URL`, plus the existing Vercel promotion
  credentials. It requires the owner as reviewer and is restricted to protected
  branches.
- Vercel Production holds only the pooled `CONSENSUS_DATABASE_URL` and a unique
  `CONSENSUS_CAPABILITY_PEPPER` as secret values.
- Vercel Production also has the non-secret fail-closed setting
  `CONSENSUS_ROOM_CREATION_ENABLED=false`.

Changing the capability pepper invalidates every outstanding Production room
capability. Rotation therefore requires disabling room creation, allowing or
explicitly ending active rooms, replacing the secret, redeploying an immutable
candidate, and recording the cutover. A Preview pepper must never be copied.

## Recovery rehearsal

Neon forked `consensus-prod-cq212-restore-20260904`
(`br-small-paper-aw5hr007`) from Production `main` in 0.22 seconds. On the
isolated branch, verification returned:

| Check                                                  | Result |
| ------------------------------------------------------ | ------ |
| Migration ledger entries                               | 5      |
| Application tables                                     | 10     |
| Synthetic rooms                                        | 1      |
| Synthetic participants                                 | 1      |
| Runtime is a member of `consensus_runtime`             | yes    |
| Runtime is not a member of `consensus_migrator`        | yes    |
| Runtime has the required `consensus.rooms` CRUD grants | yes    |
| Runtime cannot create a database                       | yes    |

The synthetic aggregate was named `Production recovery rehearsal 2026-09-04`
and used reserved non-user identifiers. Under the owner-authorized cleanup,
deleting `room_prod_recovery_20260904` cascaded to its participant and a
follow-up query returned zero rooms and zero participants. Neon then permanently
deleted only `br-small-paper-aw5hr007`; the branches list returned to its single
unchanged default `main` branch. The fixture and temporary branch are not
recoverable through the application store.

The provider currently exposes a six-hour history window. For this pre-launch
Free-plan boundary, the maximum recovery-point objective is six hours and the
operator recovery-time objective is 30 minutes. The 0.22-second branch fork is
only one measured component, not a claim that a complete traffic recovery has
met the 30-minute objective. Rehearse again after material schema or provider
changes and before widening Production traffic.

## Staged application candidate

After the Production values were saved, Vercel rebuilt merged `main` commit
`a9fe3eeeef4d12ded26a4a9f6c2e9c70f4a17d08` with the latest project settings.
Deployment `n64AmruEG8W2WzLW5SL54VJA3qKt` reached READY in 40 seconds at
`https://consensus-e694aaaup-manmohanlonawat-8572s-projects.vercel.app/`.
Vercel marks it `Production / Staged` and reports that custom-domain assignment
was skipped. An authenticated browser loaded the connected v0.3 shell; an
unauthenticated API probe received deployment protection rather than reaching
the application.

The public alias remains on the earlier fixture deployment. This record does
not authorize enabling room creation, moving the alias, tagging a version, or
publishing a GitHub Release.

## Activation gates still open

- complete and owner-attest CQ-106 physical-device evidence;
- complete ten CQ-107 moderated sessions and meet the 8/10 unaided threshold;
- merge the reviewed migration workflow and this record under exact PR approval;
- configure and verify the bounded daily retention invocation before changing
  `CONSENSUS_ROOM_CREATION_ENABLED` to `true`;
- inspect the final candidate, runtime logs, cost envelope, and rollback target;
- obtain exact authorization before Production promotion, tag, and release.
