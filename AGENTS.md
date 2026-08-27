# Consensus contributor guide

Read `docs/PROJECT_GUIDE.md` before changing product scope, architecture, dependencies, decision semantics, security, deployment, or release behavior. Repository records supersede chat history and personal recollection.

## Required workflow

1. Work from the next unfinished milestone in `ROADMAP.md`.
2. Treat hard constraints separately from preferences; never convert an allergy, accessibility need, or absolute budget ceiling into a low preference score.
3. Keep decision rules deterministic, versioned, explainable, and independently tested.
4. Keep provider payloads behind adapters; domain contracts never depend on a place, realtime, database, analytics, or reservation vendor.
5. Realtime is transport, not authority. Durable server-side state decides accepted votes, roster membership, and outcomes.
6. Add tests for behavior and invariants, then run `pnpm verify` before review.
7. Update the changelog, roadmap, milestone record, and ADR when their facts change.
8. Never commit secrets, production data, precise user location, generated build output, or copied provider payloads.

## Change discipline

- Use short-lived topic branches and Conventional Commit pull-request titles.
- Keep `main` releasable.
- Do not provision a provider before its milestone needs it and its ADR is accepted.
- Treat accessibility, privacy, deletion, observability, abuse prevention, and graceful degradation as product behavior.
- Never create a tag, release, remote repository, deployment, or paid resource without explicit owner authorization.
