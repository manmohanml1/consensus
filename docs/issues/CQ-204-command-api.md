# CQ-204: Idempotent command and projection API

**Milestone:** 0.3.0  
**Type:** feature  
**Depends on:** CQ-202, CQ-203

Implement versioned room commands, compare-and-set revisions, participant sequences and authorized current projections.

**Done when:** concurrency tests prove duplicate safety, stale revision behavior and locked-roster integrity.
