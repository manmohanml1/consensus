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

## Pre-launch Production thresholds

Vercel Runtime Logs/Observability and the Neon usage dashboard are the initial
owner-visible sources. The Hobby/Free boundary does not justify claiming paid
alerting features that are not enabled. Review the dashboards during every
launch window and at least daily while rooms are enabled.

- fail closed and investigate when room-command 5xx responses reach 5 in five
  minutes or exceed 2% of commands;
- investigate sustained 429 responses above 5% for ten minutes; keep the
  per-IP creation limiter active and disable new rooms during abuse;
- treat any Production migration failure as a release stop and preserve the
  last schema-compatible application candidate;
- alert operationally when the retention job fails or the oldest due aggregate
  is more than 24 hours overdue; disable room creation if the sweep cannot be
  restored;
- review Neon at 70% of any storage, compute, or transfer allowance and disable
  room creation at 85% until the owner approves capacity or a paid tier;
- investigate any unexpected authorization-denial increase without logging room
  locators, capabilities, names, votes, constraints, or precise location.

The budget owner is the repository owner. Pre-launch resources remain within
Vercel Hobby and Neon Free; any paid upgrade or new telemetry vendor is a
separate approval.

## Delivery telemetry

Every Production promotion record includes the GitHub workflow run, full source SHA, Vercel deployment ID/URL, target project, approval time, smoke result, and rollback candidate. Never copy tokens or full provider payloads into the record.

The first owner-gated promotion is recorded in [the 2026-08-31 Production promotion record](operations/2026-08-31-production-promotion.md). PR #119 resolved its workflow false-negative by accepting a successful empty response and then verifying the exact Production alias before smoke testing.

The controlled beta activation at commit `ce7d25be` is recorded in
[the 2026-09-07 Production beta activation record](operations/2026-09-07-production-beta-activation.md).
It includes the protected acceptance run, exact-alias promotion, public smoke
response, post-launch retention completion, and error-log scan.

Track build failures, Preview acceptance failures, promotion failures, rollback frequency, production smoke failures, and time from merge to approved promotion. Before closed beta, add an owner-visible runtime error source and a bounded alert for new production failures. A deployment is not healthy merely because Vercel reports READY.
