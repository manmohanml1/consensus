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

The local CQ-215 connected-room suite uses isolated browser authorities for the
host/participant happy path and mocked committed projections for denial,
authenticated expiry, host recovery, and participant departure. It also checks
the connected entry surface at 320, 390, 768, 1024, and 1440 CSS pixels,
keyboard navigation, and the reduced-motion override. These deterministic local
checks do not write shared Neon data and do not replace the separately
owner-authorized protected Preview review.

Browser projects run through one worker so image-heavy responsive journeys do
not race development-server hydration on constrained local and CI runners. The
suite remains small enough for deterministic serialization. Increasing worker
count requires repeated evidence that the complete gate remains stable.

Set `PLAYWRIGHT_BASE_URL` to an immutable HTTPS Preview origin to run the same suite without starting the local development server:

```powershell
$env:PLAYWRIGHT_BASE_URL = "https://<preview-host>"
pnpm test:e2e
```

Do not use a production provider or user room as automated test data.

The deployed multi-context room check is deliberately owner-dispatched because
it writes one synthetic aggregate to shared non-production Neon. It exercises
an admitted participant, a denied participant, host recovery with old-authority
revocation, missing/unauthorized response equivalence, responsive overflow, and
browser errors without creating additional aggregates. A Vercel
Authentication-protected Preview also requires its automation-bypass secret;
interactive login cookies must not be copied into test runners. The GitHub
manual `Consensus Quality` workflow job uses only the existing protected
`Preview` environment and accepts an immutable Preview URL plus a unique,
non-sensitive title. After the approved run, delete that exact aggregate through
the documented operator cleanup procedure.

Manual Preview dispatches run only this stateful acceptance job. The normal
pull-request event remains the authoritative source, dependency, persistence,
build, and local-browser gate; keeping the executions separate prevents an
unrelated rerun from obscuring the exact Preview result.

The production dependency audit is also isolated from the full verify job. It
remains fail-closed and part of the aggregate `build-and-test` requirement, but
an advisory-service outage can be diagnosed and rerun without repeating the
entire build and browser suite.

For a local reproduction by an approved operator:

```powershell
$env:PLAYWRIGHT_BASE_URL = "https://<immutable-preview-host>"
$env:CONSENSUS_LIVE_PREVIEW_ACCEPTANCE = "1"
$env:CONSENSUS_PREVIEW_TEST_TITLE = "Preview acceptance <unique-run-label>"
$env:VERCEL_AUTOMATION_BYPASS_SECRET = "<protected-test-secret>"
pnpm --filter @consensus/web exec playwright test e2e/preview-room-acceptance.spec.ts --project=desktop-chromium --retries=0
```

Never echo the bypass secret, invitation locator, capability cookie, or recovery
code. The test uses separate browser contexts and passes the bypass only as a
request header. It makes exactly one attempt: retrying a stateful shared-Preview
test could create duplicate fixtures. It remains skipped during the ordinary
local and pull-request gate; the owner-dispatched workflow does not promote,
release, or clean up data automatically.

## Disposable PostgreSQL migration suite

The persistence suite bootstraps NOLOGIN group roles,
applies every ordered migration twice, verifies database constraints, and deletes
the complete synthetic room aggregate. It accepts only
`CONSENSUS_TEST_DATABASE_URL` and must target a disposable database owned by the
test process:

```powershell
pnpm test:persistence
```

The normal unit gate validates ordering and checksums without a connection. CI
may enable the integration command only against its isolated PostgreSQL service;
Vercel and Production URLs are forbidden as test inputs. Applying migrations to
the shared Neon non-production resource remains a separate owner-authorized
operation.

## Local milestone 0.3 checks

The capability suite is dependency-free and runs locally without a database:

```powershell
pnpm --filter @consensus/security test
```

It covers token entropy/shape, keyed fingerprints, safe logging behavior,
one-time delivery, room/member/role/expiry/status rejection, and secure cookie
attributes. `pnpm verify` additionally runs domain, persistence-unit, security,
web, production-build, and Playwright desktop/mobile/reduced-motion checks.

The current Windows development host has neither Docker nor `psql`, so
`pnpm test:persistence` is not locally runnable there without installing a
disposable PostgreSQL runtime. GitHub Actions remains the authoritative disposable
PostgreSQL path; the shared Neon database must not be substituted for a local or
CI test database.

CQ-204/CQ-210 extend that disposable suite with exact idempotent replay,
conflicting-key rejection, stale-revision and sequence responses, atomic
command/outbox evidence, cross-room authorization rejection, locked-roster
integrity, and projection privacy checks. The web unit suite separately proves
same-origin mutation enforcement, bounded bodies, route/body room agreement,
`no-store` responses, and safe fail-closed behavior when server configuration is
absent.

CQ-208 integration coverage authenticates a naturally expired room, verifies its
terminal projection, rejects concurrent mutations without changing revision or
title, and runs concurrent plus repeated retention sweeps. The deletion assertion
covers every room-owned table, including stored projections and outbox payloads.

CQ-209 adds security tests for recovery-code entropy, domain separation,
redaction, expiry, and constant-shape rejection; web tests for same-origin and
bounded per-source/per-room attempts; and disposable PostgreSQL races proving
exactly one redemption wins, the old host capability fails immediately, the new
capability succeeds, command sequencing is preserved, and the challenge is
consumed with the revision/outbox update.

CQ-212 adds a destructive rehearsal that can run only against a localhost
database whose name contains `test` and only with an explicit environment guard.
It verifies a consistent PostgreSQL database clone contains the exact migration
ledger and synthetic fixture, then verifies deletion of the restore database and
source application schemas. Shared provider credentials are never available to
this CI job.

## Deterministic boundary fuzzing

The required `pnpm verify` gate runs 256 dependency-free, deterministic JSON
cases through every public room-protocol parser. It also checks a named
regression corpus for oversized, deeply nested, prototype-shaped, and
authentication-material inputs. Every assertion reports the generating seed;
when a failure is found, reduce it to the smallest JSON value and add that value
to `regressionCorpus` in `packages/domain/src/room-protocol.fuzz.test.ts` before
fixing the parser.

The weekly `Consensus Security Fuzz` workflow and its manual dispatch run the
same bounded harness with 10,000 cases. A local reproduction can use the exact
same depth:

```powershell
$env:CONSENSUS_FUZZ_CASES = "10000"
pnpm --filter @consensus/domain test -- room-protocol.fuzz.test.ts
```

Decision properties additionally vary candidate order and preference pressure
while proving that hard constraints dominate scoring. Capability properties vary
room, member, and role scopes and prove that only the exact stored scope is
authorized. Duplicate-command, stale-revision, and sequence-conflict semantics
remain covered against disposable PostgreSQL because they depend on transactional
state rather than input parsing.
