# Delivery Shape

## Slice-Readiness Assessment

**Verdict:** Yes — thin slices are viable

**Justification:**

Every bounded context has a clean command surface, explicit domain events, and documented integration points. All BC-to-BC integrations are async domain events — no synchronous cross-context calls. This means any single BC's aggregate can be developed and tested in complete isolation:

- **Messaging** can be built with WorkspaceOrganisation events stubbed as in-memory fixtures (e.g., pre-seed a `Channel` record to bypass `ChannelCreated` dependency during unit tests). The `Channel` and `Conversation` aggregates enforce all invariants internally.
- **Presence** depends only on WorkspaceOrganisation membership events — stubs are trivially small (just `workspaceId` + `memberId`). Session lifecycle and heartbeat logic are fully internal.
- **Notification** depends on three upstream event sources but all are async; during slice testing, test doubles emit `ChannelMessagePosted` directly into Notification's handler without spinning up the Messaging BC.
- **WorkspaceOrganisation** has one upstream dependency (IdentityAccess `UserRegistered`) which is trivially stub-able and is already implemented (IdentityAccess is complete).
- **IdentityAccess** has no upstream dependencies — it is already largely built and can be hardened independently.

No circular dependencies exist anywhere in the graph. The dependency direction is strictly: `IdentityAccess → WorkspaceOrganisation → {Messaging, Presence, Notification}` with `Messaging → Notification` and `Presence → Notification` as additional downstream edges. Notification is terminal.

ACL layers (IdentityAccess→WO and WO→Messaging) are adapters internal to the consuming BC — they add no slice-level complexity and can be tested with unit tests against a known event fixture.

## Blockers

None — slicing can begin immediately.

## Recommended Slice Sequence

1. **Real-Time Messaging / Channel messages** — highest risk (sequencing, WebSocket delivery, reconnect recovery); delivers the core value proposition. Addresses Risk #1 and Risk #3 from framing.
2. **Presence** — second-highest risk (session fanout, heartbeat at scale). Addresses Risk #2.
3. **Direct Messaging** — lower risk once Channel aggregate patterns are established; shares infrastructure.
4. **Notifications** — depends on Messaging events; implement after Channel messaging is stable. Addresses Risk #4.
5. **Workspace & Channel admin flows** — largely already built; remaining work is thin.
