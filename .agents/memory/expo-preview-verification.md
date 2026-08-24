---
name: Expo preview verification
description: How to interpret intermittent automated-browser failures against an otherwise running Expo preview.
---

The automated browser runner may receive a 502 from the Expo preview proxy while the Metro workflow is healthy and a direct app-preview screenshot renders the application. Treat this as a preview-proxy limitation rather than a product failure only after confirming a clean Metro startup, passing type checks, and a working direct screenshot.

**Why:** The proxy paths used by automated browser verification and direct Expo screenshots can behave differently.

**How to apply:** Retry once after restarting the Expo workflow. If it still fails only in the browser runner, record the limitation and corroborate the build with logs, type checks, direct screenshot, and API checks instead of repeatedly altering working app code.