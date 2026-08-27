# Testing strategy

## Local gate

`pnpm verify` runs formatting, lint, strict type checking, unit tests, a production build, and the Playwright desktop/mobile/reduced-motion suite.

Install the Chromium test runtime once with:

```powershell
pnpm --filter @consensus/web exec playwright install chromium
```

## Test layers

- Domain: property/invariant tests for constraints, ranking, ties, incomplete ballots and historical rulesets.
- Web: accessible rendering, control semantics, state transitions and error boundaries.
- Contract: request/event schema and compatibility fixtures beginning in 0.3.
- Persistence: migrations, authorization, idempotency and concurrency against PostgreSQL beginning in 0.3.
- Realtime: duplicate, reorder, reconnect, delayed delivery and partition simulations beginning in 0.4.
- Browser: Playwright desktop/mobile/keyboard/reduced-motion journeys beginning in 0.2.
- Production: health, create/join/vote/result/delete smoke path with synthetic rooms beginning in 0.6.

Do not use a production provider or user room as automated test data.
