# Delivery workflow

This is the required path from an idea to a deployed change.

```text
roadmap item
  -> local CQ issue record
  -> GitHub issue
  -> topic branch and pull request
  -> implementation + tests + records
  -> pushed commit
  -> CI and review
  -> preview gate when applicable
  -> explicit owner approval for this exact merge
  -> issue closes through the merged PR
  -> optional, separately authorized production promotion
  -> production smoke/log verification when promotion occurs
  -> separately authorized tag and GitHub Release when requested
```

## Before implementation

1. Select one bounded outcome from the next active milestone.
2. Create or update `docs/issues/CQ-*.md` with scope, dependencies, and measurable completion criteria.
3. Create the matching GitHub issue and copy its URL/number into the working pull request.
4. Identify whether the work changes product behavior, architecture, security, privacy, data, cost, or deployment. Update or add the governing record before implementation when consequential.

## While implementing

- Keep the branch and pull request mapped to the issue list.
- Push every coherent increment after its proportional tests pass.
- Convert independent discoveries into GitHub issues and local CQ records.
- Update the PR body as issue scope changes; never rely on chat history as the project record.
- Do not create providers, deployments, domains, secrets, migrations, releases, or paid resources without the owner gate defined in the relevant record.
- Stop with the pull request open after it is review-ready. Do not merge unless the owner explicitly authorizes that pull request's merge.

## Pull-request completion

A pull request is ready only when:

- every completed issue appears as `Closes #<number>`;
- every deferred finding has a linked follow-up issue;
- `pnpm verify` passes locally and in GitHub Actions;
- visual changes include phone and desktop evidence;
- risk, recovery, security/privacy impact, and deployment impact are explicit;
- changelog, roadmap, milestone, ADR, API/data, runbook, and owner instructions agree with the implementation.

An issue closes when the implementing pull request merges, not merely when code is pushed. A PR may contain multiple tightly coupled issues, but each must have independently verifiable acceptance criteria.

## Owner-only merge authorization

Merge authorization is per pull request and per merge attempt. It cannot be inferred from green checks, a successful Preview, review approval, task-completion wording, permission to push or create a PR, a prior merge authorization, or a request to continue with later work.

The default terminal state for implementation work is an open, review-ready pull request. The owner must explicitly say to merge that PR before any person, agent, CLI, API, or automation performs the merge. Production promotion remains a separate gate even after a merge.

## Deployment gate

Every deployment-capable pull request states one of: no deployment impact, Preview required, or Production promotion requested. Preview and Production steps must list owner actions, required secret names, verification, rollback, cost implications, and data/migration effects. Secret values never enter issues, pull requests, logs, or repository files.

Conventional Commit subjects are required for authored commits and pull-request titles. A true multi-parent Git merge commit created solely to synchronize a topic branch with `main` is exempt from subject validation; this keeps protected-branch freshness compatible with the policy without exempting ordinary commits.
