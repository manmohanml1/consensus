# Security policy

## Supported version

Before 1.0, security fixes target the latest deployed minor line and the active hardening branch.

## Reporting

Do not open a public issue containing credentials, session tokens, private room data, precise location, exploit details, or personal information. Submit those reports through [GitHub private vulnerability reporting](https://github.com/manmohanml1/consensus/security/advisories/new). Include the affected version or commit, impact, reproduction steps, and any safe proof of concept available.

The owner aims to acknowledge a private report within three business days and provide an initial status or request for more information within seven business days. Fix and disclosure timing depends on severity and exploitability. Keep the report private until a coordinated disclosure date is agreed or the owner confirms publication is safe.

If private reporting is unavailable, open a public issue containing no sensitive details and ask the owner to establish a private channel. Never place a secret or exploit in that issue.

## Security boundaries

- Anonymous does not mean unauthenticated: every participant receives a short-lived, room-scoped, server-issued capability.
- Raw capabilities are 256-bit one-time delivery values. Storage contains only an environment-keyed fingerprint; authorization also requires matching room, member, role, active status, and expiry.
- The server owns room lifecycle, locked roster, accepted vote sequence, idempotency, and outcome calculation.
- Realtime messages are untrusted hints until authorized and committed by the server.
- Room codes are invitation handles, not authorization secrets.
- Precise location is minimized, coarsened where possible, retained briefly, and never sent to analytics.
- Hard constraints are private by default; outcome explanations reveal only the minimum group-safe summary.
- Provider credentials, signing keys, database URLs, and service credentials remain server-only.
- State-changing requests require origin validation, CSRF protection where cookies are used, schema validation, rate limits, and room/participant authorization.
- Public place and room inputs are bounded and protected against SSRF, injection, enumeration, and abuse.
- Production HTML receives a fresh cryptographic CSP nonce per request;
  `script-src` uses that nonce with `strict-dynamic` and never permits
  `unsafe-inline`. This intentionally makes the application shell dynamic.
- Expired rooms reject mutations server-side. While a valid capability remains,
  reads expose only the terminal projection; bounded idempotent sweeps delete the
  complete room aggregate according to `docs/PRIVACY.md` and log counts only.
- External GitHub Actions use immutable commit SHAs, checkout credentials are not persisted, and workflow write permissions are job-scoped.
- Pull-request jobs never receive Vercel production credentials. Exact-project/current-main validation and the protected `production` environment guard promotion.
- Release artifacts carry a SHA-256 checksum and GitHub build-provenance attestation; tags are annotated, immutable, and owner-authorized.

Deleting a secret from the latest commit is not remediation. Rotate or revoke it, assess logs and history, then add a prevention control.

See `docs/DEVSECOPS.md` for the CI/CD threat-control matrix and owner setup boundary.
