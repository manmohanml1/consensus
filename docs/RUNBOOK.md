# Operations runbook

## Failed or incorrect production promotion

Stop further promotions and identify the last verified Vercel deployment ID/URL. Check whether the failure is application behavior, alias propagation, provider state, or a migration incompatibility. With explicit owner approval, point production traffic back to the last verified deployment without rebuilding it. Re-run the critical browser flow and inspect runtime errors. Never roll back an irreversible database migration by changing only the web deployment.

If the promotion workflow accepted the wrong project, branch, or SHA, revoke/rotate `VERCEL_TOKEN`, disable the workflow, preserve redacted GitHub/Vercel audit metadata, and fix the validation before another attempt.

## Compromised CI/CD dependency

Disable the affected workflow, revoke every credential available to its job, and identify runs since the compromised action or package entered the repository. Pin or remove the dependency through a reviewed PR, re-run CodeQL/zizmor/Scorecard and application verification, and republish any affected release under a new version. Never move an existing tag to repaired source.

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
