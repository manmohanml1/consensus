# PR 156 session-continuity acceptance and cleanup

**Date:** 2026-09-17 EDT / 2026-09-18 UTC  
**Scope:** shared non-production Preview only  
**Prerequisite PR:** [#155](https://github.com/manmohanml1/consensus/pull/155), merged as `c4b86a2`  
**Accepted PR:** [#156](https://github.com/manmohanml1/consensus/pull/156), merged as `512b59d`  
**Accepted head:** `972bba70e687c6fe59a33b081d40b7b6b2bf0d40`  
**Immutable Preview:** `https://consensus-rj9kd5m83-manmohanlonawat-8572s-projects.vercel.app`  
**Workflow run:** [35296252871](https://github.com/manmohanml1/consensus/actions/runs/35296252871)  
**Synthetic title:** `Preview acceptance PR156-972bba7`

## Accepted evidence

The owner authorized one protected Preview attempt after the two stacked pull
requests were merged in dependency order. The stateful Playwright job passed in
one attempt using isolated host, admitted-participant, denied-participant, and
recovered-host browser contexts. It covered admission, locked voting,
resolution, matching results, recovery authority rotation, revoked/missing
privacy equivalence, responsive overflow, and browser-error classification.

The accepted client additionally carries deterministic local and CI evidence
for reload continuity in lobby, voting, and result; no duplicate membership;
monotonic revision and actor-sequence reconciliation; exact idempotent retry of
uncertain commands; terminal expiry; and bounded polling recovery.

## Exact cleanup

The owner then authorized exact cleanup of the resulting shared non-production
aggregate. A guarded transaction locked the sole room matching the exact title,
deleted exactly one room, `room_f39b1b53d6b048329b719e486fe462cc`, and relied
on reviewed foreign-key cascades. A separate post-commit query returned zero for
the exact title and room ID across rooms, participants, constraints, candidates,
commands, votes, decisions, outbox events, commitments, and host-recovery
challenges. No unrelated title or room was targeted.

## CI concurrency finding

The manual acceptance initially shared `quality-${workflow}-${ref}` with the
post-merge `main` push and therefore canceled that authoritative run. No product
or persistence assertion failed. The canceled run
[35296033350](https://github.com/manmohanml1/consensus/actions/runs/35296033350)
was rerun after acceptance and passed verify, the disposable PostgreSQL
migration/recovery rehearsal, production dependency audit, and aggregate
`build-and-test` gate.

Issue [#158](https://github.com/manmohanml1/consensus/issues/158) isolates event
types and assigns each stateful manual dispatch a unique, non-canceling group.
Push and pull-request runs retain cancellation of superseded work for the same
ref, and workflow-policy validation prevents the shared key from returning.

## Production boundary

No Production promotion, database mutation, tag, or release occurred. Inspection
after acceptance confirmed `https://consensus-web-navy.vercel.app` still resolved
to deployment `dpl_DzswA1BFRYdxcvprrkxeQQH29kUE`, the previously promoted
`consensus-r6wub9lr9-manmohanlonawat-8572s-projects.vercel.app`. The new `main`
candidate was built separately and was not assigned the stable Production alias.
