# Software supply-chain inventory

## Application dependencies

- Node.js runtime: major `24`, declared in package manifests and CI.
- Package manager: `pnpm@11.19.0`, declared in the root manifest and CI.
- Dependency source of truth: root `pnpm-lock.yaml` for all workspaces.
- Update path: grouped Dependabot pull requests plus automated security-fix pull requests; no dependency PR is auto-merged. Production high/critical audit and dependency review are blocking gates.
- Install policy: frozen lockfile and `--ignore-scripts` in CI. Any dependency requiring an install script needs an explicit, reviewed exception.

## GitHub Actions dependencies

- Every external action is pinned to a full commit SHA with the reviewed release in an inline comment.
- Dependabot checks the `github-actions` ecosystem monthly.
- GitHub automated security fixes propose reviewable pull requests when a vulnerable dependency has an available patch.
- `pnpm workflow:check`, zizmor, and OpenSSF Scorecard detect workflow and supply-chain regressions.
- Reusable workflows from external repositories are not currently trusted dependencies.

## Build and hosting dependencies

- Vercel Git integration builds Next.js Preview and non-aliased main candidates.
- Production promotion uses the Vercel REST API with environment-scoped credentials and does not rebuild the artifact.
- GitHub Actions produces bounded CI artifacts; tagged releases add a checksum and GitHub provenance attestation.

## Test-only database image

- Persistence integration tests use the Docker Official Image for PostgreSQL
  `18.6-alpine3.23`, pinned to the reviewed linux/amd64 manifest digest in the
  quality workflow.
- The service exists only for the bounded job, binds only to the runner, uses
  trust authentication with synthetic data and no credential, receives no
  repository or provider secret, and is discarded with the runner.
- Dependabot does not update service-image digests automatically; CQ-202 records
  the initial pin and future updates require a reviewed digest and migration suite.

## Provider dependencies

Database, realtime, place, analytics, reservation, and payment providers are not selected by this record. Each requires its milestone ADR, licensing/cost review, data-flow update, threat-model update, retention plan, outage behavior, and explicit owner approval.

## Deferred inventories

An SPDX or CycloneDX SBOM becomes a release requirement before public `v1.0.0` or earlier when Consensus ships a container, distributes packages, accepts a provider with transitive runtime agents, or has a compliance/customer requirement. Container image inventories do not apply while no image is built or operated.
