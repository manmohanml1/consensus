# ADR 0016: Browser room session continuity

**Status:** Accepted

## Context

A valid HTTP-only capability outlived the React room state. Reloading an invite
could therefore submit another join instead of restoring the existing member.
Concurrent projection and command responses could also move the UI backwards.

## Decision

- Retain only a non-authoritative room ID and optional invitation locator in the
  current URL after successful create, join or recovery. Shared join links still
  contain only the invitation locator. Never put a capability or recovery code
  in the URL, localStorage, sessionStorage, analytics or a client-side cache.
- On reload fetch the authorized, no-store projection before exposing entry
  actions. A failed network request preserves the resume path; denial removes
  it and offers explicit admission/recovery rather than automatically joining.
- Reconcile all room responses by room, member, monotonic revision and monotonic
  next command sequence. Old projections cannot roll back later acknowledged
  state, including when an idempotent replay returns an earlier projection.
- Keep at most one outstanding command in memory. Uncertain delivery requires
  an explicit retry of the exact serialized command, including its timestamp,
  sequence and idempotency key. Block new mutations until it resolves. Known
  rejections refresh state but never silently rebase/replay user intent.
- Bound requests to ten seconds. Poll sequentially while visible, with bounded
  backoff and jitter on failures, immediate online/visibility recovery, and a
  visible interruption message. Stop polling expired rooms.

## Limits and consequences

This does not introduce a realtime provider, persistent offline command queue,
new database schema or new authentication mechanism. URL possession does not
grant read or write authority. Browser history can contain room/invitation
locators; those are not bearer credentials and still expire server-side.

Pending commands are not persisted across reloads. A fresh projection, not a
locally assumed vote, determines progress after reload. Exact uncertain replay
across a browser shutdown is outside this slice; do not claim durable offline
delivery. Create/join/recovery requests are not automatically retried because
those endpoints do not share the command idempotency contract.

Realtime event gap detection, transport handoff, transport SLOs and real-device
acceptance remain separate work. Reverting the client change leaves durable
room state and capabilities intact but removes reload continuity.
