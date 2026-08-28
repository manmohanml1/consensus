# Versioning and releases

Consensus uses Semantic Versioning for product releases and Conventional Commits for change classification. Version numbers communicate compatibility; they do not grant permission to merge, deploy, tag, or release.

## Product version

The root package, `@consensus/web`, and `@consensus/domain` share one product version. Their `package.json` versions must agree with the release tag and corresponding `CHANGELOG.md` heading.

Until `v1.0.0`, minor versions may introduce planned product capabilities and contract changes. Breaking changes must still be called out explicitly in commits, the changelog, and migration or compatibility records.

## Conventional Commit classification

| Commit type                             | Product meaning                                  | Normal SemVer candidate |
| --------------------------------------- | ------------------------------------------------ | ----------------------- |
| `feat:`                                 | Backward-compatible product capability           | Minor                   |
| `fix:`                                  | Backward-compatible defect correction            | Patch                   |
| `perf:`                                 | Backward-compatible performance improvement      | Patch                   |
| `feat!:` or `BREAKING CHANGE:`          | Incompatible product or contract change          | Major                   |
| `docs:`, `test:`, `build:`, `ci:`, etc. | Repository work classified by its primary intent | No release by itself    |

The other accepted types are `chore:`, `refactor:`, and `revert:`. Scopes are optional, for example `feat(room): add invitation locator` or `fix(vote): reject duplicate sequence`. Pull-request titles and every commit subject must use the same syntax. Squash merges use the validated PR title as the resulting `main` commit subject.

## Release and tag invariants

1. **Explicit owner authorization is required.** A completed milestone, merged PR, green workflow, Preview, or production deployment does not authorize a tag or GitHub Release. The owner must request the exact version.
2. **Stable releases use annotated tags.** Tags have the form `vMAJOR.MINOR.PATCH`, such as `v0.3.0`.
3. **Prereleases are explicit.** Supported suffixes are `-preview.N`, `-beta.N`, and `-rc.N`. Environments such as `dev`, `test`, `stage`, and `prod` never appear in the product version.
4. **Release sources come from `main`.** The tagged commit must be reachable from `origin/main`, pass the complete release gate, and contain matching root, web, and domain versions.
5. **Tags are immutable.** Never move, replace, or reuse a published version tag. Corrections receive a new patch or prerelease number.
6. **Deployment and release are separate.** An application commit may deploy without immediately receiving a product tag. A tag may be prepared only after its version-bump PR is explicitly merged.

The repository currently records `0.1.0` as its version baseline. No tag or GitHub Release exists yet. The first annotated remote tag will be created only after the owner explicitly authorizes both the version-bump merge and the exact release tag.

## Release procedure

1. Choose the version from the changes since the last tag and the classification table above.
2. Create a `release/vMAJOR.MINOR.PATCH` branch and update all three package versions plus `CHANGELOG.md`.
3. Run `pnpm release:check -- --tag vMAJOR.MINOR.PATCH` and `pnpm verify`.
4. Open a Conventional Commit PR such as `chore(release): prepare v0.3.0`; leave it unmerged.
5. Merge only after the owner explicitly authorizes that PR.
6. Ask for separate owner authorization to create and push the exact annotated tag.
7. Push the annotated tag. The release workflow rechecks provenance and versions, runs the full verification suite, packages the application, and creates the GitHub Release.
8. Verify the release artifact and production behavior; document rollback or follow-up work.

## Independent compatibility versions

Product SemVer does not replace compatibility identifiers for:

- decision rulesets;
- room command and event schemas;
- room projection schemas;
- place normalization schemas;
- database migrations;
- analytics event schemas.

Historical decisions retain the ruleset and candidate facts used at resolution. Never reinterpret them using current rules.
