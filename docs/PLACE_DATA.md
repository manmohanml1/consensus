# Place data strategy

## Required fields

Each field carries source, observed/retrieved time, and availability status. The minimum actionable candidate needs a stable provider id, name, category, approximate location, map destination, and evidence that it is plausibly open at the target time. Rating, review count, price, photo, menu, and reservation availability are optional unless a licensed source supplies them.

## Rules

- Never infer ratings, review counts, prices, photos, or opening status from OSM tags that do not contain them.
- Never use the public Nominatim service for autocomplete or production-volume place discovery.
- Treat Overpass and public OSM endpoints as development/research sources, not an availability-guaranteed commercial backend.
- Preserve ODbL attribution and any provider attribution near the presented data.
- Cache only within provider terms and maintain field freshness.
- Keep `PlaceProvider` and normalized domain contracts separate.
- A fallback deck must be honestly labeled and must not contain stale claims such as “open now.”

## Provider selection gate

Milestone 0.5 must compare coverage, field quality, licensing, caching rights, attribution, rate limits, deletion, cost ceilings, reservation links, and geographic expansion. Provider installation and credentials require explicit owner approval.

## Zero-cost validation path

The planned validation path is a free-tier geocoder/place adapter backed by OpenStreetMap-derived facts, MapLibre for rendering, and manual candidates as the permanent fallback. Public Nominatim, Overpass, and OSM tile services are not production dependencies. A commercial tile source or self-hosted packaged tiles must be selected before a public commercial launch.

Google Places is an optional later enrichment provider, not a domain dependency. Google-sourced ratings, rating counts, photos, and reviews must be labeled, attributed, requested only when needed, and stored only as its terms allow. The product must remain useful when those fields are absent.

“Popular dishes” may come from merchant submissions, licensed menu partners, or user contributions with provenance. “Most ordered” requires actual transactional evidence and must never be inferred from reviews or generated copy.

## Cost controls

- Search once per room by default; refreshing is deliberate and rate limited.
- Normalize at most 12 candidates into a room.
- Proxy external requests server-side and reject requests after a daily project allowance.
- Record provider, retrieved time, attribution, and field-level availability.
- Keep place-provider and media-provider kill switches independent.
- Do not automatically transform uploaded images on a constrained free storage plan.
