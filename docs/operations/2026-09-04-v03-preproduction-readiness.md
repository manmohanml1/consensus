# v0.3 pre-Production readiness

**Date:** 2026-09-04 EDT  
**Baseline:** merged `main` commit `a9fe3eeeef4d12ded26a4a9f6c2e9c70f4a17d08`  
**Decision:** technical secure-room exit passed; Production remains unchanged

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

If a deployable prerelease is needed before those human gates close, use a
SemVer prerelease such as `0.3.0-preview.1`; do not present it as stable
`0.3.0`.

## Production resource checklist

None of these items is authorized by this record:

1. Create an independent Production Neon project/database; never reuse the
   shared non-production branch, credentials, or data.
2. Create separate Production NOLOGIN group roles plus distinct migration and
   runtime login identities. Revoke `PUBLIC` schema creation and prove the
   runtime identity cannot migrate or create objects.
3. Store the Production migration URL only in the owner-controlled migration
   path and the pooled runtime URL only in Vercel Production.
4. Generate a unique Production capability pepper. Never copy the Preview
   pepper, and record the capability-invalidating rotation procedure.
5. Apply only reviewed migrations `0001`–`0005` with checksum verification,
   then run read-only schema and privilege checks before application activation.
6. Approve the 24-hour room lifetime, terminal-expiry behavior, bounded deletion
   cadence, data-owner response path, and count-only deletion logging for
   Production.
7. Define alerting for elevated 5xx/429 rates, migration failure, deletion lag,
   database saturation, and unexpected authorization failures without logging
   locators, capabilities, votes, constraints, or precise location.
8. Record the free/paid service limits, budget owner, usage alerts, and the
   threshold at which new room creation must fail closed.
9. Complete an owner-authorized Production database recovery rehearsal using
   synthetic data and an independently disposable branch or project.
10. Identify both rollback layers: the last known-good Vercel deployment and a
    schema-compatible database recovery point. Verify application compatibility
    before any alias movement.

## Exact release path

```text
close CQ-106/CQ-107 acceptance evidence
  -> merge this CQ-214 exit reconciliation under exact approval
  -> prepare a dedicated release/v0.3.0 branch and version PR
  -> merge that release PR under exact approval
  -> provision and verify Production resources under exact approval
  -> apply reviewed Production migrations under exact approval
  -> inspect a READY, current-main, non-aliased Production candidate
  -> promote the exact candidate under exact approval
  -> run Production smoke/log/data-boundary checks
  -> create the annotated tag under separate exact approval
  -> publish the GitHub Release under separate exact approval
```

Merging code or documentation does not authorize any later step. A successful
Preview run does not authorize Production. A Production promotion does not
authorize a tag or GitHub Release.
