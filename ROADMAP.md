# Roadmap

| Version | Product proof                                                                              | Status     |
| ------- | ------------------------------------------------------------------------------------------ | ---------- |
| 0.1.0   | Repository contracts, decision-engine foundation, and accessible single-device slice       | Complete   |
| 0.2.0   | Host-created food decision with manual/curated candidates and no account requirement       | Acceptance |
| 0.2.1   | Mobile-first photo deck, optional swipe gestures, responsive adaptations, and PWA polish   | Acceptance |
| 0.3.0   | Durable ephemeral rooms, locked rosters, participant capabilities, and reconnect semantics | Active     |
| 0.4.0   | Authoritative realtime voting, idempotent events, recovery, and multi-device verification  | Planned    |
| 0.5.0   | Licensed place-provider adapter, constraint filtering, data quality, and graceful fallback | Planned    |
| 0.6.0   | Closed beta, commitment handoff, privacy-safe analytics, accessibility, and operations     | Planned    |
| 0.7.0   | Repeat-group utility, saved preferences with consent, and scheduled decision rituals       | Planned    |
| 0.8.0   | Reservation/order handoffs and transparent monetization experiments                        | Planned    |
| 0.9.0   | Activities expansion, scale/recovery testing, abuse defense, and decision calibration      | Planned    |
| 1.0.0   | Operable, trustworthy group-decision product with verified retention and unit economics    | Planned    |

Completion means the milestone contract and verification gates are satisfied. It never authorizes a merge, deployment, migration, tag, GitHub release, or paid resource.

## Delivery interpretation

- Mobile is the canonical experience from 0.2.1 onward. Tablet and desktop extend it with more context rather than changing the decision rules.
- The project targets zero infrastructure spend through prototype and closed-beta validation, not perpetual zero-cost commercial production.
- Live nearby discovery enters through a provider adapter in 0.5. Fixture media demonstrates the interaction before licensed venue media is available.
- Provider quotas, commercial terms, field provenance, attribution, and graceful degradation are release gates rather than implementation details.

## Current execution state

[CQ-205 / GitHub #14](https://github.com/manmohanml1/consensus/issues/14), [CQ-202 / GitHub #11](https://github.com/manmohanml1/consensus/issues/11), and [CQ-203 / GitHub #12](https://github.com/manmohanml1/consensus/issues/12) completed the protocol, portable persistence, and anonymous capability foundations. CQ-204/CQ-210 completed transactional commands and privacy-minimized projections; CQ-206/CQ-213 completed secure creation, non-authoritative invitations, and the first abuse circuit breakers; CQ-207/CQ-211 completed pending admission, locked electorates, and concurrency proof. CQ-208 completed authenticated expiry and bounded deletion, CQ-209 completed host-authorized transfer and capability rotation, and CQ-212 completed both disposable and hosted recovery/teardown evidence. [CQ-215 / GitHub #142](https://github.com/manmohanml1/consensus/issues/142) is the active mobile-first, two-browser product-integration tranche and blocks CQ-214's final exit decision. Tiny or tightly coupled backlog items should share a PR when that produces one coherent review and recovery boundary. Future shared migrations remain a separate owner gate.

The CI/CD, release-governance, security-reporting, and clean-Windows foundation corrections are merged. [CQ-198 / GitHub #114](https://github.com/manmohanml1/consensus/issues/114) remains open only for a separately authorized Production rollback-and-restore rehearsal; that operational exercise does not block provider-neutral planning but remains required before the governance work is called complete.

[CQ-107 / GitHub #129](https://github.com/manmohanml1/consensus/issues/129) and [CQ-106 / GitHub #8](https://github.com/manmohanml1/consensus/issues/8) retain the moderated-usability and physical-device acceptance evidence for 0.2/0.2.1. The owner explicitly started 0.3 while those evidence-only gates remain open; therefore both roadmap rows remain `Acceptance`, not `Complete`.

The complete 0.3–1.0 catalog contains 100 independently reviewable items in [docs/planning/BACKLOG.md](docs/planning/BACKLOG.md).
