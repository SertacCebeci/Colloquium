# Bounded Contexts

## Messaging

**Business capability:** Receive, sequence, and deliver all message types — channel posts, thread replies, and direct messages — with guaranteed ordering, using two distinct aggregates (`Channel` and `Conversation`) that share sequence-numbering and WebSocket delivery infrastructure.

**Language (within this context):**

- `Channel` aggregate: a named message stream in a workspace; accepts channel posts and thread replies; enforces channel membership and archive state
- `Conversation` aggregate: a fixed-participant private stream (2–9 members); accepts direct messages; participants are immutable after creation
- `ChannelMessage`: an immutable post within a `Channel`, assigned a server-side sequence number at persistence time
- `DirectMessage`: an immutable post within a `Conversation`, assigned a per-conversation sequence number
- `Thread`: a sub-stream anchored to a `parentMessageId` within a `Channel`; does not exist for DMs
- `Sequence number`: a per-aggregate monotonically increasing integer assigned by the server — the canonical ordering key; clients MUST display server order, not local optimistic order
- `Reaction`: an emoji token attached to any message (channel or DM) by a member

**Commands:**

- `PostChannelMessage(channelId, authorId, content)` — post a new message to a channel
- `PostThreadReply(parentMessageId, authorId, content)` — post a reply in a thread
- `StartConversation(initiatorId, participantIds)` — create a new DM conversation or retrieve an existing one with the same participants
- `SendDirectMessage(conversationId, authorId, content)` — send a message in a direct conversation
- `AddReaction(messageId, memberId, emoji)` — attach a reaction to a message
- `RemoveReaction(messageId, memberId, emoji)` — remove a reaction from a message
- `EditMessage(messageId, authorId, newContent)` — create an edited version of a message (original retained)
- `DeleteMessage(messageId, requesterId)` — soft-delete a message

**Events emitted:**

- `ChannelMessagePosted(channelId, messageId, authorId, content, sequenceNumber, mentionedIds)` — a channel message was persisted and sequenced
- `ThreadReplyPosted(parentMessageId, replyId, authorId, content, sequenceNumber)` — a thread reply was persisted
- `ConversationStarted(conversationId, participantIds)` — a new DM conversation was created
- `DirectMessageSent(conversationId, messageId, authorId, content, sequenceNumber, mentionedIds)` — a DM was persisted
- `ReactionAdded(messageId, memberId, emoji)` — a reaction was attached to a message
- `ReactionRemoved(messageId, memberId, emoji)` — a reaction was removed from a message
- `MessageEdited(messageId, authorId, newContent, editedAt)` — a message was updated
- `MessageDeleted(messageId, requesterId, deletedAt)` — a message was soft-deleted

**Inputs from other contexts:**

- `WorkspaceOrganisation`: `ChannelCreated` — registers the channel as a valid message target
- `WorkspaceOrganisation`: `MemberAddedToChannel` — validates that a poster is an authorised channel member
- `WorkspaceOrganisation`: `ChannelArchived` — causes the `Channel` aggregate to reject new posts
- `WorkspaceOrganisation`: `MemberJoinedWorkspace` — confirms that DM participants are valid workspace members
- `WorkspaceOrganisation`: `MemberRemovedFromWorkspace` — marks a participant as deactivated in open conversations

**Outputs to other contexts:**

- `Notification`: `ChannelMessagePosted` (with `mentionedIds`) — triggers mention and @channel/@here alert processing
- `Notification`: `DirectMessageSent` (with `mentionedIds`) — triggers DM mention alerts

---

## Presence

**Business capability:** Track and broadcast the real-time online/away/offline status of each WorkspaceMember to all other members of the same workspace.

**Language (within this context):**

- `Session`: an active browser connection for one member in one workspace tab; one member may have multiple concurrent sessions
- `PresenceState`: one of `online`, `away`, `offline`
- `HeartbeatInterval`: the 30-second client tick used to confirm a session is alive; missing two consecutive heartbeats transitions the member to `away`; missing four transitions to `offline`
- `PresenceSnapshot`: the complete current presence state for all members in a workspace, delivered to a client on first connection

**Commands:**

- `RegisterSession(memberId, workspaceId, connectionId)` — record a new WebSocket connection as active for this member
- `RecordHeartbeat(connectionId)` — reset the timeout clock for a live session
- `SetManualStatus(memberId, workspaceId, status, emoji)` — member explicitly sets their presence state and optional status emoji
- `TerminateSession(connectionId)` — mark a session closed and recalculate member presence (may trigger `MemberWentOffline` if last session)

**Events emitted:**

- `MemberCameOnline(workspaceId, memberId)` — member's first session in this workspace was registered
- `MemberWentAway(workspaceId, memberId)` — heartbeat timed out but at least one session is still open
- `MemberWentOffline(workspaceId, memberId)` — all sessions closed or heartbeat fully expired
- `StatusUpdated(workspaceId, memberId, status, emoji)` — member explicitly changed their status

**Inputs from other contexts:**

- `WorkspaceOrganisation`: `MemberJoinedWorkspace` — establishes the workspace scope for presence broadcasting
- `WorkspaceOrganisation`: `MemberRemovedFromWorkspace` — cleans up all presence state for the removed member

**Outputs to other contexts:**

- `Notification`: `MemberWentOffline` — signals that @here notifications should be suppressed for this member

---

## WorkspaceOrganisation

**Business capability:** Create and govern workspaces, channels, roles, and invite links — the structural scaffolding that defines who can communicate with whom.

**Language (within this context):**

