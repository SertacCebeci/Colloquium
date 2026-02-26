# SL-002 Internal Release Note

**Status:** Released
**Slice:** SL-002 — channel-feed-send-ui
**Features:** 9

## Feature Queue

| ID       | Name                             | Type       | Owning BC | Dependencies                 |
| -------- | -------------------------------- | ---------- | --------- | ---------------------------- |
| feat-001 | channel-feed-aggregate           | aggregate  | Messaging | —                            |
| feat-002 | message-composer-aggregate       | aggregate  | Messaging | feat-001                     |
| feat-003 | get-channel-messages-api-wiring  | contract   | Messaging | feat-001                     |
| feat-004 | post-channel-message-api-wiring  | contract   | Messaging | feat-001, feat-002           |
| feat-005 | channel-feed-page-read-model     | read-model | Messaging | feat-003                     |
| feat-006 | infinite-channel-feed-read-model | read-model | Messaging | feat-005                     |
| feat-007 | channel-message-form-state       | read-model | Messaging | feat-002, feat-004           |
| feat-008 | channel-page-error-state         | read-model | Messaging | feat-006, feat-007           |
| feat-009 | e2e-channel-feed-playwright      | read-model | Messaging | feat-006, feat-007, feat-008 |

## Dependency Graph

```
feat-001 (channel-feed-aggregate)
  ├── feat-002 (message-composer-aggregate)
  │     └── feat-004 (post-channel-message-api-wiring)
  │           └── feat-007 (channel-message-form-state)
  │                 └── feat-008 (channel-page-error-state)
  │                       └── feat-009 (e2e-channel-feed-playwright)
  └── feat-003 (get-channel-messages-api-wiring)
        └── feat-005 (channel-feed-page-read-model)
              └── feat-006 (infinite-channel-feed-read-model)
                    └── feat-008
                          └── feat-009
```

Critical path: feat-001 → feat-002 → feat-004 → feat-007 → feat-008 → feat-009

## What Ships

[to be filled when slice-validate runs]

## Known Issues

[to be filled]
