# v0.3 pre-Production readiness

**Date:** 2026-09-04 EDT  
**Baseline:** merged `main` commit `a9fe3eeeef4d12ded26a4a9f6c2e9c70f4a17d08`  
**Decision:** technical secure-room exit passed; Production resources are
prepared and fail-closed; the public alias remains unchanged

## Proven before Production

- Migrations `0001`–`0005` passed disposable PostgreSQL verification, were
  applied to shared non-production Neon under an owner gate, and passed a
  temporary restore-branch recovery/teardown rehearsal.
- Preview uses a distinct least-privilege runtime login that cannot create
  database objects or assume the migration role.
- The connected mobile-first host/participant journey passed ordinary CI and
  the single-attempt protected-Preview run
  [33901645276](https://github.com/manmohanml1/consensus/actions/runs/33901645276)
  at commit `b080059`.
- The final synthetic room and all dependent rows were removed under an exact,
  separately authorized cleanup. Zero matching residue remained.
- CQ-214 found no unresolved release-critical security issue in the reviewed
  database, API, capability, lifecycle, or connected-browser boundary.

## Product acceptance still required

- CQ-106 must record physical iOS/Android installability and device behavior.
- CQ-107 must record the moderated decision-loop sessions and meet its stated
  success threshold.
- These inherited gates keep roadmap versions 0.2, 0.2.1, and 0.3 in
  `Acceptance`. They prevent an honest stable v0.3.0 declaration even though
  the technical secure-room exit has passed.
- The bounded evidence worksheet is
  [product-acceptance-session-record.md](product-acceptance-session-record.md).
  Only observations from physical devices and real moderated participants count;
  an automated agent must not fill or attest those rows.

If a deployable prerelease is needed before those human gates close, use a
SemVer prerelease such as `0.3.0-preview.1`; do not present it as stable
`0.3.0`.

## Production resource checklist

| Item                                                     | State                              | Evidence / remaining gate                                                                                                                                     |
| -------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Independent Production Neon project                      | Complete                           | `consensus-production` / `still-shape-81533129`; no non-production data or credentials reused                                                                 |
| Distinct migration/runtime identities and NOLOGIN groups | Complete                           | Runtime cannot create database/schema objects or assume migrator                                                                                              |
| Secret scoping                                           | Complete                           | Direct migration URL only in protected GitHub `Production`; pooled runtime URL and unique pepper only in Vercel Production                                    |
| Reviewed migrations `0001`–`0005`                        | Complete                           | Five checksummed ledger entries and ten application tables                                                                                                    |
| Fail-closed application gate                             | Complete                           | Vercel Production has `CONSENSUS_ROOM_CREATION_ENABLED=false`                                                                                                 |
| Recovery branch/schema/permission proof                  | Complete                           | 0.22-second fork, five migrations, ten tables, one synthetic room/participant; cleanup verified zero rooms/participants and the sole temporary branch removed |
| Retention contract                                       | Defined; invocation pending        | Daily bounded batches of 100, 24-hour deletion-lag alert, count-only logs; scheduler must be verified before room creation is enabled                         |
| Error and capacity monitoring                            | Defined; activation review pending | Vercel logs/Observability plus Neon usage; thresholds in `docs/OBSERVABILITY.md`                                                                              |
| Cost envelope                                            | Complete for pre-launch            | Neon Free UI: 0.5 GB, 100 CU-hours/project, scale to zero; Vercel Hobby limits apply; owner is budget decision-maker                                          |
| Staged current-main artifact                             | Complete                           | READY `n64AmruEG8W2WzLW5SL54VJA3qKt`, `a9fe3ee`, custom domains skipped                                                                                       |
| Product acceptance                                       | Pending human evidence             | CQ-106 physical devices and CQ-107 ten moderated sessions                                                                                                     |

Full non-secret provider and rehearsal evidence is in
[the Production provisioning record](2026-09-04-neon-production-provisioning.md).

## Exact release path

```text
merge this CQ-214 exit reconciliation under exact PR approval
  -> complete and owner-attest CQ-106/CQ-107 acceptance evidence
  -> prepare a dedicated release/v0.3.0 branch and version PR
  -> merge that release PR under exact approval
  -> verify the bounded Production retention invocation
  -> inspect a READY, release-SHA, non-aliased Production candidate
  -> enable Production room creation only as part of the approved launch window
  -> promote the exact candidate under exact approval
  -> run Production smoke/log/data-boundary checks
  -> create the annotated tag under separate exact approval
  -> publish the GitHub Release under separate exact approval
```

Merging code or documentation does not authorize any later step. A successful
Preview run does not authorize Production. A Production promotion does not
authorize a tag or GitHub Release.
