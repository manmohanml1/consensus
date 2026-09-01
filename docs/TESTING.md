# Testing strategy

## Local gate

`pnpm verify` checks release alignment, backlog structure, documentation links/state contracts, workflow policy, formatting, lint, strict type checking, unit tests, a production build, and the Playwright desktop/mobile/reduced-motion suite.

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

Milestone 0.2.1 also validates install metadata and generated icons, plus horizontal-overflow and primary-action availability at 320, 390, 768, 1024, and 1440 CSS pixels. Manual HTTPS install and device checks follow [PWA.md](PWA.md); automation does not substitute for iOS/Android home-screen verification.

Browser projects use bounded parallelism so image-heavy responsive journeys do not create development-server startup races on constrained CI runners. Increasing worker count requires repeated evidence that the full suite remains stable.

Set `PLAYWRIGHT_BASE_URL` to an immutable HTTPS Preview origin to run the same suite without starting the local development server:

```powershell
$env:PLAYWRIGHT_BASE_URL = "https://<preview-host>"
pnpm test:e2e
```

Do not use a production provider or user room as automated test data.
