# ADR 0012: Neon PostgreSQL for non-production room persistence

**Status:** Accepted for non-production only  
**Decision owner:** Repository owner approval is still required before provisioning

## Context

Milestone 0.3 needs a PostgreSQL-compatible transactional store for forward-only
migrations, room revisions, idempotency records, capability hashes, expiry, and a
future outbox. The store must not turn a free validation phase into an uncontrolled
cost or make an inactive test environment appear production-ready.

## Decision

Use **Neon PostgreSQL** as the selected provider for a disposable non-production
environment after explicit owner approval. The application remains standard
PostgreSQL: migrations use portable SQL and no Neon SDK, Auth product, branching
API, or provider-specific SQL enters domain contracts.

Neon's published Free plan currently includes 0.5 GB storage and 100 CU-hours per
project each month, with compute scaling to zero when idle. Its six-hour restore
window is adequate only for disposable development data, not a production recovery
commitment. Current figures are evaluation evidence, not a contractual guarantee;
the owner rechecks pricing, limits, and terms at provisioning and before any plan
change.

## Why this provider

- PostgreSQL preserves the transactional and migration model already defined for
  rooms.
- Scale-to-zero and a bounded Free allowance fit short non-production validation
  sessions better than an always-on database assumption.
- Standard SQL keeps a later move to Supabase Postgres, managed Postgres, or
  self-hosted PostgreSQL feasible.
- Realtime remains deliberately unselected until CQ-301; database selection does
  not grant a client or provider realtime authority.

## Rejected for this milestone

- **Supabase Postgres:** viable later, but not selected now. Its Free plan has a
  500 MB database and pauses after one week of inactivity; its bundled Realtime
  limits do not resolve the separate CQ-301 transport decision.
- **SQLite/Turso:** not PostgreSQL-compatible enough for the first transactional
  migration, locking, and operational proof.
- **Self-hosting, Docker, Kubernetes, Terraform:** add operational ownership and
  spending before measured need.

## Controls and degradation

- Do not provision, add secrets, create paid resources, or use user data without
  explicit owner approval.
- Use a distinct non-production project and synthetic fixtures only.
- Set the provider's Free-plan/usage notifications where available; do not attach
  a payment method or enable a paid plan as part of this decision.
- If the database is unavailable, the server rejects durable room mutations with a
  retryable unavailable response. It never falls back to browser authority.
- A later production proposal requires a separate budget, retention, backup/RPO,
  restore rehearsal, privacy review, and owner approval. It may choose Neon or a
  different PostgreSQL provider.

## Portability and migration threshold

The schema is exported through standard PostgreSQL tools and forward-only SQL
migrations. Start a replacement-provider decision before any of these conditions:

- the Free allowance prevents the planned validation workload;
- a recovery need exceeds the six-hour Free restore window;
- any production, personal-data, compliance, region, or uptime requirement
  appears; or
- provider terms, price, or availability materially change.

Migration is forward-only: export a sanitized non-production database, restore it
to the candidate PostgreSQL provider, run the complete migration and concurrency
suite, cut over a non-production environment, and retain the old environment until
the owner approves teardown.

## Sources checked 2026-08-31

- [Neon pricing](https://neon.com/pricing)
- [Supabase pricing](https://supabase.com/pricing)
- [Supabase billing and quota details](https://supabase.com/docs/guides/platform/billing-on-supabase)