- `Workspace`: a named tenant identified by slug; the top-level scope for all members and channels
- `Member`: a user with an assigned `WorkspaceRole` in a specific workspace; this context owns the membership record but NOT the user identity
- `WorkspaceRole`: one of `owner`, `admin`, `member`; governs what commands a member may issue within the workspace
- `Channel` (local): a governance object with a name, visibility flag (public/private), and lifecycle state (active/archived); this context owns access rules; `Messaging` owns the message log
- `InviteLink`: a time-limited, single-use token that grants `member` role upon redemption

**Commands:**

- `CreateWorkspace(name, slug, ownerId)` — create a new workspace and assign owner role
- `InviteMember(workspaceId, requesterId, targetEmail)` — generate an invite link (admin or owner only)
- `AcceptInvite(token, userId)` — redeem an invite link and grant workspace membership
- `CreateChannel(workspaceId, requesterId, name, isPrivate)` — create a new channel (admin or owner only)
- `AddMemberToChannel(channelId, requesterId, targetMemberId)` — grant a member access to a private channel
- `RemoveMemberFromChannel(channelId, requesterId, targetMemberId)` — revoke a member's channel access
- `ArchiveChannel(channelId, requesterId)` — make a channel read-only (admin or owner only)
- `ChangeRole(workspaceId, requesterId, targetMemberId, newRole)` — promote or demote a workspace member

**Events emitted:**

- `WorkspaceCreated(workspaceId, slug, ownerId)` — a new workspace is ready for members and channels
- `MemberJoinedWorkspace(workspaceId, memberId, role)` — a member accepted an invite or was added directly
- `MemberRemovedFromWorkspace(workspaceId, memberId)` — a member left or was removed by an admin
- `ChannelCreated(workspaceId, channelId, name, isPrivate)` — a channel is ready to receive messages
- `MemberAddedToChannel(channelId, memberId)` — a member was granted channel access
- `MemberRemovedFromChannel(channelId, memberId)` — a member's channel access was revoked
- `ChannelArchived(channelId)` — the channel is now read-only

**Inputs from other contexts:**

- `IdentityAccess`: `UserRegistered` — triggers initial workspace onboarding flow for the new user

**Outputs to other contexts:**

- `Messaging`: `ChannelCreated`, `MemberAddedToChannel`, `MemberRemovedFromChannel`, `ChannelArchived`, `MemberJoinedWorkspace`, `MemberRemovedFromWorkspace`
- `Presence`: `MemberJoinedWorkspace`, `MemberRemovedFromWorkspace`
- `Notification`: `MemberJoinedWorkspace`, `MemberAddedToChannel`

---

## Notification

**Business capability:** Detect and deliver targeted in-app alerts to WorkspaceMembers when @mentioned, @channel/@here is used, or a keyword they follow appears in a message.

**Language (within this context):**

- `Alert`: the in-app artefact shown to a member — badge count increment, toast, and persistent inbox entry
- `MentionType`: one of `direct` (@username — one recipient), `channel` (@channel — all workspace members), `here` (@here — online-only members)
- `AlertInbox`: the persistent, ordered list of unread alerts for a member; rehydrated on reconnect to recover missed notifications
- `FanoutJob`: an async task that dispatches individual `Alert` records to each recipient of an @channel or @here mention; processed off the critical request path

**Commands:**

- `ProcessMentions(messageId, channelId, content, mentionedIds)` — parse and dispatch alerts from a new channel or DM message
- `MarkAlertRead(memberId, alertId)` — clear a specific alert from the inbox
- `MarkAllRead(memberId, workspaceId)` — clear all alerts for a workspace in one operation

**Events emitted:**

- `AlertCreated(memberId, alertId, messageId, mentionType)` — an alert is persisted and ready to push to the member's active session

**Inputs from other contexts:**

- `Messaging`: `ChannelMessagePosted` (with `mentionedIds`) — source of all channel mention and @channel/@here alerts
- `Messaging`: `DirectMessageSent` (with `mentionedIds`) — source of DM mention alerts
- `WorkspaceOrganisation`: `MemberJoinedWorkspace` — maintains a local projection of workspace membership for @channel fanout
- `Presence`: `MemberWentOffline` — updates local online-member set to suppress @here notifications for offline recipients

**Outputs to other contexts:**

- None — this is a terminal context; alerts are delivered directly to client sessions

---

## IdentityAccess

**Business capability:** Authenticate users via email/password, issue and refresh short-lived access tokens, and expose identity claims that all other contexts rely on for authorisation.

**Language (within this context):**

- `User`: the canonical identity record — email, username, hashed password, display name, avatar
- `AccessToken`: a 15-minute JWT carrying `userId` and `email`; validated by middleware in every downstream context
- `RefreshToken`: a 7-day server-side hashed token; exchanged for a new `AccessToken` without re-authentication
- `Credential`: the (email, password) pair submitted at login — validated then discarded, never persisted in plain form

**Commands:**

- `RegisterUser(email, username, password)` — create a new user account
- `LoginUser(email, password)` — validate credentials and issue an AccessToken + RefreshToken pair
- `RefreshSession(refreshToken)` — exchange a valid refresh token for a new access token
- `LogoutUser(refreshToken)` — revoke a specific refresh token
- `GetCurrentUser(accessToken)` — return identity claims for a valid, non-expired token

**Events emitted:**

- `UserRegistered(userId, email, username)` — a new user account was successfully created

**Inputs from other contexts:**

- None — IdentityAccess is a foundational dependency; it does not consume events from peers

**Outputs to other contexts:**

- `WorkspaceOrganisation`: `UserRegistered` — triggers the initial workspace onboarding flow
