# CQ-199 — Owner-gated Git and semantic releases

- GitHub issue: [#112](https://github.com/manmohanml1/consensus/issues/112)
- Type: operations
- Phase: 0.3.0 governance
- Status: complete on `main` through PR #121

## Outcome

Consensus follows Ghostwriter's repository-maintenance pattern: protected linear `main`, squash commits derived from validated Conventional Commit pull-request titles, aligned Semantic Versions, immutable annotated release tags, and separate explicit owner gates for merges, production promotions, tags, and GitHub Releases.

## Acceptance

- Repository instructions make per-PR owner merge authorization unambiguous.
- GitHub validates Conventional Commit PR titles and commit subjects.
- `main` requires a pull request, the aggregate quality gate, current branches, resolved conversations, linear history, and applies protection to administrators.
- GitHub accepts squash merges only and derives the `main` commit subject from the validated pull-request title.
- Tag verification and GitHub Release publication use separate protected workflows and explicit owner approvals.
- Package and changelog versions are checked locally and again before a tag can publish a release.
- PR #121 was squash-merged only after explicit owner authorization; no tag or GitHub Release was created.

## Non-goals

This work does not create or push a release tag, publish a GitHub Release, promote a production deployment, or merge its own pull request.
