# Feature Spec: member-added-to-channel-acl-wiring (feat-003)

**Owning BC:** Messaging
**Type:** contract (inbound ACL adapter — consumer side)
**Contract:** CT-002 — MemberAddedToChannel v1 (consumed)
**Slice:** SL-001

---

## Adapter Mapping

This feature has no state machine. It is a stateless translation layer — a pure function that converts an inbound `MemberAddedToChannel` event from WorkspaceOrganisation into a `GrantChannelMembership` command on the `Channel` aggregate.

**Delivery mechanism:** In-process function call (SL-001 stub — no message bus wiring).

**Translation rule:**

| CT-002 field  | Maps to                              | Disposition   |
| ------------- | ------------------------------------ | ------------- |
| `channelId`   | `GrantChannelMembership.channelId`   | forwarded     |
| `memberId`    | `GrantChannelMembership.memberId`    | forwarded     |
| `grantedAt`   | _(discarded)_                        | not forwarded |

**Implementation shape:**

```typescript
handleMemberAddedToChannel(payload: MemberAddedToChannelV1, repo: ChannelRepository): void
```

The function loads the channel from the repository, calls `grantChannelMembership(memberId)`, and saves any emitted events back through the repository. Unlike `handleChannelCreated`, this adapter must NOT create a new `Channel` instance if none is found — the channel must already be registered (CT-002 ordering guarantee).

**Error type note:** `InvalidPayloadError` is already defined in `ChannelCreatedAcl.ts`. This adapter should import it from a shared `errors.ts` module rather than redefining it; creating that shared module is in scope for this feature.

---

## Invariants

- The adapter must never forward `grantedAt` into the Channel aggregate — it must not appear in any `GrantChannelMembership` call
- A payload with a null, undefined, or empty-string `channelId` must be rejected before reaching the domain layer — no Channel is loaded or modified
- A payload with a null, undefined, or empty-string `memberId` must be rejected before reaching the domain layer — no Channel is loaded or modified
- If `Channel.grantChannelMembership` returns an empty event array (idempotent same-memberId case), the adapter must return without error — at-least-once delivery is expected
- The adapter must not swallow errors thrown by `Channel.grantChannelMembership` — these must propagate to the caller
- The adapter must NOT create a new `Channel` instance when `repo.findById` returns null — this would silently bypass the CT-002 ordering guarantee

---

## Failure Modes

| Trigger | Expected behavior |
| ------- | ----------------- |
| `payload.channelId` is null, undefined, or `""` | Adapter throws `InvalidPayloadError` before calling the domain; no Channel is loaded or modified |
| `payload.memberId` is null, undefined, or `""` | Adapter throws `InvalidPayloadError` before calling the domain; no Channel is loaded or modified |
| `repo.findById(channelId)` returns null (channel not yet registered) | Adapter throws `ChannelNotFoundError` — this violates CT-002's ordering guarantee; the error must propagate to allow the caller to dead-letter or retry the message |
| Duplicate `MemberAddedToChannel` for the same `(channelId, memberId)` (at-least-once delivery) | `Channel.grantChannelMembership` returns `[]` (idempotent); adapter returns normally with no side effects |
| `Channel.grantChannelMembership` throws (e.g., channel in Archived state) | Error is propagated — the caller is responsible for dead-lettering or alerting |

---

## External Contracts

- CT-002: `MemberAddedToChannel` v1 (consumed) — defines the inbound payload schema this adapter must accept

---

## Test Strategy

- [x] **Contract:** Verify the adapter correctly maps the CT-002 payload to a `GrantChannelMembership` command
  - `channelId` and `memberId` are forwarded correctly
  - `grantedAt` is NOT forwarded into the domain
  - Idempotent duplicate (same channelId + memberId) → no error, no events persisted
- [x] **Domain unit:** Payload validation
  - Missing `channelId` → `InvalidPayloadError` thrown before domain call
  - Missing `memberId` → `InvalidPayloadError` thrown before domain call
  - Channel not found in repo → `ChannelNotFoundError` thrown; no new Channel created
- [x] **Integration:** Full wiring through `ChannelRepository`
  - After `handleMemberAddedToChannel`, `repo.findById(channelId)` returns a channel whose `allowedPosters` includes `memberId`
  - Calling `handleMemberAddedToChannel` a second time with identical payload leaves `allowedPosters` unchanged (idempotent)
- [ ] **E2E:** Not applicable — in-process stub, no HTTP surface in SL-001. Covered transitively when a real bus consumer is wired in a future slice.

**UAT step (deferred to future bus-wiring feature):** When a real message bus consumer is wired, verify that publishing a `MemberAddedToChannel` event to the bus results in the member appearing in `allowedPosters` on the channel, and that a subsequent `PostChannelMessage` from that member succeeds.
