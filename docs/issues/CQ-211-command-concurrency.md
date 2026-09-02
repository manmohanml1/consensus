# CQ-211: Command concurrency and duplicate delivery

## Evidence

The disposable PostgreSQL integration suite sends pairs of identical operations
in parallel for roster lock, host voting, and decision resolution. For every
pair, exactly one transaction is newly accepted and the other receives the exact
persisted idempotent result. Database evidence proves three commands, one vote,
one decision, and aggregate revision three.

An additional race expires a room before two concurrent mutations. Both fail
with the same authorization absence and neither can revive the aggregate.
Existing coverage also verifies stale revisions, invalid participant sequences,
conflicting idempotency-key reuse, unique database constraints, and a late member
remaining outside the locked electorate.

These tests run against the disposable PostgreSQL service in CI. Applying the
new forward migration to shared Neon remains a separate owner-authorized step.
