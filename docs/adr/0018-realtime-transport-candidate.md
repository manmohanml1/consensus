# ADR 0018: Realtime transport candidate for v0.4

**Status:** Proposed; no provider selected or provisioned

**Reviewed source date:** 2026-09-19

## Context

Consensus needs low-latency hints for two to eight participants while Neon
remains the only authority for roster, votes and decisions. The existing
privacy-minimized event contract and transactional outbox are provider-neutral.
The initial beta should not assume a perpetual zero-cost production service.

## Candidate comparison

| Option                                     | Fan-out and free proof envelope                                                                                                                                                      | Authorization and recovery                                                                                                                                 | Fit / unresolved cost                                                                                                                        |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Ably Pub/Sub                               | Free proof tier currently allows 200 concurrent connections, 200 active channels and 6 million monthly messages; delivered fan-out counts toward usage.                              | Short-lived subscribe-only channel tokens can be issued after Consensus cookie authorization. REST message IDs support idempotent publish; SDK reconnects. | Strong candidate for the isolated spike, but connection/channel minutes and message usage require measurement before paid rollout.           |
| Pusher Channels                            | Sandbox currently advertises 100 concurrent connections and 200,000 daily messages.                                                                                                  | Private channels call an application authorization endpoint.                                                                                               | Smaller free concurrency envelope; idempotent outbox mapping and recovery need a measured prototype.                                         |
| Supabase Realtime                          | Free tier currently includes 200 peak connections and 2 million monthly messages.                                                                                                    | Private channels use RLS/JWT authorization.                                                                                                                | Would add a separate auth/RLS integration beside the existing Neon room capability boundary.                                                 |
| Vercel-hosted WebSocket + external pub/sub | Platform guidance is inconsistent: a Vercel knowledge-base page describes Function WebSocket support, while the current limits page says Functions cannot act as a WebSocket server. | Durable cross-instance fan-out would still need an external shared broker.                                                                                 | Not a safe default without a deployed compatibility/cost spike. Hobby Cron is once per day and cannot serve as a low-latency publisher loop. |

Sources: [Ably free limits](https://ably.com/docs/platform/pricing/free),
[Ably usage pricing](https://ably.com/docs/platform/pricing),
[Ably capabilities](https://ably.com/docs/auth/capabilities),
[Ably REST idempotency](https://ably.com/docs/api/rest-api),
[Pusher plans](https://pusher.com/channels/),
[Pusher private channels](https://pusher.com/docs/channels/using_channels/private-channels/),
[Supabase pricing](https://supabase.com/docs/guides/realtime/pricing),
[Supabase authorization](https://supabase.com/docs/guides/realtime/authorization),
[Vercel WebSocket KB](https://vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections),
[Vercel limits](https://vercel.com/docs/limits), and
[Vercel Cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing).

## Proposed direction, not an accepted provider decision

Use Ably as the first measured non-production candidate. The adapter in the
implementing PR is disabled unless `CONSENSUS_REALTIME_ENABLED=true` and its
server-side key is configured. A member first proves current room access with
its HTTP-only capability; the server then signs a 60-second, exact-room,
subscribe-only token request. The browser never receives the provider API key
or publish permission. The publisher sends only `RoomUpdateEvent`, with the
outbox event ID as Ably's idempotent message ID. Every received hint triggers
an authorized HTTP projection fetch; notification data is never a vote or a
decision. Sequential polling remains available if the adapter is off or fails.

The daily retention endpoint removes expired outbox rows after migration
activation, independently of the realtime delivery switch. The protected
outbox worker can expose count-only health and drain
due batches; an after-response publish attempt supplies the normal low-latency
path. This does not create a guaranteed frequent retry scheduler. A later
operator decision must cover recovery invocation frequency and cost.

## Security and product limits to measure

- A token minted just before a capability is revoked can continue receiving
  **metadata-only hints** for up to its 60-second lifetime. The projection
  endpoint rejects revoked authority immediately. Determine whether provider
  token revocation or a shorter TTL is required before CQ-307 is accepted.
- Do not enable the adapter until migration `0006` is separately applied to
  the exact non-production database and the distinct key/worker secret are
  scoped to that environment. Never use Production secrets in Preview.
- The measured prototype must record p50/p95/p99 acknowledgement, visible
  convergence, publish lag, reconnect duration, lost/duplicate hints, token
  refresh, 2/4/8-device behavior, and expected connection/channel/message
  consumption. Include a revoked member, cross-room attempt, provider outage,
  publisher crash, and polling fallback.
- Compare the result against at least one alternative under the same workload;
  revise this ADR if Ably misses the cost or reliability envelope. Owner
  acceptance and separate provisioning authorization remain required.

## Rollback

Turn `CONSENSUS_REALTIME_ENABLED` off, keeping the independent outbox-retention
switch on after migration `0006`. No room command or decision depends on
notifications, so authorized projection polling continues. Investigate and
drain the durable outbox before re-enabling; do not drop or rewrite committed
room state as a transport rollback.
