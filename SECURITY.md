# Security policy

## Supported version

Before 1.0, security fixes target the latest deployed minor line and the active hardening branch.

## Reporting

Do not open a public issue containing credentials, session tokens, private room data, precise location, exploit details, or personal information. Use GitHub private vulnerability reporting when enabled, or contact the repository owner privately.

## Security boundaries

- Anonymous does not mean unauthenticated: every participant receives a short-lived, room-scoped, server-issued capability.
- The server owns room lifecycle, locked roster, accepted vote sequence, idempotency, and outcome calculation.
- Realtime messages are untrusted hints until authorized and committed by the server.
- Room codes are invitation handles, not authorization secrets.
- Precise location is minimized, coarsened where possible, retained briefly, and never sent to analytics.
- Hard constraints are private by default; outcome explanations reveal only the minimum group-safe summary.
- Provider credentials, signing keys, database URLs, and service credentials remain server-only.
- State-changing requests require origin validation, CSRF protection where cookies are used, schema validation, rate limits, and room/participant authorization.
- Public place and room inputs are bounded and protected against SSRF, injection, enumeration, and abuse.
- Expired rooms and their event data are deleted according to `docs/PRIVACY.md`.

Deleting a secret from the latest commit is not remediation. Rotate or revoke it, assess logs and history, then add a prevention control.
