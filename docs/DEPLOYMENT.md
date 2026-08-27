# Deployment and promotion

## Current boundary

Milestone 0.1 is local and provider-independent. No Vercel project, database, realtime integration, domain, or production environment has been created by this repository.

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

The provider integration and `vercel.ts` configuration are added only when a deployment is authorized and the target project is linked. Database migrations remain separately approval-gated and run before promotion with a verified recovery plan.
