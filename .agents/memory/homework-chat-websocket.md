---
name: Homework chat synchronization
description: Durable synchronization and authorization boundaries for homework WebSocket delivery
---

The homework WebSocket must register a subscription before taking its authoritative message snapshot, and clients must merge that snapshot and subsequent events by message ID rather than replacing cache state.

**Why:** A refetch before registration can miss a message committed between the read and subscription, while replacing cache state can discard an event received during snapshot delivery.

**How to apply:** Keep REST message creation and reads as the fallback. If practitioner authentication is added later, use that identity for WebSocket authorization; until then, practitioner scope intentionally matches the existing program-ID REST access model rather than inventing a separate token system.