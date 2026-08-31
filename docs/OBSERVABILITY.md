# Observability

## Operational telemetry

Use structured logs, traces, metrics, and correlation ids across room commands, persistence, realtime publication, and place-provider calls. Never log capabilities, exact room codes, names, precise coordinates, constraints, raw votes, or provider credentials.

Initial service-level indicators:

- command success/error/latency by type;
- projection convergence delay;
- active rooms and participants without identity;
- place-provider latency, rejection, fallback and data-completeness rates;
- decision completion/no-safe-result/abandonment rates;
- retention job success and oldest eligible record age.

Alerts must describe an operator action. Product analytics are a separate minimized event contract defined in ADR 0008.

## Delivery telemetry

Every Production promotion record includes the GitHub workflow run, full source SHA, Vercel deployment ID/URL, target project, approval time, smoke result, and rollback candidate. Never copy tokens or full provider payloads into the record.

The first owner-gated promotion is recorded in [the 2026-08-31 Production promotion record](operations/2026-08-31-production-promotion.md). PR #119 resolved its workflow false-negative by accepting a successful empty response and then verifying the exact Production alias before smoke testing.

Track build failures, Preview acceptance failures, promotion failures, rollback frequency, production smoke failures, and time from merge to approved promotion. Before closed beta, add an owner-visible runtime error source and a bounded alert for new production failures. A deployment is not healthy merely because Vercel reports READY.
