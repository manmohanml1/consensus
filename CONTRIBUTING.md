# Contributing to Consensus

Read `docs/PROJECT_GUIDE.md` before changing product behavior, architecture, persistence, provider integration, deployment, or release records.

## Workflow

1. Select the next unfinished roadmap item and ensure it has both a local `docs/issues/CQ-*.md` record and an open GitHub issue before implementation starts.
2. Create a short-lived branch from current `main` using `feat/`, `fix/`, `docs/`, `refactor/`, `perf/`, `test/`, `build/`, `ci/`, `chore/`, `release/`, `codex/`, or `dependabot/`.
3. Use Conventional Commit subjects for every commit and the pull-request title.
4. Keep the change inside the linked issue acceptance boundary. Split independent discoveries into follow-up issues instead of silently expanding the pull request.
5. Commit and push every coherent increment after focused tests pass. Never leave completed work only on a local machine.
6. Open or update the pull request with `Closes #<issue>` for completed issues and `Follow-up: #<issue>` for deferred work.
7. Run `pnpm verify` and complete the pull-request template with risk, recovery, screenshots for visual changes, exact verification evidence, privacy/security, and deployment impact.
8. Update the changelog, roadmap, milestone, ADR, deployment, operations, and owner-setup records whenever their facts change.
9. Leave the pull request open for the owner. Keep merges, production promotions, provider provisioning, annotated tags, and GitHub Releases behind separate explicit owner approvals.

## Owner merge gate

Only an explicit owner instruction to merge the specific pull request authorizes a merge. None of the following are merge permission:

- green CI or security checks;
- a successful Vercel Preview;
- an approval or resolved conversation;
- permission to commit, push, open a PR, continue, or complete a milestone;
- a previous instruction that authorized a different merge.

Agents and automation stop after making the PR review-ready unless the owner then explicitly says to merge it.

## Commit and release semantics

- `feat:` represents a SemVer minor candidate.
- `fix:` and `perf:` represent SemVer patch candidates.
- `feat!:` or a `BREAKING CHANGE:` footer represents a SemVer major candidate.
- `docs:`, `test:`, `build:`, `ci:`, `chore:`, `refactor:`, and `revert:` describe the change accurately but do not alone authorize or create a release.
- Product releases use annotated `vMAJOR.MINOR.PATCH` tags. Prereleases may use `-preview.N`, `-beta.N`, or `-rc.N`.
- A version bump, merged milestone, deployment, or successful workflow never authorizes a tag or GitHub Release. The owner must explicitly request the exact version.

See `docs/VERSIONING.md` and `docs/DELIVERY_WORKFLOW.md` for the complete contracts.

Consequential provider, security, privacy, data, decision-rule, or deployment changes require an ADR before implementation.
