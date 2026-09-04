# CQ-215 protected Preview acceptance

**Date:** 2026-09-03 EDT / 2026-09-04 UTC  
**Scope:** shared non-production Preview only  
**Pull request:** [#143](https://github.com/manmohanml1/consensus/pull/143)  
**Commit:** `7804dd5fd2a38621ab83dc01aef0575364de0b2b`  
**Workflow run:** [33828365642](https://github.com/manmohanml1/consensus/actions/runs/33828365642)  
**Immutable Preview:** `https://consensus-9587tx8py-manmohanlonawat-8572s-projects.vercel.app`  
**Synthetic title:** `Preview acceptance PR143-7804dd5`

## Authorized execution

The owner stored the Vercel automation bypass in GitHub's protected `Preview`
environment and authorized the protected Preview run. The secret was supplied to
the job at runtime, was not printed, and was not committed. Vercel deployment
protection remained enabled. Production configuration, data, aliases, releases,
and tags were not touched.

The stateful Playwright check made exactly one attempt with independent host and
participant browser contexts. It passed:

- host room creation and authority-free invitation generation;
- participant join in pending state and explicit host admission;
- roster lock followed by complete host and participant ballots;
- host resolution and consistent committed result in both contexts after
  refresh.

The run used expected optimistic-revision synchronization and failed no product
assertion. Persistence migration and disposable recovery rehearsal also passed.

## Runtime review

Vercel runtime logs for deployment `dpl_BM4Ux4qHCMSePbRnFDFHXKVtceM4` showed
expected 2xx responses for creation, join, projection, and command requests. The
dashboard reported zero warning, error, and fatal console-level events. One
request carried a PostgreSQL client process warning: current `sslmode=require`
is treated as `verify-full`, but a future `pg`/`pg-connection-string` major will
adopt weaker libpq semantics for that spelling. Before such an upgrade, make the
certificate-verifying mode explicit in the connection configuration and test it
in non-production.

## Remaining gates

- Execute the final negative-state Preview review for denial, expiry, recovery,
  missing-room, and unauthorized projections.
- Complete responsive, keyboard, reduced-motion, accessibility, and browser
  console review against the accepted artifact.
- Enumerate all exact `Preview acceptance PR143-*` synthetic aggregates, then
  obtain separate owner authorization before deleting only those aggregates.
- Rotate or revoke the automation-bypass credential when protected Preview
  acceptance no longer needs it.

PR merge, Production promotion, a semantic version tag, and a GitHub Release
remain separate explicit owner decisions.
