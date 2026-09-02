# CQ-209: Host recovery and capability rotation

**Milestone:** 0.3.0  
**Type:** security  
**Depends on:** CQ-203, CQ-204

Transfer host control to a replacement browser without accounts and without
allowing an invitation locator to become authority.

**Done when:**

- a currently authorized host can issue one `hr1.*` transfer code that expires
  after ten minutes and replaces any older unredeemed challenge;
- persistence stores only a separately domain-keyed fingerprint and cascade
  deletes challenges with the room;
- successful redemption consumes the challenge, rotates the host capability,
  preserves its command sequence, advances the room revision, and records the
  committed projection in the outbox in one transaction;
- the prior host cookie, repeated redemption, wrong-room use, expired codes, and
  concurrent losing attempts fail indistinguishably;
- same-origin checks, bounded parsers, a recovery kill switch, and
  privacy-preserving per-source/per-room attempt buckets protect both endpoints;
- codes never enter URLs, QR codes, logs, analytics, persistent browser storage,
  or room projections.

## Explicit limitation

This flow requires either the current host capability to initiate a transfer or
an already issued, still-valid transfer code. Complete loss of both cannot be
recovered securely without a pre-enrolled identity factor, so room locators and
participant authority are never accepted as fallback host proof.

## Operational boundary

The implementation and migration are provider-neutral. Applying migration
`0005_host_recovery.sql` to shared Neon, enabling application consumption there,
or configuring Production requires its own explicit authorization.
