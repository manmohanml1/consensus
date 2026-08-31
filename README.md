# Consensus

Consensus is a constraint-aware group decision product that helps people move from “what should we do?” to a plan everyone can accept.

The first product wedge is nearby food: one person starts a room, the group agrees on non-negotiables, everyone reacts to a short list, and the system explains why a recommendation won. The swipe interaction is a fast input method—not the product’s defensible value.

## Repository status

Version `0.1.0` is a provider-independent foundation and single-device product slice. It contains:

- a Next.js App Router application shell;
- a deterministic, tested decision engine;
- a sample decision room with accessibility and reduced-motion support;
- repository-owned product, architecture, security, delivery, and milestone contracts;
- GitHub issue templates and issue-ready milestone plans;
- quality, security, dependency, and release workflows.

Realtime rooms, persistent votes, and external place data are intentionally not simulated. They begin only after their milestone ADRs, provider provisioning, and security gates are satisfied.

## Start locally

Prerequisites: Node.js 24 and pnpm 11.

```bash
pnpm install
pnpm dev
```

Open <http://localhost:3000>.

## Verify

```bash
pnpm verify
```

The verification gate includes release-version alignment, immutable GitHub Actions policy, lint/type checks, domain and web tests, a production build, and browser acceptance. See [DevSecOps controls](docs/DEVSECOPS.md) and [deployment and promotion](docs/DEPLOYMENT.md) for security and release operations.

## Source of truth

Read [docs/PROJECT_GUIDE.md](docs/PROJECT_GUIDE.md), [ROADMAP.md](ROADMAP.md), and [AGENTS.md](AGENTS.md) before changing scope or architecture. Milestone completion does not authorize a deployment, tag, GitHub release, paid service, or production data change.

## Reference provenance

The initial idea and interaction reference came from `manmohanml1/project-blueprints/projects/consensus`. This repository deliberately corrects its infrastructure, data-quality, state-authority, and decision-fairness assumptions. Development and delivery patterns were adapted from the owner’s `portfolio-website`, `commitquest`, and `ghostwriter` repositories; their product concepts were not copied.
