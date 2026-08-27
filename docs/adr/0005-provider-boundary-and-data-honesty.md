# ADR 0005: Place-provider boundary and data honesty

**Status:** Accepted

## Context

Public OSM endpoints do not reliably provide production availability or the ratings, reviews, photos, prices, hours, and reservations implied by the reference UI.

## Decision

Use a normalized `PlaceProvider` boundary with field-level provenance and freshness. Do not invent unavailable fields. Select and provision a licensed provider only in milestone 0.5 after evaluating terms, cost, coverage, caching, attribution, and handoff support.

## Consequences

Early milestones use explicit checked-in sample or host-entered candidates without pretending they are live discovery. Provider replacement does not change domain decision rules.
