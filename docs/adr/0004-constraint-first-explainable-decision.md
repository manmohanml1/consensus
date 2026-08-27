# ADR 0004: Constraint-first explainable decision rules

**Status:** Accepted

## Context

Treating an allergy or accessibility requirement as a low utility can select an unsafe venue. The reference implementation also calls ternary utility scoring Borda count and computes Nash welfare only as a tie-breaker.

## Decision

Capture hard constraints separately and exclude failing candidates before scoring. Use a deterministic maximin/utility hybrid, stable tie-breakers, reason codes, and independently versioned rulesets as defined in `docs/DECISION_ENGINE.md`.

## Consequences

The system can honestly return no safe result. Rule changes require calibration, fixtures, a new version, and an ADR; historical outcomes remain reproducible.
