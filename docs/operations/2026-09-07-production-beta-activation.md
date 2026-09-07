# Production beta activation

**Date:** 2026-09-07 EDT  
**Decision:** controlled Production beta active; no stable release declared

## Exact artifact and authority

The owner approved activation of the immutable staged Production deployment:

| Field                | Value                                                                            |
| -------------------- | -------------------------------------------------------------------------------- |
| Source commit        | `ce7d25be7c11a671be96246375d5f0472af38e24`                                       |
| Candidate deployment | `dpl_59c9rNPznSaFpRAEtMQUj8s1q8ko`                                               |
| Candidate URL        | `https://consensus-2b2mxuo3f-manmohanlonawat-8572s-projects.vercel.app`          |
| Public alias         | `https://consensus-web-navy.vercel.app`                                          |
| Promotion workflow   | [34080493212](https://github.com/manmohanml1/consensus/actions/runs/34080493212) |

Before creating the candidate, the owner-approved launch window changed the
Production-only `CONSENSUS_ROOM_CREATION_ENABLED` configuration to `true`.
Vercel rebuilt the exact current-main source as a new staged Production
deployment; the existing public alias was not changed by that rebuild.

## Pre-promotion evidence

Protected multi-context acceptance run
[34075416179](https://github.com/manmohanml1/consensus/actions/runs/34075416179)
passed against the immutable candidate at the same full SHA. It exercised an
isolated host, admitted and denied guests, roster lock, voting, fair resolution,
host recovery/capability rotation, privacy-equivalent denial responses, mobile
and desktop overflow checks, and page/console error checks. The automation
received only the protected bypass secret needed to enter the Vercel deployment;
it did not receive Production database credentials or runtime secrets.

The run created one clearly labelled synthetic aggregate,
`Preview acceptance ProductionLaunch-ce7d25b`. It contains only test names and
is covered by the existing room-expiry and bounded-retention lifecycle. It was
not represented as customer data or manual acceptance evidence.

## Promotion and post-launch checks

The protected workflow completed successfully. It validated the owner-supplied
URL, project ownership, staged Production target, exact current-main SHA, and
READY state; it then promoted without rebuilding, re-read the public alias, and
performed its smoke check.

Independent post-launch checks found:

- `consensus-web-navy.vercel.app` resolves to `dpl_59c9rNPznSaFpRAEtMQUj8s1q8ko`,
  target `production`, state `READY / PROMOTED`, at the approved SHA.
- A public home-page request returned `200`.
- A manually triggered authenticated retention sweep returned `200` and emitted
  only `consensus.retention.sweep.completed { deleted: 0 }`.
- The promoted deployment had no Vercel runtime error entries in the reviewed
  post-launch window.

## Boundaries that remain

- This is a controlled beta, not stable `v0.3.0`.
- CQ-106 physical-device/PWA evidence and CQ-107 moderated-usability evidence
  remain open and deferred to the 0.6.0 closed beta.
- No annotated tag or GitHub Release was created.
- Realtime convergence, place discovery, licensed venue media, and provider
  data remain later roadmap work.
- The immediate operational brake is setting
  `CONSENSUS_ROOM_CREATION_ENABLED=false`, then promoting a reviewed candidate
  if a code rollback is required. Repointing the public alias remains an
  owner-approved action.
