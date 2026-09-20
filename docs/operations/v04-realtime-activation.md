# v0.4 realtime activation and recovery (not yet executed)

This is a preparation checklist, not evidence of deployment or milestone exit.
The adapter is off by default. Its room event is a metadata-only hint; Neon
remains authoritative. [ADR 0018](../adr/0018-realtime-transport-candidate.md)
is proposed, not accepted.

## Owner gates in order

1. Review the provider comparison and measured-spike plan. Explicitly accept
   or reject ADR 0018. The code's optional Ably adapter does not provision it.
2. Separately approve a distinct non-production provider app/key and budget
   ceiling. Configure the key for server-side publish and token issuance only;
   the browser must never see it. Record the plan, region and quota alerts.
3. Separately authorize reviewed migration `0006` on the exact shared
   non-production Neon database. The migration adds lease/retry/poison/expiry
   columns and grants runtime DELETE only for bounded expiry maintenance.
4. Set only non-production Vercel secrets `CONSENSUS_ABLY_API_KEY` and
   `CONSENSUS_OUTBOX_WORKER_SECRET` (a distinct random secret). After migration
   `0006`, set `CONSENSUS_OUTBOX_RETENTION_ENABLED=true` so the existing daily
   retention job removes expired outbox rows even during a transport rollback.
   Keep `CONSENSUS_REALTIME_ENABLED` unset/false until the database, provider and
   protected worker check are ready. Never put secrets in source, a PR comment,
   or `NEXT_PUBLIC_` variables.
5. Turn `CONSENSUS_REALTIME_ENABLED=true` only in the approved Preview target;
   record the exact URL and SHA. A 204 token response means intentionally off;
   a 503 means active configuration is incomplete or unavailable.
6. Run the separately authorized synthetic host/guest acceptance on the
   protected Preview deployment. Verify 2/4/8-device admission, roster lock,
   votes, result, reconnect, expired/denied capability, cross-room attempt,
   provider outage and polling recovery. Verify all synthetic aggregates are
   deleted under an exact-match guard after evidence capture.
7. Decide the publisher recovery trigger and quota monitoring before Production.
   The normal after-response attempt is fast but not durable scheduling by
   itself; the outbox is durable. A manual protected worker request can drain
   due batches, but Hobby Vercel Cron cannot run more often than daily.
   Never claim a guaranteed 1.5-second peer SLO from that fallback alone.
8. Production requires a separate exact-candidate promotion authorization,
   independent Production provider app/key and worker secret, exact Production
   migration authorization, observability/rollback review, and post-promotion
   browser evidence. A Preview pass does not authorize any of those steps.

## Protected worker and observability

The server-only `/api/internal/outbox` endpoint requires the distinct worker
bearer secret for both methods. `GET` returns ready/leased/poisoned counts,
oldest-ready age and a health state. `POST` claims at most ten due rows, sends
only the versioned hint, and reports count-only outcomes. It does not publish
rows from uncommitted transactions. Never log or copy the secret, URL query
parameters, event payload, member IDs or room IDs into monitoring artifacts.

The daily retention job deletes up to 500 expired outbox rows when
`CONSENSUS_OUTBOX_RETENTION_ENABLED=true`, in addition to its existing bounded
aggregate deletion. Keep this switch on when disabling realtime delivery for
rollback. Inspect the
count-only `consensus.realtime.outbox.batch`,
`consensus.realtime.outbox.retention`, and `consensus.room.command.ack` logs.
The publisher batch logs p50/p95/p99 commit-to-provider lag without room data.

Initial beta alert thresholds for the protected health response:

| Signal                   | Investigate                                                 | Immediate action                                                   |
| ------------------------ | ----------------------------------------------------------- | ------------------------------------------------------------------ |
| Poisoned rows            | Any nonzero count                                           | Inspect provider availability and retry cause; never dump payload. |
| Oldest ready event       | Over 30 seconds                                             | Run a protected drain and verify fresh publication.                |
| Acknowledgement latency  | p95 over 750 ms in a measured window                        | Check database and Function runtime.                               |
| Visible peer convergence | p95 over 1.5 seconds in a measured supported-network window | Check publisher/transport and polling recovery before rollout.     |

These are proposed beta thresholds; the repository has no external alert sink
configured and no valid production measurement yet. A green count-only health
response is not proof of peer convergence.

## Failure and rollback

- Provider down or quota reached: keep commands accepting only through the
  existing transactional API; show polling backup and inspect outbox lag.
- Publisher dies mid-lease: a later worker reclaims after lease expiry and
  republishes with the same event ID. Duplicate hints are harmless.
- Token/projection denied: do not reconnect with an invitation locator as
  authority; return to explicit join/recovery as the existing client does.
- Poisoned row: investigate code/quota, retain safe error code/count, and use a
  reviewed targeted recovery procedure. Do not delete, edit or bulk replay
  shared rows without a separate owner-approved plan.
- Rollback transport: disable the realtime flag in the affected environment;
  do not reverse migration `0006` or rewrite accepted votes. Polling remains
  the product fallback. Verify the exact deployment and room flow afterward.
