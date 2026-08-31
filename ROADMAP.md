# Roadmap

| Version | Product proof                                                                              | Status     |
| ------- | ------------------------------------------------------------------------------------------ | ---------- |
| 0.1.0   | Repository contracts, decision-engine foundation, and accessible single-device slice       | Complete   |
| 0.2.0   | Host-created food decision with manual/curated candidates and no account requirement       | Complete   |
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

## Active issues

[CQ-205 / GitHub #14](https://github.com/manmohanml1/consensus/issues/14) is the first milestone 0.3 implementation slice: versioned, provider-neutral room protocol contracts. [CQ-201 / GitHub #10](https://github.com/manmohanml1/consensus/issues/10) selects Neon PostgreSQL for disposable non-production use in ADR 0012, but cannot provision it without explicit owner approval.

[CQ-106 / GitHub #8](https://github.com/manmohanml1/consensus/issues/8) remains an acceptance follow-up for physical iOS/Android installation evidence and the explicit Vercel access-control decision. The owner explicitly started 0.3 while that device-only evidence remains open; this does not mark CQ-106 complete or weaken its acceptance criteria.

The complete 0.3–1.0 catalog contains 100 independently reviewable items in [docs/planning/BACKLOG.md](docs/planning/BACKLOG.md).
