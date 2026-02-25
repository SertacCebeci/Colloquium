# SL-001 Internal Release Note

**Status:** Released
**Slice:** SL-001 — channel-message-delivery
**Features:** 9

## Feature Queue

| ID       | Name                                  | Type       | Owning BC | Dependencies                 |
| -------- | ------------------------------------- | ---------- | --------- | ---------------------------- |
| feat-001 | channel-aggregate                     | aggregate  | Messaging | —                            |
| feat-002 | channel-created-acl-wiring            | contract   | Messaging | feat-001                     |
| feat-003 | member-added-to-channel-acl-wiring    | contract   | Messaging | feat-001                     |
| feat-004 | channel-message-posted-event-emission | contract   | Messaging | feat-001                     |
| feat-005 | channel-feed-view                     | read-model | Messaging | feat-001                     |
| feat-006 | channel-sequence-head                 | read-model | Messaging | feat-001                     |
| feat-007 | messages-since-seq                    | read-model | Messaging | feat-001, feat-006           |
| feat-008 | websocket-session-aggregate           | aggregate  | Messaging | feat-001, feat-006, feat-007 |
| feat-009 | active-sessions-for-channel           | read-model | Messaging | feat-008                     |

## What Ships

Core channel-message delivery infrastructure: Channel aggregate, three ACL contract adapters, three read models (channel feed, sequence head, messages-since-seq), WebSocketSession state machine with gap-detection catch-up, and FanoutCoordinator with SessionRegistry and channel→sessions index. 185 tests, 10 test files. Transport layer (HTTP upgrade, wire framing) deferred to next slice.

## Known Issues

- Real WebSocket transport not wired in SL-001 — E2E UAT steps deferred to transport-layer slice.
- `@colloquium/reddit-clone-api` no-test pre-existing condition.
