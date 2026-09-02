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
  fingerprint/expiry. The previous token then fails.

## Host recovery transfer

CQ-209 implements recovery as an explicit transfer from a currently authorized
host browser to a replacement browser. The host requests a `hr1.*` code with 192
random bits; only a separately domain-keyed fingerprint is stored, and the code
expires after ten minutes. Redeeming it consumes the challenge and replaces the
host participant's capability fingerprint in the same transaction. The old
cookie fails immediately, concurrent redemption has one winner, and a new
challenge replaces any earlier unredeemed challenge.

The one-time code is returned only by the authenticated, no-store initiation
response so the host can enter it on the replacement browser. It must never be
placed in a URL, QR code, log, analytics event, persistent browser storage, or
room payload. Redemption is same-origin, bounded, per-source/per-room rate
limited, and maps malformed, missing, expired, reused, and wrong-room attempts to
the same public absence.

This is not recovery after every authorized host device and the transfer code
have both been lost. Supporting that case requires an account, a pre-enrolled
recovery factor, or another trusted identity proof and is deliberately deferred;
an invitation locator alone can never take over a room.

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
