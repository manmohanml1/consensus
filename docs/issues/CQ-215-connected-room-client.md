# CQ-215: Connected secure-room web journey

**Milestone:** 0.3.0  
**Type:** feature  
**Depends on:** CQ-204, CQ-206, CQ-207, CQ-209, CQ-210, CQ-213  
**GitHub issue:** [#142](https://github.com/manmohanml1/consensus/issues/142)  
**Status:** implementation in review; protected Preview happy path verified

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

A two-browser Playwright suite demonstrated creation, joining, admission, roster
lock, voting, resolution, result, and refresh on one immutable protected Preview.
Local suites cover denial, recovery, and expiry; those states remain in the final
Preview exit review. Synthetic cleanup is a separately authorized operation, not
an automatic test side effect. No Production activation, promotion, tag, or
release is implied.

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

Local automated evidence covers the UI orchestration and server contracts,
including denial, authenticated terminal expiry, recovery-code clearing,
participant departure, five responsive widths, keyboard entry, and reduced
motion. The
2026-09-03 owner-dispatched run for commit `7804dd5` passed the connected happy
path using independent host and participant contexts while Vercel deployment
protection remained enabled. Runtime review showed expected 2xx room traffic and
no warning/error/fatal application events; the PostgreSQL client emitted one TLS
forward-compatibility warning that must be hardened before a driver-major
upgrade. The corresponding negative-state, responsive, accessibility, and
console review against the protected Preview artifact remains before CQ-215 can
close. The separately authorized
cleanup removed all seven PR #143 synthetic rooms and verified zero dependent
rows. See [the acceptance record](../operations/2026-09-03-cq215-protected-preview-acceptance.md).

The owner-dispatched `Consensus Quality` acceptance job is the only hosted path
for that test. It is environment-scoped to `Preview`, validates the Vercel host
before it receives the bypass secret, and requires a separate owner cleanup
authorization after the test has recorded its exact non-sensitive title.
The final prepared revision reuses one room across admitted, denied, recovered,
revoked-host, and missing-room checks and also records responsive overflow and
browser-console failures; preparation and local static validation do not imply
authorization to dispatch it.
