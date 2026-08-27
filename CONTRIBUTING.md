# Contributing

Read `docs/PROJECT_GUIDE.md`, `AGENTS.md`, and the active milestone before editing.

## Flow

1. Select the next unfinished roadmap item and ensure it has both a local `docs/issues/CQ-*.md` record and an open GitHub issue before implementation starts.
2. Branch from current `main` using `feat/`, `fix/`, `docs/`, `refactor/`, `perf/`, `test/`, `build/`, `ci/`, `chore/`, `release/`, `codex/`, or `dependabot/`.
3. Keep the change inside the linked issue acceptance boundary. Split newly discovered independent work into follow-up issues instead of silently expanding the pull request.
4. Commit and push every coherent, verified increment. Never leave completed work only on a local machine.
5. Open or update the pull request with `Closes #<issue>` for completed issues and `Follow-up: #<issue>` for deferred work.
6. Add focused tests, then run `pnpm verify`.
7. Include risk, recovery, screenshots for visual changes, and exact verification evidence.
8. Update the changelog, roadmap, milestone, ADR, deployment, operations, and owner-setup records whenever their facts change.

See [docs/DELIVERY_WORKFLOW.md](docs/DELIVERY_WORKFLOW.md) for the definition of ready, definition of done, issue/PR mapping, and deployment gates.

Consequential provider, security, privacy, data, decision-rule, or deployment changes require an ADR before implementation.
