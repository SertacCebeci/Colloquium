# Domain Framing

## Core Outcome

Colloquium Chat is a self-hosted, private team chat platform that gives organisations full control over their internal messaging data. The system is considered successful when teams can create workspaces, organise conversations into channels and threads, exchange direct messages, and see each other's real-time presence — all without relying on a third-party SaaS platform. Data sovereignty and reliability of message delivery are the two non-negotiable outcomes.

## Primary Users

**WorkspaceMember (employee / team member)**
A user who has been invited to or registered within a Workspace. They join channels, post messages, reply in threads, send direct messages, react to messages, and receive notifications when mentioned. Their experience is defined by the message feed: it must be fast, chronologically consistent, and reliably delivered even after network interruptions.

**Workspace Admin**
A WorkspaceMember with elevated role (`admin`). They manage channel lifecycle (create, archive, make private), invite new members via token links, and moderate content. They do not manage billing or external integrations.

**Workspace Owner**
The creator of the Workspace. Has all admin privileges plus the ability to transfer ownership or delete the Workspace. There is exactly one owner per Workspace at any time.

## Out of Scope

- **Voice and video calls** — No audio/video conferencing. Communication is text and file attachments only.
- **Mobile native applications** — Web application only. No iOS or Android native client is planned.
- **Billing and paid tiers** — No subscription management, payment processing, feature gating, or usage metering.
- **External integrations / bot framework** — No Slack-style app marketplace, no incoming/outgoing webhooks to third-party services, no programmable bot API.
- **Email notifications** — Push alerts are in-app only. No email digests or notification emails.

## Top Risks / Unknowns

1. **Real-time delivery guarantees** — If a client's WebSocket disconnects mid-session, messages sent during the gap may never reach that client. Mitigation: assign a monotonically increasing sequence number to every message per channel; clients request a catch-up range on reconnect.

2. **Presence at scale** — Broadcasting every online/offline state change to all WorkspaceMembers is an O(n) fanout. Mitigation: throttle presence updates with a heartbeat interval (e.g., 30 s); consider room-scoped presence subscriptions rather than workspace-wide broadcast.

3. **Message ordering and consistency** — Two clients posting simultaneously to the same channel could produce different orderings depending on server arrival time. Mitigation: the server is the authoritative sequence source; clients must display server-assigned order, not local optimistic order.

4. **Notification fanout (@channel / @here)** — Mentioning @channel in a large workspace triggers notifications for every member simultaneously. Mitigation: process notification delivery asynchronously via a job queue; implement rate-limiting to avoid thundering-herd problems.
