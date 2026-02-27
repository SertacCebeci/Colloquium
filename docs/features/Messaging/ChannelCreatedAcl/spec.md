# Feature Spec: channel-created-acl-wiring (feat-002)

**Owning BC:** Messaging
**Type:** contract (inbound ACL adapter — consumer side)
**Contract:** CT-001 — ChannelCreated v1 (consumed)
**Slice:** SL-001

---

## Adapter Mapping

This feature has no state machine. It is a stateless translation layer — a pure function that converts an inbound `ChannelCreated` event from WorkspaceOrganisation into a `RegisterChannel` command on the `Channel` aggregate.

**Delivery mechanism:** In-process function call (SL-001 stub — no message bus wiring).

**Translation rule:**

| CT-001 field  | Maps to                     | Disposition    |
| ------------- | --------------------------- | -------------- |
| `channelId`   | `RegisterChannel.channelId`   | forwarded      |
| `workspaceId` | `RegisterChannel.workspaceId` | forwarded      |
| `name`        | _(discarded)_               | not forwarded  |
| `isPrivate`   | _(discarded)_               | not forwarded  |
| `createdAt`   | _(discarded)_               | not forwarded  |

**Implementation shape:**

```typescript
handleChannelCreated(payload: ChannelCreatedV1, repo: ChannelRepository): void
```

The function loads the channel from the repository (or creates a new `Channel` instance if not found), calls `registerChannel(workspaceId)`, and saves any emitted events back through the repository.

---

## Invariants

- The adapter must never forward `name` or `isPrivate` into the Channel aggregate — neither field may appear in any `RegisterChannel` call
- A payload with a null, undefined, or empty-string `channelId` must be rejected before reaching the domain layer — no Channel instance is created or loaded
- A payload with a null, undefined, or empty-string `workspaceId` must be rejected before reaching the domain layer
- If `Channel.registerChannel` returns an empty event array (idempotent same-workspaceId case), the adapter must return without error — at-least-once delivery is expected
- The adapter must not swallow errors thrown by `Channel.registerChannel` for unexpected conflict cases (same `channelId`, different `workspaceId`) — these must propagate to the caller

---

## Failure Modes

| Trigger | Expected behavior |
| ------- | ----------------- |
| `payload.channelId` is null, undefined, or `""` | Adapter throws `InvalidPayloadError` before calling the domain; no Channel is created or modified |
| `payload.workspaceId` is null, undefined, or `""` | Adapter throws `InvalidPayloadError` before calling the domain; no Channel is created or modified |
| Duplicate `ChannelCreated` event for the same `channelId` + `workspaceId` (at-least-once delivery) | `Channel.registerChannel` returns `[]` (idempotent); adapter returns normally with no side effects |
| `Channel.registerChannel` throws a conflict error (same `channelId`, different `workspaceId`) | Error is propagated — this violates CT-001's "emitted at most once per channelId" guarantee and must not be silently swallowed |

---

## External Contracts

- CT-001: `ChannelCreated` v1 (consumed) — defines the inbound payload schema this adapter must accept

---

## Test Strategy

- [x] **Contract:** Verify the adapter correctly maps the CT-001 payload to a `RegisterChannel` command
  - `channelId` and `workspaceId` are forwarded correctly
  - `name`, `isPrivate`, and `createdAt` are NOT forwarded into the domain
  - Idempotent duplicate (same channelId + workspaceId) → no error, no events persisted
- [x] **Domain unit:** Payload validation
  - Missing `channelId` → `InvalidPayloadError` thrown before domain call
  - Missing `workspaceId` → `InvalidPayloadError` thrown before domain call
- [x] **Integration:** Full wiring through `ChannelRepository`
  - After `handleChannelCreated`, `repo.findById(channelId)` returns a channel in `Active` state
  - Calling `handleChannelCreated` a second time with identical payload leaves the channel still `Active` (idempotent)
- [ ] **E2E:** Not applicable — in-process stub, no HTTP surface in SL-001. Covered transitively when a real bus consumer is wired in a future slice.
