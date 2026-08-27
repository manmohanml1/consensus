# ADR 0007: Progressive infrastructure and cost controls

**Status:** Proposed

## Context

The reference promises perpetual zero-cost production. Free tiers are useful for validation but quotas, terms, availability, and data needs change.

## Decision under evaluation

Introduce infrastructure only when an active milestone exercises it. Each provider ADR must record free allowance, hard spending controls, expected unit usage, degradation behavior, data portability, and migration threshold. Production availability and paid use require an explicit budget rather than a zero-cost guarantee.

## Decision gate

Resolve during milestone 0.3 after live discovery/provisioning options are compared. No database or realtime provider is selected by this ADR.
