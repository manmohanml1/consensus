# ADR 0006: Room-scoped anonymous capabilities

**Status:** Accepted

## Context

Account creation damages group-join conversion, but a UUID in browser storage is not authentication and a short room code can be enumerated.

## Decision

Issue random, short-lived host and participant capabilities from the server. Store only capability hashes, scope each to one room/member/role, rotate on recovery, use secure cookie delivery where feasible, and expire with room retention. Friendly codes locate invitations but confer no authority.

## Consequences

The MVP remains zero-signup while state-changing operations are authenticated. Recovery and multi-device transfer require explicit capability flows and abuse controls.
