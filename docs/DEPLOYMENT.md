# Deployment and promotion

## Current boundary

Milestone 0.2 remains provider-independent at the product boundary. A Vercel project named `consensus-web` is linked to `manmohanml1/consensus` for Preview and Production builds. No database, realtime integration, custom domain, production data, or application secret has been created.

The 2026-08-28 deployment audit found that Vercel Git integration created Preview deployments for pull-request commits and automatically created Production deployments for merged `main` commits. That behavior did not match the earlier manual-promotion documentation. ADR 0011 corrects the boundary: pull requests retain automatic Previews, and the Vercel project setting **Production → Branch Tracking → Auto-assign Custom Production Domains** remains disabled so merged `main` builds are staged Production candidates. Only the owner-dispatched promotion workflow may move the production alias. This provider-side setting—not `vercel.json`—is the authoritative control.

## First Preview setup

The initial project setup uses these settings:

1. Link `manmohanml1/consensus` to the Vercel project named `consensus-web`.
2. Set the Vercel Root Directory to `apps/web`. The app-local `vercel.json` selects the Next.js framework while Vercel discovers the workspace lockfile and framework build defaults.
3. Keep `main` as the Vercel production build branch and use pull-request branches for Preview deployments. In **Settings → Environments → Production → Branch Tracking**, disable **Auto-assign Custom Production Domains**. Vercel then creates a staged Production deployment for `main` without moving the production alias.
4. Do not add database, place, realtime, analytics, or production secrets for milestone 0.2; the current build uses fixtures only.
5. Keep Vercel deployment protection and GitHub branch protection aligned with the intended tester audience.
6. Share the first Preview URL in the implementing pull request and complete the Preview acceptance checklist below.

Git integration remains the build path because it already produces immutable Preview and `main` candidates. The repository does not rebuild in GitHub Actions. The separately dispatched promotion workflow uses Vercel's API to point production traffic at the exact verified candidate. `VERCEL_TOKEN` and `VERCEL_PROJECT_ID` belong only in the protected GitHub `production` environment. A team-owned project additionally supplies `VERCEL_ORG_ID`; a personal-account project omits it. No secret belongs in repository files or pull-request jobs.

## Preview acceptance checklist

Run the browser suite against the immutable Preview artifact before completing the manual checks:

```powershell
$env:PLAYWRIGHT_BASE_URL = "https://<preview-host>"
pnpm --filter @consensus/web test:e2e
```

- Record deployment URL, commit SHA, target environment, build duration, and status in the pull request.
- Complete host setup, candidate review, ballot, no-safe-result, result, commitment, and safe-link flows.
- Check 320px and 390px phones, 768px tablet, and 1440px desktop.
- Check keyboard-only use, 200% zoom, reduced motion, meaningful alternative text, and visible focus.
- Confirm browser console and deployment runtime logs contain no release-blocking errors.
- Confirm the deployed build contains only illustrative fixtures and no provider credentials or precise user data.
- Record rollback target: the previously verified deployment or removal of the Preview alias.

## Production owner gate

Production promotion is separate from merge after ADR 0011 is active. Before promotion, the owner must approve the exact READY, staged **Production** Vercel deployment URL and current full `main` SHA, intended domain, current cost envelope, monitoring gaps, privacy/retention behavior, and rollback target. The promotion workflow verifies the deployment belongs to the configured project, represents current `main`, has Vercel target `production`, and is READY before it changes the production alias. It never rebuilds. A Preview deployment is rejected because promoting one causes a production rebuild. Vercel may return a successful empty response to the promotion endpoint; the workflow accepts a 2xx status and parses a response body only when one exists.

The promotion workflow requires the owner to type `PROMOTE`, pass the exact deployment and production URLs, pass the full `main` SHA, and approve the protected GitHub `production` environment. Workflow dispatch permission alone is not production authorization for an agent; the owner must explicitly request the exact promotion.

After promotion, run the critical browser flow against Production and inspect Vercel runtime errors before declaring the release healthy. A passing HTTP smoke check is necessary but not sufficient.

## Production environment setup

Complete these owner actions before merging the first change that expects manual promotion:

1. In GitHub repository settings, create an environment named `production`.
2. Configure required reviewers and disable administrator bypass where the GitHub plan supports those controls.
3. Add environment secrets named `VERCEL_TOKEN` and `VERCEL_PROJECT_ID`. For a team-owned project, also add `VERCEL_ORG_ID` (the Vercel `team_` identifier). A personal-account project omits that secret entirely. The workflow temporarily accepts `VERCEL_TEAM_ID` as a compatibility alias for team-owned projects. Use a scoped Vercel token and record its expiry/rotation outside Git.
4. Confirm `apps/web/vercel.json` is the effective framework configuration, the Vercel Root Directory remains `apps/web`, and **Auto-assign Custom Production Domains** is disabled in the Vercel Production environment.
5. Confirm pull requests still receive Preview URLs and a merged `main` candidate is a READY deployment with target `production` that has not moved `https://consensus-web-navy.vercel.app/`.
6. From GitHub Actions, dispatch `Consensus Production Promotion` from `main` with the exact candidate URL, current 40-character `main` SHA, production URL, and `PROMOTE` confirmation.
7. Approve the GitHub environment gate, observe the ownership/state checks, then complete browser and log verification.
8. Rehearse rollback by identifying—but not promoting without approval—the last known-good deployment.

The workflow adds no hosting product and no application runtime cost. GitHub Actions usage and Vercel account limits still apply. Vercel OIDC is not a substitute for the token used by deployment APIs; OIDC is reserved for deployed functions authenticating to supported external cloud services.

## Planned deployment sequence

1. Finish the `codex/decision-mvp` quality gate and push the topic branch.
2. Link a dedicated `consensus-web` Vercel project and create an immutable Preview from the exact branch commit.
3. Run the desktop, mobile, keyboard, reduced-motion, security-header, and no-live-data acceptance checks against Preview.
4. Complete the moderated 0.2 usability sessions and resolve release-critical findings.
5. Merge only with explicit owner approval. Vercel builds the resulting current-`main` candidate without changing the production alias.
6. Verify that exact candidate, then dispatch and approve the production-promotion workflow only with a separate explicit owner instruction.
7. Run production browser and runtime-log smoke checks before declaring the deployment healthy.

Preview is therefore planned immediately after technical 0.2 verification. Production is planned after Preview acceptance and the 8/10 usability gate—not simply because the branch builds.

## Intended environments

| Environment | Purpose                     | Data boundary                               |
| ----------- | --------------------------- | ------------------------------------------- |
| Development | Local domain/UI work        | Sample fixtures only until 0.3              |
| Test        | GitHub Actions              | Isolated fixtures and disposable databases  |
| Preview     | Exact pull-request artifact | Non-production provider resources           |
| Production  | Approved immutable artifact | Production resources and retention controls |

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
