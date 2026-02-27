# Event Storm — SL-001

## Domain Events

- `ChannelRegistered` — Messaging BC accepted a WorkspaceOrganisation-created channel as a valid message target (received via stub ACL in this slice)
- `ChannelMembershipGranted` — Messaging BC recorded that a specific member has posting rights on a channel (received via stub ACL in this slice)
- `WebSocketSessionOpened` — a client established a WebSocket connection to the delivery adapter
- `ChannelSubscriptionRegistered` — a client registered interest in a channel's message stream, providing its `lastKnownSeq`
- `MissedMessagesDelivered` — a catch-up batch of messages with seq > lastKnownSeq was pushed to a reconnecting client
- `MessageValidationFailed` — submitted content failed a Channel aggregate invariant (empty body, or body > 4000 chars)
- `ChannelAccessDenied` — the posting member is not in the channel's allowed-poster set
- `MessageSequenceAssigned` — the database autoincrement assigned a sequence number to the newly persisted message
- `ChannelMessagePosted` — a message was fully persisted with its assigned sequence number; the canonical fact of record
- `MessageFanoutCompleted` — the message payload was dispatched to all active sessions subscribed to this channel
- `SessionDeliveryFailed` — a specific session did not receive delivery within the 500 ms SLA window (monitoring/observability event)
- `ChannelSubscriptionRemoved` — a client deregistered from a channel's feed (explicit unsubscribe or session close)
- `WebSocketSessionClosed` — a client's WebSocket connection was terminated (network drop or explicit close)

## Commands

- `RegisterChannel(channelId, workspaceId)` — internal ACL adapter command: registers a WorkspaceOrganisation-created channel as a valid Messaging target
- `GrantChannelMembership(channelId, memberId)` — internal ACL adapter command: records that a member has posting rights on this channel
- `RegisterWebSocketSession(memberId, connectionId)` — delivery adapter command: records a newly opened connection
- `SubscribeToChannel(connectionId, channelId, lastKnownSeq)` — client command: registers interest in a channel feed; triggers catch-up delivery if gap is detected against current channel seq
- `PostChannelMessage(channelId, authorId, content)` — user command: submit a new message to a channel
- `FanoutMessage(channelId, messageId, payload)` — policy-driven command: push the message to all sessions subscribed to channelId
- `UnsubscribeFromChannel(connectionId, channelId)` — client or policy command: remove a channel subscription
- `TerminateWebSocketSession(connectionId)` — adapter command: session closed; clean up all subscriptions for this connection

## Policies

- When `ChannelMessagePosted` → `FanoutMessage` — the WebSocketAdapter pushes the message payload (id, authorId, content, seq, postedAt) to every connectionId in `ActiveSessionsForChannel`
- When `WebSocketSessionClosed` → `UnsubscribeFromChannel` (for each subscribed channel) — removes all channel subscriptions for the closed connection to prevent fanout to dead sessions
- When `ChannelSubscriptionRegistered` AND `lastKnownSeq` < current `ChannelSequenceHead` → `FanoutMessage` (catch-up batch) — server immediately delivers all messages with seq > lastKnownSeq before resuming the live feed; this is the reconnect recovery mechanism
- When `MessageValidationFailed` OR `ChannelAccessDenied` → [terminal] — an error response is returned to the sender over the WebSocket; no downstream command is triggered

## Read Models

- `ChannelFeedView(channelId, limit, before?)` — ordered list of messages (id, authorId, content, seq, postedAt) for a given channel; used by the client on initial load and for infinite-scroll pagination
- `ActiveSessionsForChannel(channelId)` — in-memory map of channelId → Set\<connectionId\>; used by the fanout policy to know which WebSocket connections to push to; never persisted to disk
- `ChannelSequenceHead(channelId)` — the current highest sequence number for a channel; consulted at `SubscribeToChannel` time to detect gaps and at `PostChannelMessage` time to confirm ordering
- `MessagesSinceSeq(channelId, fromSeq)` — ordered batch of messages with seq > fromSeq; used by catch-up delivery at subscription time for reconnect recovery

## External Systems

- `WorkspaceOrganisationStub` — in-process fixture providing pre-seeded channel and member records; replaces the real WorkspaceOrganisation event stream for this isolated slice; removed and replaced by real WO events in a future integration slice
- `IdentityAccess (JWT middleware)` — validates the AccessToken on every WebSocket handshake and HTTP request; external to the Messaging BC; already fully built and in use

## Hot Spots (resolved)

- **WebSocket session management ownership** — Options were: (A) adapter inside Messaging BC, (B) separate transport service, (C) first-class domain concept. → **Resolved: Adapter inside Messaging BC.** Sessions are tracked in a `WebSocketAdapter` layer; the domain model sees only `ChannelMessagePosted` events. The adapter handles session registration, fanout dispatch, and subscription cleanup. Domain purity preserved.

- **Catch-up delivery timing** — Options were: (A) on SubscribeToChannel with lastKnownSeq, (B) explicit RequestMissedMessages after subscribe, (C) polling fallback. → **Resolved: On SubscribeToChannel.** Client sends `lastKnownSeq` in the subscribe payload; if gap detected against `ChannelSequenceHead`, server pushes catch-up messages immediately before resuming live feed. Zero extra round-trip; gap recovery is transparent to the user.

- **Message content validation scope** — Options were: (A) non-empty + max 4000 chars, (B) non-empty only, (C) configurable per workspace. → **Resolved: Non-empty + max 4000 characters.** The `Channel` aggregate enforces both invariants and rejects with `MessageValidationFailed`. Mirrors Slack's established limit.

- **Sequence number assignment timing** — Options were: (A) DB autoincrement at persist time, (B) pre-assigned in memory, (C) separate sequence counter table. → **Resolved: SQLite INTEGER PRIMARY KEY autoincrement at DB persist time.** Atomic and crash-safe; no seq gaps on normal operation; no extra infrastructure. Canonical ordering is the DB's responsibility.
