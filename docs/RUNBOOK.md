# Operations runbook

## Realtime degradation

Confirm the transactional command path first. If commits succeed, enable or retain polling and communicate delayed updates. If commits fail, stop accepting optimistic votes and show a retryable unavailable state.

## Place-provider degradation

Open the circuit after bounded failures, serve only data that remains valid under licensing/freshness rules, and remove claims such as open status when stale. Do not substitute invented details.

## Suspected result-integrity incident

Disable new room starts, preserve redacted audit metadata, identify affected ruleset/revisions, and communicate that outcomes may be invalid. Never silently recompute an already-shared result.

## Credential exposure

Rotate/revoke first, inspect use and logs, remove from active configuration and history as appropriate, then add a preventive check.

## Retention failure

Pause affected ingestion if deletion backlog exceeds policy, run only bounded and verified cleanup targets, confirm deletion, and document the incident.
