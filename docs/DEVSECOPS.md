# DevSecOps controls

This record maps repository threats to preventive, detective, and recovery controls. ADR 0011 governs the architecture and explains which external reference patterns were adopted or rejected.

## Required gates

| Risk                      | Preventive control                                                                | Detection or evidence                                    | Recovery                                                     |
| ------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------ |
| Unauthorized main change  | Protected `main`; PR required; explicit owner merge instruction                   | Branch protection and PR timeline                        | Revert through a new PR                                      |
| Compromised action tag    | Full commit-SHA pins; Dependabot review                                           | `pnpm workflow:check`; zizmor; Scorecard                 | Revert the action update and rotate exposed credentials      |
| Excess workflow authority | Top-level read/none permissions; job-scoped writes; checkout credentials disabled | Workflow policy and zizmor                               | Disable workflow, revoke tokens, inspect audit logs          |
| Vulnerable dependency     | Frozen lockfile; ignored install scripts; no automatic major updates              | Dependency Review, `pnpm audit`, Dependabot security PRs | Upgrade, remove, or explicitly document a bounded exception  |
| Source vulnerability      | Strict TypeScript, schema validation, tests                                       | ESLint, CodeQL extended queries, browser tests           | Patch through normal PR; security release if needed          |
| Secret exposure           | Environment-scoped secrets; no fork access; minimized job permissions             | GitGuardian plus review                                  | Revoke/rotate first, then investigate and prevent recurrence |
| Artifact substitution     | Exact commit/lockfile build; checksum; GitHub provenance attestation              | Release preflight and attestation verification           | Withdraw release and issue a new immutable version           |
| Wrong production artifact | Auto-alias disabled; exact URL/SHA/project validation; owner environment gate     | Promotion workflow summary and Vercel deployment record  | Promote the last verified deployment                         |
| Silent failed scanner     | Security gates do not use `continue-on-error: true`                               | Aggregate `build-and-test` status                        | Fix scanner/gate; never bypass silently                      |

## Workflow policy

`pnpm workflow:check` runs locally and inside the required CI job. It checks every workflow for:

- immutable 40-character SHA references for external actions;
- `persist-credentials: false` on checkout;
- a top-level permission declaration;
- bounded `timeout-minutes` on every job;
- absence of `pull_request_target`, `write-all`, and ignored failures.

Dependabot proposes reviewed SHA updates. Do not replace SHA pins with mutable major tags for convenience.

GitHub private vulnerability reporting is enabled and routes reporters to a private security advisory. Dependabot automated security fixes are enabled, but their pull requests remain subject to normal review and required checks; no security or dependency update is auto-merged.

GitHub's repository-level `sha_pinning_required` Actions policy is also enabled. The server-side setting and repository-owned validator are intentionally redundant: one blocks execution, while the other gives a fast local and review-time explanation.

## Security scanning cadence

- Every PR: formatting, lint, type checks, domain/web/browser tests, production build, production dependency audit, dependency review, CodeQL, GitGuardian, and workflow policy.
- Workflow changes: zizmor static analysis.
- Weekly and on `main`: CodeQL and OpenSSF Scorecard posture scan.
- Owner-authorized release tag: full verification, checksum, provenance attestation, and a retained release candidate without publication.
- Separately owner-authorized GitHub Release: protected `release` environment, exact existing annotated tag, full re-verification, checksum, provenance attestation, and immutable published assets.

Findings are triaged by exploitability, affected data, available fix, and exposure. A passing scanner is evidence, not a security guarantee.

## Deployment boundary

Vercel owns the build/runtime platform for the current application. Consensus owns source review, environment separation, exact-artifact approval, application security, secrets, provider configuration, smoke tests, and rollback selection.

Docker, Kubernetes, Terraform, image scanners, and GitOps configuration are added only when the repository owns those deployable resources. Adding unused infrastructure would create credentials, patching, cost, and recovery obligations without reducing the current risk.

## Owner setup still required

Before the first manual Production promotion:

1. Create a GitHub environment named `production`.
2. Add the owner as required reviewer and prevent administrators from bypassing the environment gate when the account plan supports it.
3. Store `VERCEL_TOKEN` and `VERCEL_PROJECT_ID` as environment secrets. Add `VERCEL_ORG_ID` only for a team-owned project; it is Vercel's `team_` identifier. `VERCEL_TEAM_ID` is temporarily accepted only as a team-owned compatibility alias.
4. Scope the Vercel token to the owning account/project where supported and record its rotation date outside the repository.
5. Keep production secrets unavailable to pull-request workflows.
6. Run one non-critical promotion and rollback rehearsal, then record results in the implementing PR or release record.

Secret values, project-link files, and copied deployment payloads never enter the repository.
