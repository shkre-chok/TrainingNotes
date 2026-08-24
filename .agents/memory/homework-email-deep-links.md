---
name: Homework email deep links
description: Safe email and companion-app linking behavior for client homework
---

Homework emails should always use an HTTPS homework URL as their link target. A custom `homework-mobile://` URL may be used only after the client explicitly chooses to open the installed companion app.

**Why:** Safari and email clients report custom schemes as invalid when the standalone app is not installed; Expo Go does not reliably register the production app scheme.

**How to apply:** Keep the web homework page as the reliable fallback, and expose an explicit app-opening action there. The native app can still use the custom scheme for internal notification data and installed-app navigation.