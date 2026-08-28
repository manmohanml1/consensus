# ADR 0007: Progressive infrastructure and cost controls

**Status:** Accepted

## Context

The reference promises perpetual zero-cost production. Free tiers are useful for validation but quotas, terms, availability, and data needs change.

## Decision

Target zero infrastructure spend through prototype and closed-beta validation, never as a perpetual production promise. Introduce infrastructure only when an active milestone exercises it. Each provider ADR must record free allowance, commercial-use terms, hard spending controls, expected unit usage, degradation behavior, data portability, and migration threshold. Production availability and paid use require an explicit budget.

The default degradation ladder is live provider data, cached permitted data, honestly labeled fixtures/manual entry, then a clear unavailable state. A quota failure must never create an uncontrolled bill or fabricated place facts.

Before a free provider is enabled, the implementation must include a server-side quota, per-room candidate cap, provider timeout, kill switch, source attribution, and manual candidate fallback. Current free-tier figures belong in provider evaluations because they change; they are not architectural guarantees.

## Decision gate

This ADR does not select a database, realtime, map, tile, or place provider. Each selection still requires its own accepted ADR and explicit owner approval before provisioning.
