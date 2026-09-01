# Anonymous room capabilities

Consensus remains zero-signup, but every state-changing room operation is
authenticated. CQ-203 implements the server-only capability primitive in
`packages/security`; CQ-204 consumes it for private command/projection routes,
while public room creation, join, and recovery remain later issues.

## Token and storage contract

- A capability is `c1.` plus 32 cryptographically random bytes encoded as
  base64url. The version prefix allows deliberate future migration.
- `CONSENSUS_CAPABILITY_PEPPER` is a distinct 32-byte base64url server secret per
  environment. HMAC-SHA-256 with a domain separator produces the stored 32-byte
  fingerprint.
- The raw token is available through a one-time delivery wrapper and is redacted
  by string conversion, JSON serialization, and Node inspection. Code that takes
  the token may only place it in the response cookie; it must not log, persist,
  analyze, or return it in a protocol body.
- Rotation issues a new token and transactionally replaces the participant row's
  fingerprint/expiry. The previous token then fails. Recovery policy and endpoint
  authorization are delivered by CQ-209.

## Authorization contract

The trusted server extracts the cookie, computes the fingerprint, queries within
the route room, and calls the authorization primitive with the stored record.
Success requires all of:

- fixed-length timing-safe fingerprint equality;
- matching room and, when required, member and role;
- active participant status;
- expiry strictly later than trusted server time.

Every other case returns `null`. Callers must map missing records, malformed
tokens, hash mismatch, expired/left participants, and cross-scope attempts to the
same `unauthorized-or-missing` public response. Do not disclose which check failed.

## Browser transport

The response uses `__Secure-consensus_room` with `HttpOnly`, `Secure`,
`SameSite=Lax`, no `Domain`, and a path of `/api/v1/rooms/<roomId>`. The same path is
required when clearing it. Multiple room-path cookies may coexist without exposing
capabilities to JavaScript, URLs, QR codes, analytics, or realtime payloads.

Cookie-authenticated commands require a same-origin `Origin` match before body
handling. Friendly invitation codes locate a room but never authorize a
participant.

## Pepper rotation

Changing the pepper invalidates every outstanding capability in that environment.
Rotation therefore requires an incident or planned reissuance flow, user-visible
room recovery behavior, environment-scoped secret update, and verification that
old tokens fail. A pepper must never be copied across Development, Preview, and
Production or exposed through `NEXT_PUBLIC_` configuration.
