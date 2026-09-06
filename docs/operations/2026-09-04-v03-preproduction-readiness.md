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

## Deferred product acceptance

- CQ-106 must record physical iOS/Android installability and device behavior.
- CQ-107 must record the moderated decision-loop sessions and meet its stated
  success threshold.
- The owner has deferred these human-evidence gates to 0.6.0 closed beta. They
  remain open and are not passed or closed. Versions 0.2 and 0.2.1 remain in
  `Acceptance`; version 0.3 may proceed only as a controlled Production beta.
- The bounded evidence worksheet is
  [product-acceptance-session-record.md](product-acceptance-session-record.md).
  Only observations from physical devices and real moderated participants count;
  an automated agent must not fill or attest those rows.

If a deployable prerelease is needed before those human gates close, use a
SemVer prerelease such as `0.3.0-preview.1`; do not present it as stable
`0.3.0`.

## Production resource checklist

| Item                                                     | State                                      | Evidence / remaining gate                                                                                                                                     |
| -------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Independent Production Neon project                      | Complete                                   | `consensus-production` / `still-shape-81533129`; no non-production data or credentials reused                                                                 |
| Distinct migration/runtime identities and NOLOGIN groups | Complete                                   | Runtime cannot create database/schema objects or assume migrator                                                                                              |
| Secret scoping                                           | Complete                                   | Direct migration URL only in protected GitHub `Production`; pooled runtime URL and unique pepper only in Vercel Production                                    |
| Reviewed migrations `0001`–`0005`                        | Complete                                   | Five checksummed ledger entries and ten application tables                                                                                                    |
| Fail-closed application gate                             | Complete                                   | Vercel Production has `CONSENSUS_ROOM_CREATION_ENABLED=false`                                                                                                 |
| Recovery branch/schema/permission proof                  | Complete                                   | 0.22-second fork, five migrations, ten tables, one synthetic room/participant; cleanup verified zero rooms/participants and the sole temporary branch removed |
| Retention contract                                       | Implemented; Production activation pending | Daily 03:00 UTC Vercel Cron, fixed batches of 100, `CRON_SECRET` Bearer authentication, count-only response; verify it before room creation is enabled        |
| Error and capacity monitoring                            | Defined; activation review pending         | Vercel logs/Observability plus Neon usage; thresholds in `docs/OBSERVABILITY.md`                                                                              |
| Cost envelope                                            | Complete for pre-launch                    | Neon Free UI: 0.5 GB, 100 CU-hours/project, scale to zero; Vercel Hobby limits apply; owner is budget decision-maker                                          |
| Staged current-main artifact                             | Complete                                   | READY `n64AmruEG8W2WzLW5SL54VJA3qKt`, `a9fe3ee`, custom domains skipped                                                                                       |
| Product acceptance                                       | Deferred to 0.6.0                          | CQ-106 physical devices and CQ-107 ten moderated sessions remain mandatory for stable product claims                                                          |

Full non-secret provider and rehearsal evidence is in
[the Production provisioning record](2026-09-04-neon-production-provisioning.md).

## Exact release path

```text
merge the retention and acceptance-deferral PR under exact approval
  -> save a unique Production-only CRON_SECRET and enable bounded deletion
  -> inspect the Vercel Cron registration and verify one authenticated sweep
  -> inspect logs, deletion count, and alerting/capacity controls
  -> inspect a READY, release-SHA, non-aliased Production candidate
  -> enable Production room creation only as part of the approved launch window
  -> promote the exact candidate under exact approval
  -> run Production smoke/log/data-boundary checks
  -> gather CQ-106/CQ-107 evidence in the 0.6.0 closed beta
  -> only then prepare, tag, and publish a stable v0.3.0 release under separate approvals
```

Merging code or documentation does not authorize any later step. A successful
Preview run does not authorize Production. A Production promotion does not
authorize a tag or GitHub Release.
