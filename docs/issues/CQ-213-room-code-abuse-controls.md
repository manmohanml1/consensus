# CQ-213: Room-code abuse and enumeration controls

## Delivered baseline

Room creation is bounded by five requests per ten minutes per transient,
privacy-preserving source bucket. The process stores only an HMAC-derived bucket
identifier, never a raw address. Operators can immediately stop new room
creation with `CONSENSUS_ROOM_CREATION_ENABLED=false`.

## Boundary and limitations

This is intentionally a free-tier, per-runtime circuit breaker. It limits local
bursts and makes the safe failure state explicit, but cannot be represented as a
global DDoS control across serverless instances. CQ-507 owns durable,
cross-instance limits and false-positive recovery for public beta.

The current public room surface does not expose location, joining, or recovery
handlers. CQ-207 and CQ-209 must apply equivalent per-source and per-room rules
before they become reachable. Missing, expired, and unauthorized room access
continues to use the shared `unauthorized-or-missing` public error.

## Evidence

- Static/runtime tests verify bounded creation parsing and fail-closed behavior.
- The threat model, API contract, protocol document, and milestone status record
  the rate-limit behavior and its operational kill switch.
