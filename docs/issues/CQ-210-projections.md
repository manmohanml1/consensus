# CQ-210: Authorized privacy-minimized room projections

**Milestone:** 0.3.0  
**Type:** security  
**Depends on:** CQ-203, CQ-204

Return only capability-authorized room state required by the current client.
Projection construction selects normalized fields instead of serializing database
records and validates the result against the versioned room protocol.

**Done when:**

- missing, invalid, expired, and cross-room capabilities share the same public absence;
- responses are private request-time data with `Cache-Control: no-store`;
- individual ballots, constraint values/owners, capability hashes, provider payloads/references, and precise location are absent;
- the accepted command response and subsequent current read use the same projection builder and committed revision;
- disposable PostgreSQL tests prove the privacy boundary and locked-roster view.
