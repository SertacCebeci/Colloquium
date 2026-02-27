# CT-002: MemberAddedToChannel (v1)

**Type:** Event
**Producer:** WorkspaceOrganisation
**Consumer:** Messaging (via ACL adapter)
**Slice:** SL-001

## Payload Schema

```json
{
  "channelId": "string",
  "memberId": "string",
  "grantedAt": "number (Unix ms timestamp)"
}
```

## Semantics

WorkspaceOrganisation emits this event when a user has been granted access to a channel — either because the channel is public and the user joined the workspace, or because an admin explicitly added them to a private channel.

The Messaging ACL adapter consumes this event and translates it into a `GrantChannelMembership(channelId, memberId)` command on the `Channel` aggregate. This adds `memberId` to the aggregate's `allowedPosters` set, enabling them to post messages to the channel.

## Consumer Expectations

- `channelId` is always a non-null, non-empty string that refers to a channel already registered in Messaging (i.e., `ChannelCreated` for this `channelId` has already been processed)
- `memberId` is always a non-null, non-empty string that identifies a valid workspace member
- `grantedAt` is always a positive integer representing milliseconds since Unix epoch (UTC)
- This event may be emitted multiple times for the same `(channelId, memberId)` pair (e.g., if a member is removed and re-added in a future slice); the `GrantChannelMembership` command is idempotent

## Producer Guarantees

- All three fields are always present — no field is optional
- `memberId` refers to a user who was a valid workspace member at the time of emission
- `grantedAt` reflects the time the membership was durably persisted in WorkspaceOrganisation, in UTC milliseconds
- This event is emitted after `ChannelCreated` for the same `channelId` — ordering is guaranteed within the same WorkspaceOrganisation event stream

## Backward Compatibility Rule

New optional fields only. Breaking changes (removing fields, changing types, altering the semantics of `channelId` or `memberId`) require a new version (v2). A v2 event is a distinct contract with its own CT-NNN ID.

## Contract Test Plan

Unit test in Messaging verifying that the ACL adapter correctly maps a `MemberAddedToChannel v1` payload to a `GrantChannelMembership` command with the correct `channelId` and `memberId`, and that the command is idempotent when the same member is added twice.
