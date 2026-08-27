# Roadmap

| Version | Product proof                                                                              | Status   |
| ------- | ------------------------------------------------------------------------------------------ | -------- |
| 0.1.0   | Repository contracts, decision-engine foundation, and accessible single-device slice       | Complete |
| 0.2.0   | Host-created food decision with manual/curated candidates and no account requirement       | Active   |
| 0.2.1   | Mobile-first photo deck, optional swipe gestures, responsive adaptations, and PWA polish   | Active   |
| 0.3.0   | Durable ephemeral rooms, locked rosters, participant capabilities, and reconnect semantics | Planned  |
| 0.4.0   | Authoritative realtime voting, idempotent events, recovery, and multi-device verification  | Planned  |
| 0.5.0   | Licensed place-provider adapter, constraint filtering, data quality, and graceful fallback | Planned  |
| 0.6.0   | Closed beta, commitment handoff, privacy-safe analytics, accessibility, and operations     | Planned  |
| 0.7.0   | Repeat-group utility, saved preferences with consent, and scheduled decision rituals       | Planned  |
| 0.8.0   | Reservation/order handoffs and transparent monetization experiments                        | Planned  |
| 0.9.0   | Activities expansion, scale/recovery testing, abuse defense, and decision calibration      | Planned  |
| 1.0.0   | Operable, trustworthy group-decision product with verified retention and unit economics    | Planned  |

Completion means the milestone contract and verification gates are satisfied. It never authorizes a merge, deployment, migration, tag, GitHub release, or paid resource.

## Delivery interpretation

- Mobile is the canonical experience from 0.2.1 onward. Tablet and desktop extend it with more context rather than changing the decision rules.
- The project targets zero infrastructure spend through prototype and closed-beta validation, not perpetual zero-cost commercial production.
- Live nearby discovery enters through a provider adapter in 0.5. Fixture media demonstrates the interaction before licensed venue media is available.
- Provider quotas, commercial terms, field provenance, attribution, and graceful degradation are release gates rather than implementation details.
