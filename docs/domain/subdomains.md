# Subdomains

## Core

### Real-Time Messaging

**Purpose:** Deliver messages — channel posts, thread replies, and direct messages — to all recipients in real time with guaranteed ordering and no loss on reconnect.
**Success metric:** 99% of messages delivered to all connected recipients within 500 ms of server receipt; zero messages permanently lost across a WebSocket reconnect cycle (measured via sequence-number gap detection).
**Investment:** Model deeply

### Presence

**Purpose:** Broadcast each WorkspaceMember's current online/away/offline status to other members of the same Workspace in near-real time.
**Success metric:** Presence state visible to peers changes within 60 s of the triggering event (tab close, heartbeat timeout, or explicit status change); fanout to 500 concurrent members produces no measurable latency increase in the message pipeline.
**Investment:** Model deeply

---

## Supporting

### Workspace & Channel Organisation

**Purpose:** Provide the structural scaffolding — workspaces, channels, roles, and invite links — that scopes and governs who can communicate with whom.
**Success metric:** Workspace creation to first channel post completes in under 60 s for a new user; permission checks (member vs. admin) are enforced on 100% of write operations.
**Investment:** Use off-the-shelf where possible

### Notifications

**Purpose:** Alert WorkspaceMembers to messages that require their attention — @mentions, @channel/@here, and keyword follows — via in-app badges and toasts.
**Success metric:** An @mention notification is surfaced to the target member's active session within 2 s of the triggering message being persisted; @channel fanout for a 200-member workspace completes within 5 s.
**Investment:** Use off-the-shelf where possible

---

## Generic

### Identity & Access

**Purpose:** Authenticate users (registration, login, token refresh) and authorise every API call against the caller's workspace role.
**Success metric:** Auth endpoints conform to OWASP standards; access tokens expire within 15 min and are refreshed transparently with zero UX interruption.
**Investment:** Ignore / buy / outsource
