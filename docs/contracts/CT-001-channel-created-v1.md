# CT-001: ChannelCreated (v1)

**Type:** Event
**Producer:** WorkspaceOrganisation
**Consumer:** Messaging (via ACL adapter)
**Slice:** SL-001

## Payload Schema

```json
{
  "channelId": "string",
  "workspaceId": "string",
  "name": "string",
  "isPrivate": "boolean",
  "createdAt": "number (Unix ms timestamp)"
}
```

## Semantics

WorkspaceOrganisation emits this event when a channel has been successfully created and is ready to receive messages. It represents a governance-level fact — the channel exists, belongs to a workspace, and may have visibility restrictions.

The Messaging ACL adapter consumes this event and translates it into a `RegisterChannel(channelId, workspaceId)` command on the `Channel` aggregate. The ACL discards `name` and `isPrivate` (governance concerns owned exclusively by WorkspaceOrganisation) and uses only `channelId` + `workspaceId` to register the channel as a valid message target.

## Consumer Expectations

- `channelId` is always a non-null, non-empty string that uniquely identifies the channel globally
- `workspaceId` is always a non-null, non-empty string that identifies the owning workspace
- `createdAt` is always a positive integer representing milliseconds since Unix epoch (UTC)
- Once emitted, the `channelId` + `workspaceId` pairing is immutable — a channel never moves workspaces
- This event is emitted at most once per `channelId`

## Producer Guarantees

- All five fields are always present — no field is optional
- `channelId` and `workspaceId` are stable identifiers that will not be reassigned
- `createdAt` reflects the time the channel was persisted in WorkspaceOrganisation, in UTC milliseconds
- The event is emitted synchronously after the channel is durably persisted — no phantom events

## Backward Compatibility Rule

New optional fields only. Breaking changes (removing fields, changing types, altering the semantics of `channelId` or `workspaceId`) require a new version (v2). A v2 event is a distinct contract with its own CT-NNN ID.

## Contract Test Plan

Unit test in Messaging verifying that the ACL adapter correctly maps a `ChannelCreated v1` payload to a `RegisterChannel` command with the correct `channelId` and `workspaceId`, and that `name` and `isPrivate` are not forwarded into the domain model.
