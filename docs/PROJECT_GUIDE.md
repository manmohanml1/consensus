# Consensus project guide

This repository is the source of truth for product, decision semantics, architecture, security, privacy, delivery, and release decisions.

## Source precedence

1. Accepted ADRs in `docs/adr/`
2. `SECURITY.md`, `docs/ARCHITECTURE.md`, `docs/PRIVACY.md`, and `docs/product/PRODUCT.md`
3. `ROADMAP.md`, `docs/product/MVP.md`, and the active milestone contract
4. Testing, deployment, operations, and API records
5. Current implementation and automated tests
6. Issues, pull requests, prototypes, and chat history

Correct implementation that conflicts with a higher-priority record, or deliberately change the decision through a new ADR. Do not silently drift.

## Product commitment

Consensus gets a small group from indecision to a plan they can accept and act on. Food is the first wedge. The durable value is constraint safety, decision fairness, clear reasoning, and commitment—not card animations.

## Product invariants

- Joining a temporary room never requires account creation.
- Hard constraints are applied before preferences are scored.
- A recommendation identifies the rule version and gives a plain-language reason.
- No browser or peer is authoritative for roster, votes, or outcome.
- Disconnection does not silently reinterpret an already-started round.
- Missing, stale, unavailable, estimated, and provider-supplied place fields remain distinct.
- A place-provider outage never fabricates ratings, hours, prices, availability, or photos.
- Precise location and individual votes are minimized and expire.
- Reduced-motion, keyboard, screen-reader, and button-based voting are complete paths.
- Every external provider and paid resource requires an accepted ADR and explicit owner approval.

## Delivery sequence

| Phase   | Proof                                                         | Infrastructure allowed                                                  |
| ------- | ------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 0.1–0.2 | The decision loop is understandable and useful on one device  | Next.js, static sample decks, deterministic domain package              |
| 0.3     | Anonymous room security and lifecycle are correct             | Transactional database selected and provisioned through an accepted ADR |
| 0.4     | Multi-device state is correct under reconnects and duplicates | Realtime transport selected after a measured prototype                  |
| 0.5     | Nearby venue data is trustworthy enough to act on             | Licensed place provider, cache, and documented fallback                 |
| 0.6     | Real groups repeatedly complete decisions                     | Privacy-safe product events and production observability                |
| 0.7–1.0 | Retention, handoff revenue, category expansion, and scale     | Only measured, budgeted capabilities approved by ADR                    |

## Engineering baseline

- Node.js 24 LTS and pnpm workspaces
- Next.js 16 App Router, React 19, strict TypeScript
- Server Components for reads; small Client Components for interaction
- Pure TypeScript domain rules in `packages/domain`
- Node.js/Fluid Compute runtime by default
- Schema validation at every external boundary
- PostgreSQL as the transactional model; ADR 0012 selects Neon only for an owner-approved, disposable non-production environment
- Realtime transport carries updates; transactional persistence owns accepted state
- Vitest for domain/component behavior and Playwright for release-critical journeys
- GitHub Actions with immutable action pins, CodeQL, dependency review, Dependabot, workflow analysis, provenance-attested release artifacts, and protected `main`

## Quality contract

Every pull request must explain purpose, scope, risk, recovery, and verification; pass `pnpm verify`; add tests for changed behavior; include mobile/desktop evidence for UI work; and update the roadmap, changelog, milestone, API contract, or ADR when facts change.

The default completion state is an open, review-ready pull request. Only an explicit owner instruction to merge that exact pull request authorizes a merge; checks, previews, reviews, prior permissions, and milestone completion do not.

Production promotion is a separate owner gate. Vercel may build current `main`, but the production alias moves only through the verified promotion contract in ADR 0011 and `docs/DEPLOYMENT.md`.

Releases use annotated `vMAJOR.MINOR.PATCH` tags. A verified milestone, merge, or deployment never implicitly authorizes a tag or GitHub Release.
