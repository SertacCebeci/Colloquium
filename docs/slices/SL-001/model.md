# Model — SL-001

## Aggregate: Channel (Messaging)

> **Type:** Domain aggregate — owns the message log and posting invariants for a single channel.

### States

| State          | Description                                                                            |
| -------------- | -------------------------------------------------------------------------------------- |
| `Unregistered` | channelId is known to WorkspaceOrganisation but not yet registered in Messaging        |
| `Active`       | Channel is registered and accepting messages from authorised posters                   |
| `Archived`     | Channel is read-only; PostChannelMessage is rejected (future state, defined for completeness) |

### Transitions

| From           | Command                                              | To       |
| -------------- | ---------------------------------------------------- | -------- |
| `Unregistered` | `RegisterChannel(channelId, workspaceId)`            | `Active` |
| `Active`       | `GrantChannelMembership(channelId, memberId)`        | `Active` |
| `Active`       | `PostChannelMessage(channelId, authorId, content)`   | `Active` |

### Invariants

1. `channelId` and `workspaceId` are immutable after `RegisterChannel` — re-registering the same `channelId` with a different `workspaceId` must be rejected
2. `PostChannelMessage` is rejected (emits `ChannelAccessDenied`) when `authorId ∉ allowedPosters`
3. `PostChannelMessage` is rejected (emits `MessageValidationFailed` with reason `EMPTY_CONTENT`) when `content.trim().length === 0`
4. `PostChannelMessage` is rejected (emits `MessageValidationFailed` with reason `CONTENT_TOO_LONG`) when `content.length > 4000`
5. The `allowedPosters` set for an `Active` channel grows monotonically within this slice — `GrantChannelMembership` only adds members; removal is out of scope for SL-001
6. Any command that would mutate state on an `Archived` channel must be rejected

### Commands

- `RegisterChannel(channelId: string, workspaceId: string)` — transitions `Unregistered` → `Active`; idempotent if already registered with the same workspaceId
- `GrantChannelMembership(channelId: string, memberId: string)` — adds `memberId` to the `allowedPosters` set; idempotent if memberId is already present
- `PostChannelMessage(channelId: string, authorId: string, content: string)` — validates posting rights and content; persists message; emits `ChannelMessagePosted`

### Events Emitted

- `ChannelRegistered` — `{ channelId, workspaceId, registeredAt: number }`
- `ChannelMembershipGranted` — `{ channelId, memberId, grantedAt: number }`
- `ChannelMessagePosted` — `{ channelId, messageId: string, authorId, content, seq: number, postedAt: number, mentionedIds: string[] }`
- `MessageValidationFailed` — `{ channelId, authorId, reason: 'EMPTY_CONTENT' | 'CONTENT_TOO_LONG' }`
- `ChannelAccessDenied` — `{ channelId, authorId }`

---

## Aggregate: WebSocketSession (Messaging — delivery layer)

> **Type:** Infrastructure aggregate — tracks a single client connection's lifecycle and channel subscriptions within the WebSocketAdapter. Not a pure domain aggregate; never persisted to disk.

### States

| State    | Description                                               |
| -------- | --------------------------------------------------------- |
| `Open`   | Active connection; eligible to receive fanout messages    |
| `Closed` | Connection terminated; removed from all fanout targets    |

### Transitions

| From    | Command                                                        | To       |
| ------- | -------------------------------------------------------------- | -------- |
| (new)   | `RegisterWebSocketSession(memberId, connectionId)`             | `Open`   |
| `Open`  | `SubscribeToChannel(connectionId, channelId, lastKnownSeq)`    | `Open`   |
| `Open`  | `UnsubscribeFromChannel(connectionId, channelId)`              | `Open`   |
| `Open`  | `TerminateWebSocketSession(connectionId)`                      | `Closed` |

### Invariants

1. A `Closed` session must never receive a fanout message — `FanoutMessage` targeting a `Closed` `connectionId` is silently dropped without error
2. A session's `subscribedChannels` set may only contain `channelId`s whose corresponding `Channel` aggregate is in `Active` state
3. `SubscribeToChannel` is idempotent — if already subscribed, it re-evaluates `lastKnownSeq` and delivers a new catch-up batch if a gap is detected
4. `MissedMessagesDelivered` must be emitted (and all catch-up messages pushed) before the session begins receiving live `ChannelMessagePosted` fanout for that channel

### Commands

- `RegisterWebSocketSession(memberId: string, connectionId: string)` — records a newly opened connection; transitions to `Open`
- `SubscribeToChannel(connectionId: string, channelId: string, lastKnownSeq: number)` — adds channel to subscriptions; triggers catch-up delivery if `lastKnownSeq < ChannelSequenceHead`
- `UnsubscribeFromChannel(connectionId: string, channelId: string)` — removes channel from subscriptions
- `TerminateWebSocketSession(connectionId: string)` — marks session `Closed`; removes all channel subscriptions

### Events Emitted

- `WebSocketSessionOpened` — `{ connectionId, memberId, openedAt: number }`
- `ChannelSubscriptionRegistered` — `{ connectionId, channelId, lastKnownSeq: number }`
- `MissedMessagesDelivered` — `{ connectionId, channelId, fromSeq: number, toSeq: number, messageCount: number }`
- `ChannelSubscriptionRemoved` — `{ connectionId, channelId }`
- `WebSocketSessionClosed` — `{ connectionId, memberId, closedAt: number }`
- `MessageFanoutCompleted` — `{ channelId, messageId, sessionCount: number }`
- `SessionDeliveryFailed` — `{ connectionId, messageId, reason: string }`

---

## Cross-Context Integrations

### ChannelCreated (v1)

> Inbound: WorkspaceOrganisation → Messaging ACL adapter (stub in SL-001)

**Schema:** `{ channelId: string, workspaceId: string, name: string, isPrivate: boolean, createdAt: number }`

**Semantics:** WorkspaceOrganisation confirms a channel exists and is ready to receive messages. The Messaging ACL discards `name` and `isPrivate` (governance fields owned by WO) and maps `channelId` + `workspaceId` into a `RegisterChannel` command.

**Versioning:** New optional fields only; breaking changes (rename/remove/type change) require v2.

---

### MemberAddedToChannel (v1)

> Inbound: WorkspaceOrganisation → Messaging ACL adapter (stub in SL-001)

**Schema:** `{ channelId: string, memberId: string, grantedAt: number }`

**Semantics:** WorkspaceOrganisation confirms a member has posting rights on the channel. The Messaging ACL maps this into a `GrantChannelMembership` command.

**Versioning:** New optional fields only; breaking changes require v2.

---

### ChannelMessagePosted (v1)

> Outbound: Messaging → Notification BC (consumed in a future slice)

**Schema:** `{ channelId: string, messageId: string, authorId: string, content: string, seq: number, postedAt: number, mentionedIds: string[] }`

**Semantics:** A message was fully persisted with its canonical sequence number. All fields are immutable at emission time. `mentionedIds` is `[]` in SL-001 (mention detection is out of scope); Notification will parse and act on this field in a future slice.

**Versioning:** New optional fields only; breaking changes require v2.
