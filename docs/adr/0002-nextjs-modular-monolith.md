# ADR 0002: Next.js modular monolith and pure domain package

**Status:** Accepted

## Context

The product needs an accessible mobile web interface, server authority, shareable routes, and a small-team operational footprint. The decision engine should remain testable independently of React and providers.

## Decision

Use an npm-compatible pnpm workspace containing a Next.js 16 App Router application and a pure TypeScript domain package. Use Server Components for reads, Server Actions for internal mutations, Route Handlers for external/API boundaries, and the default Node.js runtime.

## Consequences

One deployable application owns the initial UI and server boundary while domain rules remain portable. Services are extracted only after measured operational need and a new ADR.
