# SL-001 Internal Release Note

**Status:** In progress
**Slice:** SL-001 — channel-message-delivery
**Features:** 9

## Feature Queue

| ID       | Name                                    | Type       | Owning BC | Dependencies              |
| -------- | --------------------------------------- | ---------- | --------- | ------------------------- |
| feat-001 | channel-aggregate                       | aggregate  | Messaging | —                         |
| feat-002 | channel-created-acl-wiring              | contract   | Messaging | feat-001                  |
| feat-003 | member-added-to-channel-acl-wiring      | contract   | Messaging | feat-001                  |
| feat-004 | channel-message-posted-event-emission   | contract   | Messaging | feat-001                  |
| feat-005 | channel-feed-view                       | read-model | Messaging | feat-001                  |
| feat-006 | channel-sequence-head                   | read-model | Messaging | feat-001                  |
| feat-007 | messages-since-seq                      | read-model | Messaging | feat-001, feat-006        |
| feat-008 | websocket-session-aggregate             | aggregate  | Messaging | feat-001, feat-006, feat-007 |
| feat-009 | active-sessions-for-channel             | read-model | Messaging | feat-008                  |

## What Ships

[to be filled when slice-validate runs]

## Known Issues

[to be filled]
