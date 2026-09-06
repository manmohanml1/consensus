# CQ-214: Secure-room threat model and exit review

**Milestone:** 0.3.0

**Type:** security

**Depends on:** CQ-207, CQ-208, CQ-209, CQ-210, CQ-211, CQ-212, CQ-213, CQ-215

**Status:** final technical application-security pass; product acceptance remains open

## Review coverage

The v0.3 implementation and tests cover capability theft boundaries, CSRF,
replay and duplicate commands, invitation fixation/enumeration, immutable voter
rosters, retention deletion, host recovery rotation, migration identity
separation, CSP script execution, and privacy-minimized projections. The complete
control rationale is maintained in `docs/THREAT_MODEL.md`.

| Release-critical finding                                | Owner / evidence                           | Decision |
| ------------------------------------------------------- | ------------------------------------------ | -------- |
| Capability or locator becomes client-visible authority  | CQ-203/CQ-206/CQ-210 tests                 | Pass     |
| Cross-origin or replayed mutation changes room state    | CQ-204/CQ-211 route and integration tests  | Pass     |
| Dropout or late join changes a locked electorate        | CQ-207/CQ-211 concurrency tests            | Pass     |
| Lost host authority can be silently recovered           | CQ-209 one-use transfer and rotation tests | Pass     |
| Expired aggregate remains mutable or partially deleted  | CQ-208 retention/race tests                | Pass     |
| Runtime can assume migration or schema-owner privileges | CQ-201 runtime-role verification           | Pass     |
| Hosted recovery or teardown cannot be demonstrated      | CQ-212 owner-gated rehearsal               | Pass     |
| Fixture UI is mistaken for a working multi-user product | CQ-215 connected two-browser journey       | Pass     |

## Exit decision

The technical secure-room exit receives a final pass: no unresolved
release-critical code finding was identified in the reviewed backend or
connected-browser surface. CQ-215 proved the host, admitted participant, denied
participant, recovered host, revoked-host, and missing-room paths in isolated
browser contexts during the single-attempt protected-Preview run
[33901645276](https://github.com/manmohanml1/consensus/actions/runs/33901645276)
at commit `b080059`. Responsive-overflow and unexpected browser/page-error
checks also passed, and the exact synthetic aggregate was removed with zero
dependent residue. CQ-212's owner-authorized hosted recovery/teardown rehearsal
is complete.

This security decision does not declare the full product milestone complete.
CQ-106 physical-device/PWA acceptance and CQ-107 moderated usability evidence
remain open, so roadmap 0.3 stays in `Acceptance`. Production resources,
application secrets, migrations, promotion, semantic-version tags, and GitHub
Releases remain outside this decision and retain their separate owner gates.
