# ADR 0017: Provider-neutral room update delivery

**Status:** Proposed for review

## Context

Room commands already commit the aggregate revision, immutable command result,
and outbox row atomically. Clients also reconcile monotonic projections through
bounded polling. Milestone 0.4 needs a transport without making provider messages
authoritative or exposing the full internal outbox payload.

## Decision

- Publish only a versioned `room.updated` hint containing event ID, room ID,
  committed revision, type, and occurrence time. It contains no projection,
  participant, ballot, constraint, locator, capability, or provider payload.
- A notification always causes the recipient to fetch its authorized current
  projection over HTTP. An event at or below the confirmed revision is ignored;
  a forward gap enters reconciliation. The transport never commits a vote or
  resolves a room.
- Claim outbox rows with PostgreSQL row locking and expiring leases. Publication
  is at least once, so the event ID is the provider idempotency key and repeated
  delivery must be harmless.
- Retry with bounded deterministic backoff. After the configured attempt ceiling,
  mark the row poisoned and expose only counts/age/error codes to operators.
  Never persist an exception message that may contain provider data.
- Retain outbox rows for seven days by default, independently of publication
  status, while aggregate deletion may remove them earlier by cascade.
- Keep bounded, jittered projection polling as the loss-safe fallback. Offline,
  delayed, reconciling, and current states are explicit in the mobile UI.

## Consequences

This creates the secure delivery boundary, leasing model, client state machine,
and deterministic disorder tests before a provider is selected. It does not
provision a service, open a public subscription endpoint, mutate shared Neon,
deploy Preview, or alter Production.

CQ-301 must still compare acknowledgement, fan-out, authorization, quotas,
observability, recovery, and cost. Connecting the selected adapter and applying
migration `0006` to a shared environment remain separately reviewed operations.

## Rollback

The publisher can remain disabled while projection polling continues. Reverting
the client badge/state machine removes only presentation and test behavior. The
forward-only database columns remain inert until a later migration contracts them.
