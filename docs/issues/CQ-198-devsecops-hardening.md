# CQ-198 — CI/CD, supply-chain, and promotion hardening

- GitHub issue: [#114](https://github.com/manmohanml1/consensus/issues/114)
- Type: security and operations
- Phase: 0.3.0 governance
- Status: blocked on an owner-authorized rollback rehearsal

## Outcome

Consensus has architecture-appropriate DevSecOps controls: immutable workflow dependencies, blocking dependency review, workflow analysis, posture reporting, release provenance, accurate Vercel environment behavior, and owner-gated exact-artifact promotion.

## Acceptance

- All external actions use immutable SHAs maintained through Dependabot.
- Required CI rejects unsafe workflow policy and newly introduced high/critical dependencies.
- Releases contain checksums and GitHub provenance attestations.
- Vercel merge and promotion behavior matches the repository records.
- Owner setup, verification, rollback, cost, and secrets are documented.
- Container, Kubernetes, Terraform, automatic publishing, and duplicate scanners remain deferred until justified.
- PR #113 was merged only after explicit owner authorization. The staged Production promotion completed on 2026-08-31 and is recorded in `docs/operations/2026-08-31-production-promotion.md`. The remaining acceptance proof is a separately owner-authorized rollback-and-restore rehearsal.

## References

See ADR 0011 and `docs/DEVSECOPS.md` for the repository analysis and control matrix.
