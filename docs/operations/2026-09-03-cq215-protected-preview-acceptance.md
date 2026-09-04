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

## Authorized cleanup

On 2026-09-03 EDT / 2026-09-04 UTC, the owner separately authorized removal of
the seven inventoried `Preview acceptance PR143-*` rooms. A fresh pre-delete
query reconfirmed exactly seven matches: two for `PR143-1213e06` and one each for
`PR143-0b0645f`, `PR143-c7b2c26`, `PR143-1f05c3a`, `PR143-a91229d`, and
`PR143-7804dd5`.

The cleanup matched all seven exact room-ID/title pairs and aborted unless the
affected row count was exactly seven. The statement completed successfully. A
separate read-only verification returned zero for the matching title pattern,
all seven room IDs, and every dependent aggregate table: participants,
constraints, candidates, commands, votes, decisions, outbox events,
commitments, and host-recovery challenges. No unrelated room was targeted.

## Remaining gates

- Local connected-UI regression coverage now passes for denial, authenticated
  terminal expiry, host recovery, participant departure, responsive widths,
  keyboard operation, and reduced motion. This is deterministic evidence, not a
  claim about the protected artifact.
- Dispatch the prepared final Preview revision against the exact accepted
  artifact. It reuses one labelled aggregate for denial, recovery rotation,
  revoked-host/missing-room equivalence, responsive overflow, and browser error
  checks; authenticated expiry remains covered by the disposable persistence
  and local connected-UI suites.
- Complete the manual keyboard, reduced-motion, and screen-reader review against
  the accepted artifact.
- Rotate or revoke the automation-bypass credential when protected Preview
  acceptance no longer needs it.

PR merge, Production promotion, a semantic version tag, and a GitHub Release
remain separate explicit owner decisions.

## Expanded-run evidence

On 2026-09-04 EDT, the owner authorized exactly one protected Preview acceptance
attempt for commit `873a57a2a043c13fc00f500b0d61c6e13958ef50`, immutable
deployment
`https://consensus-m6i6c921i-manmohanlonawat-8572s-projects.vercel.app`, and
synthetic title `Preview acceptance PR143-873a57a`. Workflow run
[33891798373](https://github.com/manmohanml1/consensus/actions/runs/33891798373)
reached room creation, admission and denial, voting and resolution, host
recovery, prior-host revocation, and missing-room privacy checks. Both revoked
and missing authorities received the same stable 404 public error fields.

The run then failed because the test compared the complete error envelopes and
therefore incorrectly required their intentionally unique per-request
correlation IDs to match. This was a test assertion defect, not a product,
authorization, or privacy failure. Responsive-overflow and final browser-console
assertions were positioned after the failing assertion and did not execute in
this hosted attempt. No automatic retry was made.

The run created one shared non-production aggregate labelled
`Preview acceptance PR143-873a57a`. It remains retained pending a separately
authorized, exact cleanup and zero-match verification. A corrected revision
must complete ordinary CI before the owner may authorize a new single-attempt
protected Preview run against that revision's immutable deployment.

## Corrected-run evidence

On 2026-09-04 EDT, the owner authorized exact cleanup of the retained
`Preview acceptance PR143-873a57a` aggregate. The guarded statement found one
match and deleted one room, `room_c8dc501172334db78ed3fc92787ca8a3`. A separate
verification returned zero for its exact title, room ID, and every dependent
room-owned relation.

The owner then authorized one protected attempt for commit
`dc7da2fa065f45911d2106aeab7fe9edf0f99459`, immutable deployment
`https://consensus-50mtg2w5t-manmohanlonawat-8572s-projects.vercel.app`, and
synthetic title `Preview acceptance PR143-dc7da2f`. Workflow run
[33899129394](https://github.com/manmohanml1/consensus/actions/runs/33899129394)
completed every product, authority, and responsive-overflow assertion. Its
final console assertion then failed on four expected attempts by Vercel's
Preview toolbar to frame `vercel.live`, which the application CSP correctly
blocked, and three expected browser 404 messages produced by the denied,
revoked-host, and missing-room checks. No page exception or unexpected API
response was reported.

The acceptance assertion now preserves zero tolerance for page exceptions and
unexpected console errors, requires the three deliberate negative-path 404s,
and permits only the narrowly identified Vercel toolbar CSP message. The CSP is
not weakened. No automatic hosted retry was made. The run created one aggregate
labelled `Preview acceptance PR143-dc7da2f`; it remains pending separately
authorized exact cleanup and zero-match verification.
