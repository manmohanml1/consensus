# CQ-214: Secure-room threat model and exit review

**Milestone:** 0.3.0  
**Type:** security  
**Depends on:** CQ-207, CQ-208, CQ-209, CQ-210, CQ-211, CQ-212, CQ-213  
**Status:** conditional pass; CQ-212 hosted recovery/teardown evidence remains open

## Review coverage

The v0.3 implementation and tests cover capability theft boundaries, CSRF,
replay and duplicate commands, invitation fixation/enumeration, immutable voter
rosters, retention deletion, host recovery rotation, migration identity
separation, CSP script execution, and privacy-minimized projections. The complete
control rationale is maintained in `docs/THREAT_MODEL.md`.

| Release-critical finding                                | Owner / evidence                           | Decision                         |
| ------------------------------------------------------- | ------------------------------------------ | -------------------------------- |
| Capability or locator becomes client-visible authority  | CQ-203/CQ-206/CQ-210 tests                 | Pass                             |
| Cross-origin or replayed mutation changes room state    | CQ-204/CQ-211 route and integration tests  | Pass                             |
| Dropout or late join changes a locked electorate        | CQ-207/CQ-211 concurrency tests            | Pass                             |
| Lost host authority can be silently recovered           | CQ-209 one-use transfer and rotation tests | Pass                             |
| Expired aggregate remains mutable or partially deleted  | CQ-208 retention/race tests                | Pass                             |
| Runtime can assume migration or schema-owner privileges | CQ-201 runtime-role verification           | Pass                             |
| Hosted recovery or teardown cannot be demonstrated      | CQ-212 owner-gated rehearsal               | Deferred; blocks final v0.3 exit |

## Exit decision

The application-security portion receives a conditional pass: no unresolved
release-critical code finding was identified in the reviewed v0.3 surface. The
milestone itself does **not** receive a final pass until CQ-212 records an
owner-authorized hosted recovery/teardown rehearsal or an explicit scope deferral
approved for the release. Production application secrets and promotion remain
outside this decision.
