# Deployment and promotion

## Current boundary

Milestone 0.2 remains provider-independent at the product boundary. A Vercel project named `consensus-web` is linked to `manmohanml1/consensus` for Preview delivery. No database, realtime integration, custom domain, production data, or production secret has been created.

## First Preview setup

The initial project setup uses these settings:

1. Link `manmohanml1/consensus` to the Vercel project named `consensus-web`.
2. Set the Vercel Root Directory to `apps/web`. The app-local `vercel.json` selects the Next.js framework while Vercel discovers the workspace lockfile and framework build defaults.
3. Keep `main` as the production branch and use non-production pull-request branches for Preview deployments.
4. Do not add database, place, realtime, analytics, or production secrets for milestone 0.2; the current build uses fixtures only.
5. Keep Vercel deployment protection and GitHub branch protection aligned with the intended tester audience.
6. Share the first Preview URL in the implementing pull request and complete the Preview acceptance checklist below.

If Git integration is unsuitable later, a separately approved CI workflow may use pinned Vercel CLI builds and `vercel deploy --prebuilt`. Its `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID` values belong in GitHub Actions secrets, never in the repository. Git integration remains the simpler initial path.

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

Production is not an automatic merge side effect. Before promotion, the owner must approve the exact Preview artifact, intended domain, current cost envelope, monitoring gaps, privacy/retention behavior, and rollback target. Promote the verified artifact rather than rebuilding a different one. After promotion, run the same critical flow against Production and inspect runtime errors before declaring the release healthy.

## Planned deployment sequence

1. Finish the `codex/decision-mvp` quality gate and push the topic branch.
2. Link a dedicated `consensus-web` Vercel project and create an immutable Preview from the exact branch commit.
3. Run the desktop, mobile, keyboard, reduced-motion, security-header, and no-live-data acceptance checks against Preview.
4. Complete the moderated 0.2 usability sessions and resolve release-critical findings.
5. Merge only with explicit owner approval, then promote the already-verified Preview artifact to Production.
6. Run production browser smoke checks before beginning milestone 0.3 persistence work.

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
topic branch -> pull request -> stable quality gate -> immutable artifact
             -> preview acceptance -> explicit merge approval -> production deploy
             -> smoke verification -> separately authorized annotated tag/release
```

Vercel Git integration is the preferred initial web delivery. The default Node.js/Fluid Compute runtime is used. Preview deployment should consume the exact lockfile and build contract. Production secrets must never be available to pull requests from forks.

The app-local `apps/web/vercel.json` pins the framework contract. Project IDs, tokens, and environment-specific secrets remain outside the repository. The Vercel project Root Directory must stay aligned with `apps/web`; changes to provider or GitHub settings remain explicit external actions.

The provider integration and `vercel.ts` configuration are added only when a deployment is authorized and the target project is linked. Database migrations remain separately approval-gated and run before promotion with a verified recovery plan.
