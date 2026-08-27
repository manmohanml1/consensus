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
