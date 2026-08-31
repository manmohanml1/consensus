# CQ-205: Versioned room protocol contracts

**Milestone:** 0.3.0  
**Type:** architecture  
**GitHub:** [#14](https://github.com/manmohanml1/consensus/issues/14)

Define provider-neutral runtime contracts for room commands, authorized projections, roles, phases, revisions, and safe public errors.

## Acceptance

- every included external payload has a bounded runtime parser;
- protocol versions and compatibility responsibilities are explicit;
- unknown fields, unsafe authentication material, malformed identifiers/timestamps, role escalation, incoherent projection state, and oversized payloads fail closed;
- projections exclude raw capabilities, individual ballots, private constraint ownership, provider payloads, precise location, and analytics identifiers;
- storage, HTTP, capability issuance, room creation/join, and realtime remain separate issues.

## Implementation status

Complete. PR #111 merged the provider-neutral command/projection types, parsers, safe public error factory, tests, and protocol documentation into `main`; GitHub issue #14 is closed. Provider provisioning remains separately gated by CQ-201 and explicit owner approval.
