# CQ-207: Participant roster lifecycle

## Delivered boundary

`POST /api/v1/rooms/join` consumes the CQ-206 non-authoritative locator and
creates a pending participant. The participant capability is delivered only by
secure room-path cookie. A pending member may read the bounded projection while
waiting but cannot issue room commands.

The host explicitly admits or removes members with `participant.approve` and
`participant.remove`; an active participant leaves with `participant.leave`.
Every transition is revisioned, sequenced, idempotent, and serialized by the
room transaction. Joining and approval stop at roster lock.

Roster lock snapshots `eligible_voter` from active membership. Later departures
remain in that snapshot, so dropout cannot silently change unanimity or quorum.
The projection reports pending, active, and left status without exposing tokens
or invitation fingerprints.

## Operational boundary

Joining has a same-origin requirement, bounded request/parser limits, an
environment kill switch, and a per-instance privacy-preserving rate bucket.
Missing, expired, full, and locked-room responses are indistinguishable. No
shared Neon migration or environment activation is authorized by this work.
