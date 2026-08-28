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

Milestone 0.3 protocol payloads reject unknown fields, secret-like keys, role-incompatible commands, malformed identifiers and timestamps, incoherent projection states, and bodies over 16 KiB before command handling. This parser is not authorization: CQ-203 and CQ-204 still derive actor scope from a server-verified capability and enforce revision, sequence, phase, and idempotency transactionally.

The complete secure-room review is the milestone 0.3 exit gate in CQ-214. Independent review is repeated before public beta and public launch.
