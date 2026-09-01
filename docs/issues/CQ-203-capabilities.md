# CQ-203: Anonymous capability lifecycle

**Milestone:** 0.3.0  
**Type:** security  
**Depends on:** CQ-202

Issue, hash, scope, rotate, recover and expire host/participant capabilities; add enumeration and authorization controls. Capabilities use 256 random bits, a version prefix, an environment-specific keyed fingerprint, fixed-length timing-safe comparison, and an HTTP-only secure room-path cookie.

**Done when:**

- cross-room, cross-member, role, missing, malformed, inactive, and expired attempts fail with the same authorization absence;
- only a keyed fingerprint enters storage and raw values are redacted from ordinary logging/serialization;
- issuance is cryptographically random, bounded to 24 hours, and delivered only once;
- rotation replaces the stored fingerprint and cookie clearing uses the identical room path;
- route/API integration remains owned by CQ-204, CQ-206, and CQ-209.
