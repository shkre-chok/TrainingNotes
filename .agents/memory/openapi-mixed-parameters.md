---
name: OpenAPI mixed parameters
description: Prevent Orval export collisions when defining new endpoints with parameters.
---

Avoid combining path and query parameters in a single OpenAPI operation when the generated Zod package re-exports both request schemas and generated types.

**Why:** Orval can give the path-parameter Zod schema and the query-parameter TypeScript type the same operation-derived name, causing the generated barrel to fail with a duplicate export error.

**How to apply:** Prefer putting identifiers needed by an operation in the route path. If an endpoint genuinely needs both kinds of parameters, regenerate immediately and verify `pnpm run typecheck:libs` before building callers.