# Product reliability review — September 2026

## Evidence and limits

Reviewed deployed entry UI at https://consensus-web-navy.vercel.app/ on
2026-09-16, main `6b3a9c1`, the connected client, prototype, browser tests,
roadmap and open GitHub backlog. No production room was created for this audit.
This is not a new three-person production acceptance run or security assessment.
The deployment is the v0.3 follow-up; v0.4's twelve issues remain open.

## What went wrong

1. Infrastructure completion was treated as product completion. Durable commands
   and capabilities are valuable, but don't prove a guest can reload and finish.
2. Prototype and connected experiences diverged. The production landing rendered
   both workflows, including prototype constraints absent from connected entry.
   Existing prototype tests could pass without proving connected feature parity.
3. Tests predominantly demonstrated happy-path orchestration. The two-context
   connected test mocks APIs and manually synchronizes several transitions.
   It cannot alone establish real database, network or physical-device behavior.
4. Version numbers became a long feature checklist. Repeat groups, monetization,
   category expansion and regional failover precede launch in the old catalog,
   although the food decision loop has not passed moderated acceptance.
5. Operational documentation drifted: roadmap completion descriptions need
   reconciliation with run evidence, not another assertion that everything passed.

## Immediate corrections in this change

- GitHub Dependabot alert 1 identifies a high-severity `js-yaml` CPU-exhaustion
  advisory. The existing lockfile used 4.3.1 through the ESLint configuration
  toolchain. The lockfile now uses patched 4.3.2 with a patched-4.x override.
  This is not evidence of production exploitation. GitHub's default-branch
  alert remains open until a reviewed fix reaches main and is rescanned.

- Live entry and invitations no longer render the separate local prototype.
  The explicit `?demo=1` route preserves its visual/constraint reference and tests;
  invitation intent takes precedence over demo mode.
- Cancelled pointer gestures reset the card without submitting a vote.
- A synchronous request guard prevents overlapping user operations before React
  has rendered the disabled state; polling has an in-flight guard.
- These are bounded corrections, not completion of reconnect or realtime work.

## Next grouped delivery slices

| Priority | Outcome                                                      | Existing work to group                                                 | Required evidence                                                                                                                                                                              |
| -------- | ------------------------------------------------------------ | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1        | Resume the same member after reload; no stale state rollback | CQ-303, CQ-308, CQ-309, CQ-310                                         | Separate host and guest contexts; reload in lobby, ballot and result; delayed responses, disconnect, revoked access; no duplicate member or vote                                               |
| 2        | One coherent mobile decision flow                            | Connected UI parity follow-up, CQ-106, CQ-107                          | Host controls distinct from guest; invitation sharing; constraints reach authoritative commands; honest no-result and commitment feedback; mobile screenshots plus real device/session records |
| 3        | Useful real restaurant options                               | CQ-401–414, grouped by provider decision, discovery, and card evidence | Choose area, bounded candidates, licensed images/data when available, missing facts remain unknown, manual fallback under outage/quota                                                         |
| 4        | Food-only launch readiness                                   | Relevant CQ-5xx and CQ-9xx                                             | Moderated groups, accessibility, deletion/retention, restore evidence, spending controls and operational ownership                                                                             |

CQ-301–307's transport/outbox work should follow measured convergence and load
requirements, not precede repairing client state. Polling is not automatically
adequate at scale: measure its cost and latency, then choose a transport. Do not
remove authorization, idempotency, durability or security gates to save time.

## Proposed smaller v1.0 boundary

Ship a mobile-first food decision product: create, invite, admit, constrain,
review real or honestly manual options, vote, recover, explain a result and act
on it. Keep tablet/desktop responsive. Preserve the photo-card design without
inventing reviews, dishes, hours or venue images.

Move saved-group rituals, persistent preference profiles, paid partner flows,
revenue attribution and non-food expansion to a post-v1.0 opportunity backlog.
Keep basic map/action links, cost ceilings, accessibility, privacy and recovery
in launch scope. Advanced multi-region architecture should require measured need.
This is a scope proposal; existing milestone contracts and dependencies are not
silently rewritten or declared complete by this document.

## How to use issues now

Keep issues for acceptance outcomes and traceability, not one PR per tiny task.
Maintain only the next two slices as detailed, dependency-checked ready work.
Keep later ideas coarse until user evidence makes them worth implementing.
Each grouped PR carries its code, tests, user-visible evidence, documentation,
linked issues and rollback notes. Close only acceptance criteria actually met.
Do not close deferred ideas as implemented or use issue count as completion rate.

Before the next feature PR, reconcile the manifest, GitHub milestones and roadmap
under the agreed narrower scope. Physical-device and moderated acceptance remain
unpassed even though previously waived for the controlled production beta.

## Scheduling

Estimate the release date only after the first reliability slice and another
real group session. Use weekly demonstrable outcomes, not guaranteed dates for
every version number. A transport migration, provider commercial approval, and
participant availability are separate schedule risks. Production promotion and
PR merge still require explicit owner authorization.
