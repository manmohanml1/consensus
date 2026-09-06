# Deployment and promotion

## Current boundary

The Vercel project `consensus-web` is linked to `manmohanml1/consensus` for
Preview and staged Production builds. The public site at
`https://consensus-web-navy.vercel.app/` remains on the earlier fixture
deployment. Shared non-production and independent Production Neon projects both
contain migrations `0001`–`0005` and use distinct least-privilege identities.
Vercel Production now has its own pooled runtime URL and capability pepper, but
`CONSENSUS_ROOM_CREATION_ENABLED=false` keeps the connected APIs fail-closed.
There is still no realtime integration, custom domain, Production room data, or
authorization to move the public alias.

The 2026-08-28 deployment audit found that Vercel Git integration created Preview deployments for pull-request commits and automatically created Production deployments for merged `main` commits. That behavior did not match the earlier manual-promotion documentation. ADR 0011 corrects the boundary: pull requests retain automatic Previews, and the Vercel project setting **Production → Branch Tracking → Auto-assign Custom Production Domains** remains disabled so merged `main` builds are staged Production candidates. Only the owner-dispatched promotion workflow may move the production alias. This provider-side setting—not `vercel.json`—is the authoritative control.

## Established Preview setup

The project currently uses these settings:

1. Link `manmohanml1/consensus` to the Vercel project named `consensus-web`.
2. Set the Vercel Root Directory to `apps/web`. The app-local `vercel.json` selects the Next.js framework while Vercel discovers the workspace lockfile and framework build defaults.
3. Keep `main` as the Vercel production build branch and use pull-request branches for Preview deployments. In **Settings → Environments → Production → Branch Tracking**, disable **Auto-assign Custom Production Domains**. Vercel then creates a staged Production deployment for `main` without moving the production alias.
4. CQ-201 authorized the non-production Neon boundary. The separate 2026-09-04
   owner gate provisioned Production credentials and a unique capability pepper;
   they remain Production-only and may not be copied to Preview, Development, or
   pull-request jobs.
5. Keep Vercel deployment protection and GitHub branch protection aligned with the intended tester audience.
6. Record each applicable Preview URL in its implementing pull request and complete the Preview acceptance checklist below.

Git integration remains the build path because it already produces immutable Preview and `main` candidates. The repository does not rebuild in GitHub Actions. The separately dispatched promotion workflow uses Vercel's API to point production traffic at the exact verified candidate. `VERCEL_TOKEN` and `VERCEL_PROJECT_ID` belong only in the protected GitHub `production` environment. A team-owned project additionally supplies `VERCEL_ORG_ID`; a personal-account project omits it. No secret belongs in repository files or pull-request jobs.

## Preview acceptance checklist

Run the browser suite against the immutable Preview artifact before completing the manual checks:

```powershell
$env:PLAYWRIGHT_BASE_URL = "https://<preview-host>"
pnpm --filter @consensus/web exec playwright test e2e/preview-room-acceptance.spec.ts --project=desktop-chromium --retries=0
```

The protected shared-Preview scenario is a single stateful test and must run
without retries; an operator may investigate a failure, but must not let CI
silently create duplicate synthetic rooms.

- Record deployment URL, commit SHA, target environment, build duration, and status in the pull request.
- Complete host setup, candidate review, ballot, no-safe-result, result, commitment, and safe-link flows.
- Check 320px and 390px phones, 768px tablet, and 1440px desktop.
- Check keyboard-only use, 200% zoom, reduced motion, meaningful alternative text, and visible focus.
- Confirm browser console and deployment runtime logs contain no release-blocking errors.
- Confirm the deployed build contains only illustrative fixtures and no provider credentials or precise user data.
- Record rollback target: the previously verified deployment or removal of the Preview alias.

## Production owner gate

Production promotion is separate from merge after ADR 0011 is active. Before promotion, the owner must approve the exact READY, staged **Production** Vercel deployment URL and current full `main` SHA, intended domain, current cost envelope, monitoring gaps, privacy/retention behavior, and rollback target. The promotion workflow verifies the deployment belongs to the configured project, represents current `main`, has Vercel target `production`, and is READY before it changes the production alias. It never rebuilds. A Preview deployment is rejected because promoting one causes a production rebuild. Vercel may return a successful empty response to the promotion endpoint; the workflow accepts a 2xx status and parses a response body only when one exists. After promotion it re-reads the exact deployment and requires the configured Production hostname to appear in that deployment's aliases before smoke-checking the site.

