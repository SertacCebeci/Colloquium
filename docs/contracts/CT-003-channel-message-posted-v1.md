# CT-003: ChannelMessagePosted (v1)

**Type:** Event
**Producer:** Messaging
**Consumer:** Notification (future slice)
**Slice:** SL-001

## Payload Schema

```json
{
  "channelId": "string",
  "messageId": "string",
  "authorId": "string",
  "content": "string",
  "seq": "number (positive integer)",
  "postedAt": "number (Unix ms timestamp)",
  "mentionedIds": "string[]"
}
```

## Semantics

Messaging emits this event immediately after a channel message is durably persisted and its sequence number is assigned. It is the canonical fact that a message exists — all downstream consumers (Notification, future analytics, search indexing) must treat this event as the source of truth.

All fields are immutable at emission time. The message's `seq` value represents its authoritative position in the channel's message history; clients must display messages in `seq` order, not arrival order.

In SL-001, `mentionedIds` is always `[]` — mention detection is out of scope for this slice. The field is included in v1 to avoid a breaking schema change when Notification is wired in a future slice.

## Consumer Expectations

- `channelId` is always a non-null string identifying the channel where the message was posted
- `messageId` is always a globally unique, non-null string (UUID or equivalent)
- `authorId` is always a non-null string identifying the member who posted the message
- `content` is always a non-empty string with `content.trim().length > 0` and `content.length ≤ 4000`
- `seq` is always a positive integer, greater than the `seq` of any previously emitted event for the same `channelId`
- `postedAt` is always a positive integer (UTC milliseconds) reflecting the server-side persistence time
- `mentionedIds` is always a present array (never null or undefined); may be empty

## Producer Guarantees

- All seven fields are always present — no field is optional
- `seq` values for a given `channelId` are monotonically increasing with no gaps under normal operation
- This event is emitted exactly once per message — no duplicates under normal operation; consumers may implement idempotency guards using `messageId`
- `content` has already passed all Channel aggregate invariants at emission time — consumers do not need to re-validate
- `postedAt` is always in UTC milliseconds

## Backward Compatibility Rule

New optional fields only. Breaking changes (removing fields, changing types, altering the semantics of `seq` or `messageId`) require a new version (v2). A v2 event is a distinct contract with its own CT-NNN ID. When Notification is implemented, it must subscribe to `ChannelMessagePosted v1` specifically.

## Contract Test Plan

Unit test in Messaging verifying that a `PostChannelMessage` command with valid inputs produces a `ChannelMessagePosted v1` event where all seven fields are present, `seq` is greater than the previous message's seq for the same channel, and `content` matches the submitted text exactly.
