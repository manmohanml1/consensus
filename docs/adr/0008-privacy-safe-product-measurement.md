# ADR 0008: Privacy-safe product measurement

**Status:** Accepted for design; implementation begins in 0.6

## Context

The MVP needs behavioral evidence, but rooms contain location, constraints, social relationships, and preferences that should not become a tracking profile.

## Decision

Record minimized event types and coarse durations/counts only after the room transition succeeds. Exclude names, codes, precise location, individual constraints, votes, candidate lists, and venue identity. Delay retention metrics until a consented group identifier exists.

## Consequences

Some analyses will be impossible by design. Qualitative interviews and voluntary post-room feedback remain essential.
