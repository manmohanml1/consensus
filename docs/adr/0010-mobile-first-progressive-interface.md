# ADR 0010: Mobile-first progressive interface

**Status:** Accepted

## Context

Consensus is used while a small group is choosing where to go. The phone is therefore the primary surface, but hosts may use tablets and desktops for setup, maps, and group context. Gesture-heavy dating interfaces provide a useful interaction reference but cannot become an accessibility requirement or dictate decision semantics.

## Decision

Treat the phone layout as the canonical product. Present one focused candidate with image-led hierarchy and thumb-reachable controls. Horizontal swipe is an optional shortcut for `avoid` and `prefer`; labeled buttons expose all preferences, including the neutral `accept` choice.

At tablet widths, add adjacent context when it improves comprehension. At desktop widths, use available space for map, deck, and room activity rather than stretching a phone card. All form factors use the same domain commands and outcome rules.

Local generated artwork may demonstrate the media treatment only when labeled illustrative. Real venue images and facts must carry provider/source attribution and follow the place-data policy.

## Consequences

- Mobile evidence is required for every UI pull request.
- Gesture libraries are not required for the initial implementation.
- Reduced motion removes nonessential card movement without removing capability.
- Desktop-specific information architecture may evolve after live place discovery, without forking the product workflow.
