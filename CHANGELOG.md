# Changelog

All notable changes follow Keep a Changelog and Semantic Versioning.

## Unreleased

### Fixed

- Compare stable privacy-preserving Preview error fields while independently
  validating unique per-request correlation IDs.
- Replace brittle browser-test network-idle waits with observable entry-mode
  state transitions that prove React hydration before form interaction.
- Render authenticated expired-room projections as terminal states and suppress
  stale invite, roster, recovery, departure, and voting controls.
- Replaced Production `script-src 'unsafe-inline'` with a unique per-request
  nonce and `strict-dynamic`, with browser regression coverage.
- Serialized the small Playwright browser matrix to prevent recurring local and
  constrained-runner hydration races during the release gate.
- Reconciled roadmap, milestone, deployment, governance, and operational records with merged `main`, and added a required documentation-state validator to prevent recurring drift.
- Made ESLint ignore generated Playwright output directories consistently so a clean Windows checkout does not require placeholder test artifacts.
- Made Vercel's Production-environment domain-assignment setting the authoritative staged-deployment control, removed the misleading `github.autoAlias` configuration, and reject Preview targets from the no-rebuild promotion workflow.
- Treat a successful empty Vercel promotion response as success instead of falsely failing after the production alias has moved.
- Verify that the Production hostname points to the exact promoted deployment and retain the first owner-gated promotion evidence.

### Added

- Connected-room browser coverage for privacy-preserving denial, expiry, host
  recovery, participant departure, responsive widths, keyboard use, and reduced
  motion in addition to the independent host/participant happy path.
- A mobile-first secure-room client for anonymous creation, private-link join,
  explicit admission/denial, manual candidate review, locked-roster voting,
  photo-led swipe/button ballots, match-style deterministic results, commitment,
  refresh-safe sequencing, and host recovery.
- An opt-in, protected-Preview acceptance check that keeps host, admitted,
  denied, and recovered browser authorities isolated; verifies capability
  rotation, indistinguishable absence, responsive overflow, and browser errors;
  and requires an explicit synthetic cleanup label.
- Transactional seeding of a bounded provider-neutral manual candidate deck at
  room creation, enabling the real v0.3 decision loop without claiming live
  venue data before the v0.5 provider tranche.
- A distinct least-privilege Neon runtime login, sensitive Preview/Development
  pooled URL, Preview-only capability pepper, protected Preview room-creation
  smoke evidence, and verified synthetic aggregate cleanup for CQ-201.
- An owner-authorized hosted Neon restore-branch rehearsal covering migrations
  0001–0005, runtime role separation, synthetic aggregate creation/deletion,
  and verified teardown for CQ-212.
- CQ-215 makes the connected mobile-first host/participant browser journey an
  explicit milestone 0.3 requirement instead of treating the secure API as the
  finished product.
- Host-authorized, ten-minute, one-use recovery transfers that atomically rotate
  host capability authority, revoke the prior cookie, and preserve command
  sequencing without accounts.
- Authenticated natural-expiry projections, irreversible expiry enforcement,
  bounded idempotent aggregate deletion, and comprehensive retention race/cascade
  coverage for CQ-208.
- A localhost-only disposable PostgreSQL snapshot/restore/teardown rehearsal and
  owner-gated migration, recovery, retention, and provider teardown runbook for
  CQ-212.
- Transactional, idempotent room commands and capability-authorized privacy-minimized projections, with compare-and-set revisions, participant sequences, locked-voter snapshots, same-transaction outbox records, CSRF checks, and disposable PostgreSQL integration coverage.
- Pending participant admission through non-authoritative locators, explicit host approval/removal and participant departure commands, immutable locked electorates, and duplicate lock/vote/resolve plus expiry-race evidence.
- Versioned 256-bit anonymous room capabilities with keyed one-way fingerprints, constant-time verification, one-time delivery wrappers, scoped secure-cookie serialization, and cross-room/member/role/expiry tests.
- Portable, forward-only PostgreSQL room migrations, least-privilege group-role bootstrap, checksum-protected migration runner, and disposable integration coverage for CQ-202.
- Owner-approved Free Neon PostgreSQL resource for disposable milestone 0.3 validation, connected only to Vercel Development and Preview with Neon Auth and deployment branches disabled.
- Private vulnerability reporting with documented response targets and review-gated Dependabot security-fix pull requests.
- ADR 0012 and a source-dated transactional database evaluation selecting Neon PostgreSQL for owner-approved, disposable non-production room persistence only.
- Owner-gated merge and release governance, Conventional Commit enforcement, and a machine-checked Semantic Versioning release preflight.
- Separate protected workflows for release-candidate tag verification and explicitly authorized GitHub Release publication.
- Immutable GitHub Action pins, blocking dependency review, workflow static analysis, OpenSSF Scorecard, release checksums/provenance, and exact-artifact Vercel production promotion.
- HSTS, cross-origin isolation metadata, and legacy cross-domain policy response headers with browser acceptance coverage.
- A repository-owned, idempotent 100-issue GitHub backlog for milestones 0.3 through 1.0.
- Versioned, provider-neutral secure-room command and projection contracts with bounded runtime validation and safe public errors.
- Mobile-first, photo-led ballot cards with optional horizontal swipe gestures and complete button fallbacks.
- Four locally generated, explicitly illustrative restaurant fixture images.
- Milestone 0.2.1 and ADRs for progressive responsive design and zero-cost validation controls.
- Issue-to-PR delivery rules and owner-facing Preview/Production setup gates.
- Installable PWA metadata, generated app icons, safe-area layout support, responsive-width acceptance coverage, and a manual iOS/Android device runbook.

### Planned

- Multi-device rooms, authoritative realtime state, production place data, and commitment handoffs.

## 0.1.0 - 2026-08-27

### Added

- Provider-independent Next.js application shell and decision-room slice.
- Deterministic constraint-first decision engine with tests.
- Product, architecture, security, privacy, delivery, and roadmap records.
- CI, CodeQL, dependency updates, issue templates, and release provenance checks.