The promotion workflow requires the owner to type `PROMOTE`, pass the exact deployment and production URLs, pass the full `main` SHA, and approve the protected GitHub `production` environment. Workflow dispatch permission alone is not production authorization for an agent; the owner must explicitly request the exact promotion.

After promotion, run the critical browser flow against Production and inspect Vercel runtime errors before declaring the release healthy. A passing HTTP smoke check is necessary but not sufficient.

## Production environment state

The following setup is complete:

1. GitHub has a protected environment named `production` with the owner as required reviewer and administrator bypass disabled.
2. `VERCEL_TOKEN` and `VERCEL_PROJECT_ID` are environment secrets. The project is personally owned, so `VERCEL_ORG_ID` is intentionally omitted; the team-only compatibility alias remains unused.
3. `apps/web/vercel.json`, the `apps/web` Vercel Root Directory, and disabled automatic Production-domain assignment form the verified build/promotion boundary.
4. Pull requests receive Preview deployments; merged `main` commits produce READY, staged Production candidates without moving the public alias.
5. The owner successfully dispatched and approved the first exact-artifact promotion. Its immutable deployment, source SHA, smoke evidence, and rollback candidate are recorded in `docs/operations/2026-08-31-production-promotion.md`.

The independent Production database, least-privilege identities, migrations,
secrets, and isolated restore branch have been prepared. The recovery aggregate
and branch still require their just-in-time deletion confirmation, and the daily
retention invocation must be verified before room creation is enabled.
Identifying the last known-good deployment is read-only; moving Production
traffic to it or restoring the current artifact each requires the owner's exact
approval.

The workflow adds no hosting product and no application runtime cost. GitHub Actions usage and Vercel account limits still apply. Vercel OIDC is not a substitute for the token used by deployment APIs; OIDC is reserved for deployed functions authenticating to supported external cloud services.

## Current deployment sequence

The initial project link, Preview validation, owner-authorized merges, staged `main` candidate, exact-artifact promotion, and Production smoke review are complete. The public site remains a fixture-only reference deployment; it is not evidence that the 0.2 moderated-usability gate, 0.2.1 device gate, milestone 0.3 persistence work, or any product release is complete.

Future deployable changes follow the promotion contract below. Most merges need no Production action: they may remain as staged candidates until the owner requests an exact promotion. The owner approved CQ-201 non-production database provisioning on 2026-08-31. The resulting Free Neon resource is connected only to Vercel Preview and Development; it does not place provider credentials or test data in Production.

## Intended environments

The application HTML is dynamically rendered because the strict script CSP uses
a unique request nonce. Static assets remain cacheable, but HTML must not be
converted back to static generation or edge-cached without a reviewed hash/SRI
design. Production `script-src` excludes `unsafe-inline`; Development adds only
`unsafe-eval` for framework debugging.

| Environment | Purpose                     | Data boundary                                                                                       |
| ----------- | --------------------------- | --------------------------------------------------------------------------------------------------- |
| Development | Local domain/UI work        | Pooled non-production URL is available; APIs fail closed without a separately supplied local pepper |
| Test        | GitHub Actions              | Isolated fixtures and disposable databases                                                          |
| Preview     | Exact pull-request artifact | Non-production provider resources                                                                   |
| Production  | Approved immutable artifact | Production resources and retention controls                                                         |

Milestone 0.3 reserves `CONSENSUS_DATABASE_URL` for pooled server runtime access
and `CONSENSUS_MIGRATION_DATABASE_URL` for direct, owner-approved migrations.
Each environment uses distinct credentials. CQ-202 defines NOLOGIN
`consensus_runtime` and `consensus_migrator` group roles; each application login
inherits only the runtime group, has no database or schema creation privilege,
and cannot assume `consensus_migrator`. See
[the non-production provisioning record](operations/2026-08-31-neon-nonproduction-provisioning.md),
[the runtime activation record](operations/2026-09-03-neon-preview-runtime-activation.md),
[the Production provisioning record](operations/2026-09-04-neon-production-provisioning.md),
and [the migration runbook](MIGRATIONS.md).

