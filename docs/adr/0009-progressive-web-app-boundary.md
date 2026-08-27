# ADR 0009: Progressive web app boundary

**Status:** Accepted

## Context

Installability and offline assets can improve repeat use, but a cached UI cannot honestly complete a shared live decision while disconnected.

## Decision

Ship responsive web first. Add manifest/install affordances after repeat use appears. Cache only versioned static assets and explicitly safe provider responses; never cache capabilities or private room projections in shared caches. Offline mode may support drafting a room or viewing a locally retained result, but cannot claim synchronized voting.

## Consequences

PWA work does not block the MVP and cannot obscure connectivity failures.
