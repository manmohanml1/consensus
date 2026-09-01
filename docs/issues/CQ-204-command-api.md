# CQ-204: Idempotent command and projection API

**Milestone:** 0.3.0  
**Type:** feature  
**Depends on:** CQ-202, CQ-203

Implement versioned room commands, compare-and-set revisions, participant
sequences, locked-voter snapshots, exact idempotent replay, and atomic outbox
projections. Expose the command boundary through a same-origin, capability-scoped
Node.js route and fail closed when server configuration is absent.

**Done when:**

- one transaction owns the room lock, mutation, revision, accepted command, and outbox event;
- an exact retry returns the stored result and conflicting idempotency reuse fails;
- stale revision and actor sequence errors include only the trusted current revision;
- late participants cannot enter the snapshotted electorate;
- disposable PostgreSQL tests prove duplicate safety, stale behavior, atomicity, and roster integrity.
