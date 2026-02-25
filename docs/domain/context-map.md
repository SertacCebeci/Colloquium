# Context Map

## IdentityAccess → WorkspaceOrganisation

**Pattern:** Conformist + ACL
**Mechanism:** Domain event — `UserRegistered`
**Contract owner:** IdentityAccess (publishes) / WorkspaceOrganisation (consumes)
**ACL needed:** Yes — IdentityAccess's `User` (identity record with auth fields) must be translated to WorkspaceOrganisation's `Member` (workspace participant with role). The ACL in WorkspaceOrganisation maps `userId → memberId`, assigns default `member` role, and discards authentication-specific fields (`passwordHash`, token data). IdentityAccess has full upstream control; WorkspaceOrganisation has no influence over the event contract.

---

## WorkspaceOrganisation → Messaging

**Pattern:** Customer/Supplier + ACL
**Mechanism:** Domain events — `ChannelCreated`, `MemberAddedToChannel`, `MemberRemovedFromChannel`, `ChannelArchived`, `MemberJoinedWorkspace`, `MemberRemovedFromWorkspace`
**Contract owner:** WorkspaceOrganisation (publishes) / Messaging (consumes)
**ACL needed:** Yes — WorkspaceOrganisation's `Channel` is a governance object (visibility rules, member access, lifecycle state). Messaging's `Channel` aggregate is a message stream (sequence log, delivery target, archive gate). Messaging's ACL translates: `ChannelCreated → register new Channel aggregate`; `ChannelArchived → set aggregate.archived = true`; `MemberAddedToChannel → add authorId to allowed-poster set`. Governance-specific fields (`isPrivate`, `createdBy`) are discarded at the ACL boundary. Messaging (Core) can negotiate with WorkspaceOrganisation (Supporting) to add fields to upstream events when needed.

---

## WorkspaceOrganisation → Presence

**Pattern:** Conformist
**Mechanism:** Domain events — `MemberJoinedWorkspace`, `MemberRemovedFromWorkspace`
**Contract owner:** WorkspaceOrganisation (publishes) / Presence (consumes)
**ACL needed:** No — Presence only needs `workspaceId` and `memberId`, both present verbatim in WorkspaceOrganisation events. No model translation required; Presence adapts to the upstream contract as-is.

---

## WorkspaceOrganisation → Notification

**Pattern:** Conformist
**Mechanism:** Domain events — `MemberJoinedWorkspace`, `MemberAddedToChannel`
**Contract owner:** WorkspaceOrganisation (publishes) / Notification (consumes)
**ACL needed:** No — Notification builds a read-only membership projection from these events to support @channel fanout. Uses `workspaceId` and `memberId` as-is. No translation needed.

---

## Messaging → Notification

**Pattern:** Customer/Supplier
**Mechanism:** Domain events — `ChannelMessagePosted` (with `mentionedIds`), `DirectMessageSent` (with `mentionedIds`)
**Contract owner:** Messaging (publishes) / Notification (consumes)
**ACL needed:** No — the `mentionedIds` field was included in the event schema at Notification's request; the contract was co-designed. If Notification requires additional fields for alert display (e.g., `channelName`, `authorDisplayName`), it can request Messaging to add them to the event payload. Messaging accommodates downstream Customer needs.

---

## Presence → Notification

**Pattern:** Conformist
**Mechanism:** Domain event — `MemberWentOffline`
**Contract owner:** Presence (publishes) / Notification (consumes)
**ACL needed:** No — Notification reads `workspaceId` and `memberId` directly from the event to maintain a local online-member cache used to suppress @here alerts. No translation required; Notification conforms to Presence's published event shape.
