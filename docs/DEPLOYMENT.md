# Deployment and promotion

## Current boundary

Milestone 0.2 is provider-independent. The repository contains a Vercel build contract, but no Vercel project, database, realtime integration, domain, or production environment has been created.

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

The root `vercel.json` pins the current monorepo install, build, and output contract. It contains no project IDs, tokens, or environment-specific secrets. Linking the Vercel project and changing GitHub repository settings remain explicit external actions.

The provider integration and `vercel.ts` configuration are added only when a deployment is authorized and the target project is linked. Database migrations remain separately approval-gated and run before promotion with a verified recovery plan.
