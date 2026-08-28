# ADR 0011 — Owner-gated DevSecOps and artifact promotion

- Status: accepted
- Date: 2026-08-28
- Decision owners: repository owner

## Context

Consensus uses a pnpm/Next.js monorepo, GitHub Actions, and Vercel Git integration. It does not build or operate a container image, Kubernetes cluster, cloud network, or Terraform-managed account. The repository nevertheless needs production-grade change control, supply-chain defenses, release provenance, and an accurate promotion model.

An audit on 2026-08-28 found that Vercel recorded pull-request commits as Preview deployments and every recent `main` merge as a Production deployment. That contradicted repository text claiming Production was always a separate post-merge promotion.

The attached DevOps proposal and these repositories were assessed as references:

- [BretFisher/github-actions-templates](https://github.com/BretFisher/github-actions-templates)
- [NotHarshhaa/devops-project-templates](https://github.com/NotHarshhaa/devops-project-templates)
- [NotHarshhaa/DevOps-Projects](https://github.com/NotHarshhaa/DevOps-Projects)
- [techiescamp/devops-tools](https://github.com/techiescamp/devops-tools)
- [myugan/awesome-cicd-security](https://github.com/myugan/awesome-cicd-security)
- [semantic-release/semantic-release](https://github.com/semantic-release/semantic-release)

The references are inputs, not authorities. Several are teaching catalogs rather than reusable production baselines. Some example workflows use mutable branch references, older action versions, tolerated security failures, broad permissions, or long-lived cloud keys. Their container and Kubernetes paths solve a different deployment problem.

## Decision

### Change and release authority

- `main` remains protected and accepts changes only through a pull request with the aggregate quality gate.
- An explicit owner instruction for the exact PR is the only merge authorization.
- Production promotion, annotated tags, and GitHub Releases each require separate explicit owner instructions.
- Automatic `semantic-release` publication on every qualifying `main` commit is not used because it would collapse the owner tag/release gate. Conventional Commits still classify release impact.

### Workflow supply chain

- Every external GitHub Action is pinned to a full 40-character commit SHA and annotated with the reviewed release version.
- GitHub's repository-level Actions policy requires full commit-SHA pins, providing a server-side backstop to the repository check.
- Dependabot maintains action and package updates through reviewable PRs.
- A repository-owned validator rejects mutable action references, persisted checkout credentials, `pull_request_target`, `write-all`, unbounded jobs, and ignored gate failures.
- CodeQL, dependency review, `pnpm audit`, GitGuardian, zizmor, and OpenSSF Scorecard provide complementary source, dependency, secret, workflow, and posture checks.
- Workflow permissions default to read-only or none; write permissions are job-scoped.

### Build and release provenance

- CI builds from the lockfile with install scripts disabled and retains the exact `.next` artifact for a bounded period.
- An owner-authorized annotated tag rebuilds and verifies the source, packages the application, emits a SHA-256 checksum, creates a GitHub build-provenance attestation, and publishes both artifact and checksum.
- Tags are immutable and must reference a commit reachable from `origin/main` with matching package and changelog versions.

### Vercel environments

- Pull requests continue to receive Vercel Preview deployments.
- Vercel Git integration may build the merged `main` commit, but `github.autoAlias: false` prevents GitHub integration from automatically assigning that deployment to the production alias.
- Production uses the manually dispatched `Consensus Production Promotion` workflow. It requires the exact deployment URL, full current `main` SHA, `PROMOTE` confirmation, a protected GitHub `production` environment, and environment-scoped Vercel credentials.
- The workflow verifies project ownership, branch, commit, and READY state through Vercel before promoting without a rebuild, then smoke-checks the production URL.
- Rollback points production traffic to a previously verified deployment; it does not rebuild or mutate application data.

### Architecture not adopted

- Docker, GHCR, Trivy/Grype image scanning, Kubernetes, Helm, GitOps manifests, and Terraform are deferred until Consensus owns a container or cloud infrastructure that requires them.
- SonarQube, Snyk, and duplicate secret scanners are deferred while existing gates cover the relevant risks without new accounts, tokens, or alert duplication.
- Cross-repository reusable workflows are deferred until at least three owner repositories have a stable common contract. Until then, local workflows avoid an external availability and trust dependency.

## Consequences

- Workflow files are more verbose because immutable SHAs are explicit.
- Main merges stop changing the production alias automatically after this configuration is active. The owner must configure the production environment and secrets before expecting a promotion.
- Security posture becomes observable through code scanning and Scorecard, but findings still need triage and cannot be treated as proof of safety.
- Promotion uses a long-lived Vercel token because Vercel OIDC does not authenticate CLI/API deployment operations. The token must be scoped, stored only in the GitHub environment, rotated, and never exposed to pull-request jobs.
- Container/IaC controls can be added through a later ADR when the architecture creates that attack surface.
