---
name: Workspace type declarations
description: Project-reference declarations can lag behind merged schema source during package-level validation.
---

After database or shared-library changes are merged, rebuild the TypeScript project references before running individual artifact typechecks. Otherwise consumers may report missing tables or fields that already exist in the source schema.

**Why:** The workspace package exports and project references can resolve generated declaration output until the library build refreshes it.

**How to apply:** Run the workspace library typecheck/build first, then run the API and frontend typechecks.