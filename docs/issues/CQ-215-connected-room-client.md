# CQ-215: Connected secure-room web journey

**Milestone:** 0.3.0  
**Type:** feature  
**Depends on:** CQ-204, CQ-206, CQ-207, CQ-209, CQ-210, CQ-213  
**GitHub issue:** [#142](https://github.com/manmohanml1/consensus/issues/142)  
**Status:** implementation in review; immutable Preview acceptance pending

Connect the existing mobile-first decision interface to the secure room HTTP
boundary so separate host and participant browsers can complete a durable room
journey. This issue is part of v0.3 because the milestone outcome promises that
multiple anonymous participants can join and use a room; API-only evidence is
not a complete product outcome.

## Required journey

- the host creates a temporary room and receives a shareable locator containing
  no authority;
- a second browser joins in a pending state and the host explicitly admits it;
- each browser renders only its capability-authorized projection;
- the host locks the voter roster, both roles submit allowed commands, and the
  committed result and explanation are consistent after refresh;
- departure, denial, expiry, missing-room, unauthorized, and host-recovery states
  are clear without leaking whether another private room exists.

## Security and UX constraints

- raw capabilities stay in secure HTTP-only cookies and never enter URLs,
  browser storage, logs, analytics, or client-readable payloads;
- retries use idempotency keys and pending UI never claims an uncommitted state;
- the journey remains keyboard-operable, reduced-motion safe, and free of
  horizontal overflow at the 390-pixel mobile baseline;
- v0.3 may use explicit refresh or bounded polling. Realtime delivery,
  reconciliation, offline queuing, and convergence remain v0.4 responsibilities.

## Acceptance evidence

A two-browser Playwright suite and one immutable protected Preview demonstrate
creation, joining, admission, roster lock, voting, resolution, result, refresh,
denial, recovery, and expiry. Synthetic rooms are deleted after the Preview
acceptance run. No Production activation, promotion, tag, or release is implied.

## Current implementation boundary

The topic branch connects account-free creation, invitation, pending admission
and denial, manual candidate review, roster lock, private voting, deterministic
resolution, commitment, refresh-safe command sequencing, and one-time host
recovery to the existing HTTP boundary. The connected journey retains the
photo-led, swipe-optional, button-complete mobile interaction established in
v0.2.1 instead of presenting the secure workflow as a dashboard. Room creation accepts a small
provider-neutral manual candidate deck so the complete decision loop can be
proved without pretending illustrative entries are live venue data. Licensed
nearby discovery, venue photos, ratings, reviews, dishes, and map search remain
the separate v0.5 provider tranche.

Local automated evidence covers the UI orchestration and server contracts. The
issue stays open until the same two-browser journey, recovery/expiry states,
runtime logs, and synthetic cleanup are verified against one immutable Preview.
The 2026-09-03 live attempt proved that fresh contexts correctly encounter
Vercel Authentication before app code; it created no room. A durable opt-in
test now accepts only a runtime-provided automation bypass and explicit
synthetic cleanup title. Deployment protection remains enabled while the final
immutable-Preview evidence is pending.

The owner-dispatched `Consensus Preview Acceptance` workflow is the only hosted
path for that test. It is environment-scoped to `Preview`, validates the Vercel
host before it receives the bypass secret, and requires a separate owner cleanup
authorization after the test has recorded its exact non-sensitive title.
