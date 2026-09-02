# CQ-206: Room creation and invitation locators

## Delivered boundary

`POST /api/v1/rooms` creates a two-hour temporary room, its host participant,
and a random invitation locator in one PostgreSQL transaction. The host receives
the only raw authority through a one-time, HTTP-only, secure cookie scoped to
that room's API path. The JSON response contains the privacy-minimized room
projection plus a shareable `r1.*` locator and expiry.

## Security decisions

- Locators contain 128 random bits and are HMAC-SHA-256 fingerprinted under a
  domain separate from capabilities before storage.
- A locator is not an invite capability: it cannot read, mutate, or establish
  membership. CQ-207 owns participant admission and roster lifecycle.
- Creation bodies reject secret-like fields, unknown fields, oversized content,
  non-UTC timestamps, and unsupported protocol versions.
- Anonymous creation requires a matching same-origin `Origin`, preventing a
  third-party site from silently spending the room-creation quota.
- Missing capability/database configuration fails closed with a safe 503.

## Evidence

- Domain, security, web-boundary, and disposable PostgreSQL integration tests.
- API, room protocol, OpenAPI, threat model, and milestone documentation updated
  in the same delivery.
- Shared Neon migration, Preview secret activation, and Production promotion are
  intentionally not part of this issue.
