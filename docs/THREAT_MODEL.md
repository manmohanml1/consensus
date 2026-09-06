# Threat model

## Assets

Room membership, private constraints, votes, result integrity, approximate location, participant capabilities, provider credentials, and availability.

## Main threats and controls

| Threat                          | Control                                                                                                              |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Room-code enumeration           | 128-bit non-authoritative locator, keyed storage fingerprint, expiry, indistinguishable errors, and bounded attempts |
| Participant impersonation       | Server-issued capability stored hashed, rotated on recovery, scoped to one room/member                               |
| Forged/duplicate votes          | Server authorization, schema validation, command ids, participant sequences, unique constraints                      |
| Split-brain outcome             | Transactional authority and one ruleset version; clients never finalize                                              |
| Constraint disclosure           | Private ownership, aggregate explanations, log redaction                                                             |
| Location leakage                | Coarsening, short retention, no analytics, minimum provider disclosure                                               |
| Post-expiry data exposure       | Authenticated terminal projection, 24-hour capability maximum, bounded aggregate deletion, count-only logs           |
| Provider SSRF/injection         | Allowlists, fixed endpoints, encoded queries, timeouts, response size/schema limits                                  |
| Realtime flooding               | Per-IP/room/participant limits, message size bounds, backpressure and bans                                           |
| Malicious venue content         | Text sanitization, trusted image hosts, restrictive CSP, no raw HTML                                                 |
| Stale data causes unsafe result | Provenance/freshness labels, open-status confidence, user confirmation before action                                 |

Milestone 0.3 protocol payloads reject unknown fields, secret-like keys, role-incompatible commands, malformed identifiers and timestamps, incoherent projection states, and bodies over 16 KiB before command handling. Route handlers require a matching same-origin `Origin` for cookie-authenticated mutation, derive actor scope from the server-verified capability, and enforce revision, sequence, phase, locked-roster eligibility, and idempotency while holding the room transaction lock.

CQ-203 capabilities contain 256 random bits and a version prefix. Storage keeps
only an HMAC-SHA-256 fingerprint under an environment-specific server pepper.
Verification always performs a fixed-length timing-safe hash comparison, then
requires the same room, member, role, permitted status, and unexpired lifetime.
Pending participants may read only the bounded projection; command authorization
still requires active membership.
Malformed, missing, expired, revoked, cross-room, and cross-member attempts return
the same authorization absence; route handlers later map that absence to the
existing `unauthorized-or-missing` public error. Raw tokens are one-time delivery
values, redacted from ordinary serialization/inspection, excluded from protocol
payloads, and carried only in an HTTP-only secure room-path cookie.

The complete secure-room review is the milestone 0.3 technical exit gate in
CQ-214. The [recorded exit review](issues/CQ-214-secure-room-exit-review.md)
passes the backend and connected-browser application-security surface. CQ-212's
hosted recovery/teardown evidence and CQ-215's isolated two-browser protected
Preview journey are complete. The roadmap remains in product acceptance while
physical-device and moderated-usability evidence is collected. Independent
review is repeated before public beta and public launch.

Authorized projections are constructed from selected normalized columns and
validated again against the protocol. They expose constraint identifiers and
aggregate ballot completion, never constraint values/owners, individual choices,
capability fingerprints, provider references/payloads, or precise location.

CQ-206 stores a locator only as a domain-separated HMAC-SHA-256 fingerprint;
it has 128 random bits and cannot authenticate a caller. CQ-213 adds the first
safe default: create attempts are limited to five per privacy-preserving source
bucket per ten minutes and can be stopped with `CONSENSUS_ROOM_CREATION_ENABLED=false`.
The limiter deliberately holds no raw IP address and is per runtime instance, so
it is a free-tier circuit breaker rather than a claim of global DDoS protection.
CQ-507 will add the durable cross-instance controls required for public beta.

CQ-207 treats locator possession as a request for admission, not membership.
Join creates a pending participant; host approval is a revisioned transactional
command. Roster lock snapshots only active members. A later leave/remove marks
the participant departed but does not erase `eligible_voter`, preventing a host
or dropout from silently changing quorum. Join responses deliberately collapse
missing, expired, full, and concurrently locked rooms into the same public error.

CQ-208 checks room expiry only after capability authentication. A still-authorized
client can render the terminal `expired` phase, but missing rooms and invalid or
expired capabilities remain indistinguishable. Natural expiry and `room.end`
reject every later mutation. Retention sweeps lock a bounded deadline-ordered
batch, delete the aggregate through foreign-key cascades, and expose counts only;
concurrent and repeated runs cannot revive or partially reinterpret a room.

CQ-209 permits host recovery only as an explicit transfer initiated by a current
host. A 192-bit code lives for ten minutes, is stored only as a separately
domain-keyed fingerprint, and is consumed in the same transaction that rotates
the host capability and advances the aggregate revision. The prior cookie then
fails immediately. Redemption is same-origin and bounded by privacy-preserving
per-source/per-room attempt buckets; invalid, expired, replayed, wrong-room, and
concurrently consumed codes share the same public absence. Codes are forbidden
from URLs, QR codes, logs, analytics, and persistent client storage. Room
locators cannot recover host authority, and complete loss of all host authority
requires a future pre-enrolled identity proof rather than a weaker fallback.

Production script execution uses a fresh per-request CSP nonce with
`strict-dynamic`; `unsafe-inline` is absent from `script-src`. Next.js receives
the same policy through the request boundary so its framework bootstrap scripts
receive the nonce automatically. Development alone adds `unsafe-eval` for React
debugging. The nonce requirement deliberately trades static HTML caching for a
strict script boundary; browser tests verify unique nonces and successful
hydration.