`CONSENSUS_CAPABILITY_PEPPER` is a server-only, independently
generated 32-byte key encoded as base64url. It must differ by environment, remain
outside browser bundles and logs, and be rotated only through a capability
reissuance plan because changing it invalidates every outstanding room token.
CQ-204's private room routes fail closed with a safe `503` until the runtime
database URL, pepper, and room-creation gate are available. The owner-authorized
Preview activation produced a real `201` room creation response. Production has
distinct secrets but remains fail-closed through the explicit room-creation
flag; the flag may change only in an approved launch window.

## Promotion contract

```text
topic branch -> pull request -> stable quality/security gate -> Preview acceptance
             -> explicit merge approval -> non-aliased current-main candidate
             -> explicit production approval -> promote exact candidate without rebuild
             -> production smoke/log verification
             -> separately authorized annotated tag/release + checksum + provenance
```

Vercel Git integration is the preferred initial web build path. The default Node.js/Fluid Compute runtime is used. Preview and main-candidate deployments consume the exact lockfile and build contract. Production secrets must never be available to pull requests or fork jobs.

The app-local `apps/web/vercel.json` pins the framework contract. Project IDs, tokens, and environment-specific secrets remain outside the repository. The Vercel project Root Directory must stay aligned with `apps/web`; changes to provider or GitHub settings remain explicit external actions.

Database migrations remain separately approval-gated and run before promotion with a verified recovery plan. When a migration cannot be rolled back safely, application compatibility must support both the old and new schema during the deployment window.

## Milestone 0.3 environment readiness

The repository, shared non-production schema, least-privilege runtime identity,
and protected room journey have completed their technical Preview exit. CQ-215
connects setup, lobby, voting, result, denial, expiry, departure, and host
recovery to the private room API. The earlier single-device fixture remains
below it as an explicitly labelled prototype reference. The final protected
Preview run at commit `b080059` passed isolated-role, negative-state,
privacy-equivalence, responsive-overflow, and unexpected page/console-error
checks. Its exact synthetic aggregate was removed with zero residue.

Before widening Preview access beyond controlled acceptance:

- complete CQ-106 physical-device/PWA acceptance and CQ-107 moderated-usability
  evidence;
- retain deployment protection and the protected automation-bypass boundary
  while Preview uses shared non-production persistence;
- repeat the full stateful run only for a materially changed accepted artifact,
  once, with an exact synthetic title and separately authorized cleanup.

CQ-212's owner-authorized hosted restore-branch rehearsal is complete. It
verified migrations, least-privilege grants, synthetic aggregate deletion, and
temporary branch teardown without changing the default non-production branch.

The repository contains an opt-in multi-context Preview check that uses Vercel's
dedicated automation-bypass header when the secret is supplied at runtime;
deployment protection is not disabled. The final owner-dispatched run
[33901645276](https://github.com/manmohanml1/consensus/actions/runs/33901645276)
at commit `b080059` passed the complete protected-Preview boundary in one
attempt. The job uses the
`VERCEL_AUTOMATION_BYPASS_SECRET` held only in GitHub's protected `Preview`
environment, validates the target is a Consensus Vercel Preview host, never
receives Production secrets, and never performs automatic cleanup. Exact
evidence and the separately authorized, zero-residue synthetic cleanup are recorded in
[the CQ-215 protected Preview acceptance record](operations/2026-09-03-cq215-protected-preview-acceptance.md).

Production preparation remains separate from launch. The independent database,
distinct identities, unique pepper, reviewed schema, and a READY staged
current-main artifact now exist; room creation stays disabled. Complete the
recorded recovery cleanup, verify the daily retention invocation, close the real
device/human acceptance gates, and review monitoring/cost/rollback immediately
before any alias movement. Never copy non-production URLs, credentials, pepper,
fixtures, or branches into Production. Merge, Production promotion, annotated
tag, and GitHub Release remain separate explicit owner gates.

The complete remaining resource, product-acceptance, observability, recovery,
rollback, and release sequence is recorded in
[the v0.3 pre-Production readiness record](operations/2026-09-04-v03-preproduction-readiness.md).
