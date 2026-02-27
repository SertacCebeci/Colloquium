# Feature Spec: channel-aggregate (feat-001)

**Owning BC:** Messaging
**Type:** aggregate
**Slice:** SL-001

---

## Entities

### Channel

| State          | Description                                                                              |
| -------------- | ---------------------------------------------------------------------------------------- |
| `Unregistered` | `channelId` is known to WorkspaceOrganisation but not yet registered in Messaging        |
| `Active`       | Channel is registered and accepting messages from authorised posters                     |
| `Archived`     | Channel is read-only; `PostChannelMessage` is rejected (future state, defined for completeness) |

**Transitions:**

| From           | Command                                            | To       |
| -------------- | -------------------------------------------------- | -------- |
| `Unregistered` | `RegisterChannel(channelId, workspaceId)`          | `Active` |
| `Active`       | `GrantChannelMembership(channelId, memberId)`      | `Active` |
| `Active`       | `PostChannelMessage(channelId, authorId, content)` | `Active` |

**Commands:**

- `RegisterChannel(channelId: string, workspaceId: string)` — idempotent if already `Active` with the same `workspaceId`
- `GrantChannelMembership(channelId: string, memberId: string)` — idempotent if `memberId` already present in `allowedPosters`
- `PostChannelMessage(channelId: string, authorId: string, content: string)` — validates posting rights and content; persists message with monotonically-increasing `seq`; emits `ChannelMessagePosted`

**Events Emitted:**

- `ChannelRegistered` — `{ channelId, workspaceId, registeredAt: number }`
- `ChannelMembershipGranted` — `{ channelId, memberId, grantedAt: number }`
- `ChannelMessagePosted` — `{ channelId, messageId: string, authorId, content, seq: number, postedAt: number, mentionedIds: string[] }`
- `MessageValidationFailed` — `{ channelId, authorId, reason: 'EMPTY_CONTENT' | 'CONTENT_TOO_LONG' }`
- `ChannelAccessDenied` — `{ channelId, authorId }`

---

## Invariants

- `channelId` and `workspaceId` are immutable after `RegisterChannel` — a second `RegisterChannel` call for the same `channelId` with a different `workspaceId` must be rejected with an error (not silently ignored)
- `PostChannelMessage` must emit `ChannelAccessDenied` when `authorId` is not present in the channel's `allowedPosters` set
- `PostChannelMessage` must emit `MessageValidationFailed(EMPTY_CONTENT)` when `content.trim().length === 0`
- `PostChannelMessage` must emit `MessageValidationFailed(CONTENT_TOO_LONG)` when `content.length > 4000`
- The `allowedPosters` set grows monotonically within SL-001 — `GrantChannelMembership` only appends; no removal command exists in this slice
- Every command that targets an `Archived` channel (any of the three commands) must be rejected without mutating state or emitting domain events
- `seq` values for messages within a given `channelId` must be strictly increasing with no gaps

---

## Failure Modes

| Trigger                                                              | Expected behavior                                                                        |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `RegisterChannel` called for an existing `channelId` with a **different** `workspaceId` | Command rejected; state unchanged; error returned to caller |
| `RegisterChannel` called for an existing `channelId` with the **same** `workspaceId`   | Idempotent no-op; no event emitted; success returned          |
| `GrantChannelMembership` called for a `memberId` already in `allowedPosters`            | Idempotent no-op; no event emitted; success returned          |
| `PostChannelMessage` where `authorId` is not in `allowedPosters`                        | `ChannelAccessDenied` emitted; message not persisted          |
| `PostChannelMessage` where `content.trim().length === 0`                                | `MessageValidationFailed { reason: 'EMPTY_CONTENT' }` emitted; message not persisted |
| `PostChannelMessage` where `content.length > 4000`                                      | `MessageValidationFailed { reason: 'CONTENT_TOO_LONG' }` emitted; message not persisted |
| Any command targeting a channel in `Archived` state                                     | Command rejected; state unchanged; error returned to caller   |
| `PostChannelMessage` on an `Unregistered` channel                                       | Command rejected (channel not found / not in `Active` state); message not persisted |

---

## External Contracts

- CT-003: `ChannelMessagePosted` (produced) — domain event emitted by this aggregate; outbound integration wiring to the Notification BC is implemented in feat-004

_(CT-001 and CT-002 are consumed by ACL adapters in feat-002 and feat-003 respectively — they drive commands into this aggregate but are not wired in this feature)_

---

## Test Strategy

- [x] **Domain unit:** Pure aggregate tests covering all transitions, all invariants, all failure modes — no I/O, no framework
  - `RegisterChannel` happy path (Unregistered → Active)
  - `RegisterChannel` idempotent re-registration (same workspaceId)
  - `RegisterChannel` conflict rejection (different workspaceId)
  - `GrantChannelMembership` happy path and idempotency
  - `PostChannelMessage` happy path (authorised, valid content, seq increments)
  - `PostChannelMessage` — access denied (authorId not in allowedPosters)
  - `PostChannelMessage` — empty content (trim-zero)
  - `PostChannelMessage` — content exactly 4000 chars (should pass) and 4001 chars (should fail)
  - All three commands rejected on `Archived` channel
- [x] **Integration:** Persistence round-trip — hydrate aggregate from event stream; verify state is fully reconstructed from `ChannelRegistered` + `ChannelMembershipGranted` + `ChannelMessagePosted` history
- [x] **Contract:** N/A — wiring is in feat-002, feat-003, feat-004
- [ ] **E2E (automation):** Not applicable for this feature in isolation. The Channel aggregate has no directly user-visible HTTP endpoint or UI surface.
  - **UAT step (manual):** When feat-004 (outbound event emission) is complete, verify end-to-end that posting a message via the API emits a `ChannelMessagePosted` event on the message bus with the correct `channelId`, `seq`, and `content` values. Run this check before marking feat-004 C7.
  - E2E automation is covered transitively by feat-004 and feat-008 journey checks.
