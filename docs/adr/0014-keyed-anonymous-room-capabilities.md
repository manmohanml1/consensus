# ADR 0014: Keyed anonymous room capabilities

**Status:** Accepted

## Context

Zero-signup rooms need authentication without durable accounts. Friendly room
codes are enumerable and bearer tokens stored directly would become credentials
after a database disclosure. Cookie delivery must also avoid URLs and browser
JavaScript while allowing one browser to participate in more than one room.

## Decision

Issue versioned capabilities containing 256 random bits. Store only a
domain-separated HMAC-SHA-256 fingerprint under an environment-specific 256-bit
server pepper. Verify fingerprints with a fixed-length timing-safe comparison and
then bind authorization to room, member, role, active status, and expiry. Limit
lifetimes to 24 hours and replace the stored fingerprint on rotation/recovery.

Deliver the raw value once in a fixed-name, room-path-scoped cookie with
`HttpOnly`, `Secure`, `SameSite=Lax`, and no `Domain`. Raw values are forbidden in
room protocol payloads, persistence, logs, analytics, realtime events, URLs, and QR
codes. All authorization failures remain publicly indistinguishable.

## Consequences

- A database snapshot alone does not contain usable bearer credentials.
- Pepper compromise plus database access requires environment-wide capability
  reissuance; changing the pepper intentionally invalidates outstanding rooms.
- Cookie-authenticated mutations still need origin/CSRF protection in CQ-204.
- Public create/join/recovery handlers remain separate CQ-206/CQ-209 work; this ADR
  supplies their security primitive without making the current fixture UI live.
