# Threat model

## Assets

Room membership, private constraints, votes, result integrity, approximate location, participant capabilities, provider credentials, and availability.

## Main threats and controls

| Threat                          | Control                                                                                         |
| ------------------------------- | ----------------------------------------------------------------------------------------------- |
| Room-code enumeration           | Random high-entropy room id behind friendly code, rate limits, expiry, indistinguishable errors |
| Participant impersonation       | Server-issued capability stored hashed, rotated on recovery, scoped to one room/member          |
| Forged/duplicate votes          | Server authorization, schema validation, command ids, participant sequences, unique constraints |
| Split-brain outcome             | Transactional authority and one ruleset version; clients never finalize                         |
| Constraint disclosure           | Private ownership, aggregate explanations, log redaction                                        |
| Location leakage                | Coarsening, short retention, no analytics, minimum provider disclosure                          |
| Provider SSRF/injection         | Allowlists, fixed endpoints, encoded queries, timeouts, response size/schema limits             |
| Realtime flooding               | Per-IP/room/participant limits, message size bounds, backpressure and bans                      |
| Malicious venue content         | Text sanitization, trusted image hosts, restrictive CSP, no raw HTML                            |
| Stale data causes unsafe result | Provenance/freshness labels, open-status confidence, user confirmation before action            |

Milestone 0.3 protocol payloads reject unknown fields, secret-like keys, role-incompatible commands, malformed identifiers and timestamps, incoherent projection states, and bodies over 16 KiB before command handling. Route handlers require a matching same-origin `Origin` for cookie-authenticated mutation, derive actor scope from the server-verified capability, and enforce revision, sequence, phase, locked-roster eligibility, and idempotency while holding the room transaction lock.

CQ-203 capabilities contain 256 random bits and a version prefix. Storage keeps
only an HMAC-SHA-256 fingerprint under an environment-specific server pepper.
Verification always performs a fixed-length timing-safe hash comparison, then
requires the same room, member, role, active status, and unexpired lifetime.
Malformed, missing, expired, revoked, cross-room, and cross-member attempts return
the same authorization absence; route handlers later map that absence to the
existing `unauthorized-or-missing` public error. Raw tokens are one-time delivery
values, redacted from ordinary serialization/inspection, excluded from protocol
payloads, and carried only in an HTTP-only secure room-path cookie.

The complete secure-room review is the milestone 0.3 exit gate in CQ-214. Independent review is repeated before public beta and public launch.

Authorized projections are constructed from selected normalized columns and
validated again against the protocol. They expose constraint identifiers and
aggregate ballot completion, never constraint values/owners, individual choices,
capability fingerprints, provider references/payloads, or precise location.
