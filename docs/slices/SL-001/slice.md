# SL-001: channel-message-delivery

**User journey:** A workspace member types a message in a channel, submits it, and all connected members see it appear instantly in the channel feed — including members who were briefly disconnected, who receive any missed messages via sequence-number gap recovery on reconnect.

**Bounded contexts involved:** Messaging

**Success metric:** 99% of `PostChannelMessage` commands result in delivery to all active WebSocket sessions within 500 ms of server receipt; AND zero messages are permanently lost across a WebSocket reconnect cycle (verified via sequence-number gap detection and catch-up).

**Not in this slice:**
- Thread creation and replies (flat channel messages only)
- Emoji reactions on messages
- Presence indicators (online/away/offline badges)
- @mention detection, notification fanout, or alert inbox
