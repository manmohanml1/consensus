# CQ-200: Establish the v0.3–v1.0 delivery backlog

**Milestone:** 0.3.0  
**Type:** operations  
**GitHub:** [#110](https://github.com/manmohanml1/consensus/issues/110)

Create a repository-owned, dependency-ordered GitHub delivery backlog for every roadmap milestone from 0.3.0 through 1.0.0.

## Acceptance

- eight GitHub milestones represent versions 0.3.0 through 1.0.0;
- exactly 100 bounded roadmap work items use stable CQ identifiers, explicit dependencies, and acceptance evidence;
- the repository records the backlog distribution and an idempotent create-only synchronization path;
- synchronization refuses duplicate CQ identifiers or title drift and never overwrites, closes, or deletes existing issues;
- provider, paid-resource, production-data, tag, and release gates remain unchanged.

CQ-200 tracks the planning infrastructure itself and is intentionally separate from the 100 roadmap work items in the manifest.
