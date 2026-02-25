# UAT — active-sessions-for-channel (feat-009)

**Result:** PASS
**Date:** 2026-02-25
**Feature:** feat-009 — active-sessions-for-channel (FanoutCoordinator)
**Slice:** SL-001

---

## UAT Method

This feature is a **pure in-process infrastructure coordinator** (no HTTP route, no UI surface in SL-001).
Playwright / browser UAT is not applicable — the spec explicitly states: "E2E automation deferred: requires a real WebSocket transport layer that is not implemented in SL-001."
UAT is exercised via the Vitest test suite — 24 dedicated tests plus the full regression suite (185 tests total).

This feature closes all remaining deferred UAT steps carried forward from:

- **feat-006 uat.md** — "Confirm WebSocket session uses seq head as catch-up high-water mark" → closed by integration Step 17 below.
- **feat-007 uat.md** — "Verify catch-up delivery via queryMessagesSinceSeq" → closed by integration Step 17 below.
- **feat-008 uat.md** — "Integration: post 5 messages, subscribe with lastKnownSeq=2, fanout live message" → closed by integration Steps 17–18 below.

---

## Steps Executed

| Step | Action                                                                                                                                                                                                                             | Expected                                                                                                                                                                                                    | Observed                                                                                                | Result |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------ |
| 1    | **openSession — happy path:** call `openSession("conn-1", "user-42", sendFn)`                                                                                                                                                      | Session created and stored in registry; `WebSocketSessionOpened { connectionId: "conn-1", memberId: "user-42", openedAt }` returned                                                                         | `WebSocketSessionOpened` emitted; session retrievable from internal registry                            | ✅     |
| 2    | **openSession — duplicate connectionId:** call `openSession` with a `connectionId` already in the registry                                                                                                                         | `DuplicateConnectionError` thrown before any mutation; existing session and sendFn untouched                                                                                                                | `DuplicateConnectionError` thrown; existing entry confirmed unchanged                                   | ✅     |
| 3    | **subscribeToChannel — fully caught up:** subscribe session to channel where `lastKnownSeq === head`                                                                                                                               | `ChannelSubscriptionRegistered` returned; `sendFn` NOT called; connectionId added to channel index                                                                                                          | Event returned; sendFn spy shows 0 calls; `getSessionsForChannel` includes connectionId                 | ✅     |
| 4    | **subscribeToChannel — gap exists:** subscribe with `lastKnownSeq < head` (e.g., 2 of 5 messages known)                                                                                                                            | Stored `sendFn` called for each missed message in ascending seq order; `MissedMessagesDelivered` returned; `ChannelSubscriptionRegistered` returned                                                         | sendFn called in ascending order; both events returned; channel index updated                           | ✅     |
| 5    | **subscribeToChannel — unknown connectionId:** call with connectionId not in registry                                                                                                                                              | `SessionNotFoundError` thrown; channel index not mutated                                                                                                                                                    | `SessionNotFoundError` thrown                                                                           | ✅     |
| 6    | **subscribeToChannel — blank channelId:** call with `channelId: ""`                                                                                                                                                                | `InvalidPayloadError` propagated from WebSocketSession; channel index not updated                                                                                                                           | `InvalidPayloadError` thrown; connectionId absent from channel index                                    | ✅     |
| 7    | **subscribeToChannel — channel not found:** call with a channelId absent from ChannelRepository                                                                                                                                    | `ChannelNotFoundError` propagated; connectionId NOT added to channel index                                                                                                                                  | `ChannelNotFoundError` thrown; `getSessionsForChannel` returns empty                                    | ✅     |
| 8    | **unsubscribeFromChannel — happy path:** unsubscribe a subscribed channel                                                                                                                                                          | `ChannelSubscriptionRemoved` returned; connectionId removed from channel index                                                                                                                              | Event returned; `getSessionsForChannel` no longer includes connectionId                                 | ✅     |
| 9    | **unsubscribeFromChannel — not subscribed:** unsubscribe channel not in session's subscriptions                                                                                                                                    | No event emitted; no error; channel index unchanged                                                                                                                                                         | 0 events; no error                                                                                      | ✅     |
| 10   | **closeSession — happy path:** close an open session subscribed to 2 channels                                                                                                                                                      | `WebSocketSessionClosed` returned; session removed from registry; connectionId removed from both channel index sets atomically                                                                              | Event returned; session absent from registry; both channel index sets empty                             | ✅     |
| 11   | **closeSession — unknown connectionId:** call with connectionId not in registry                                                                                                                                                    | `SessionNotFoundError` thrown                                                                                                                                                                               | `SessionNotFoundError` thrown                                                                           | ✅     |
| 12   | **fanout — 3 subscribers:** open 3 sessions, all subscribe to same channel, call `fanout(event)`                                                                                                                                   | All 3 stored `sendFn`s called with event; `MessageFanoutCompleted { sessionCount: 3 }` returned                                                                                                             | 3 sendFn calls observed; `MessageFanoutCompleted { sessionCount: 3 }` returned                          | ✅     |
| 13   | **fanout — one sendFn throws:** 3 sessions subscribed, middle session's sendFn throws                                                                                                                                              | `SessionDeliveryFailed` emitted for throwing session; other 2 sessions still receive; `MessageFanoutCompleted { sessionCount: 2 }` returned; fanout does not throw                                          | `SessionDeliveryFailed` in result; 2 sendFn calls succeed; `MessageFanoutCompleted { sessionCount: 2 }` | ✅     |
| 14   | **fanout — no subscribers:** call `fanout` for a channelId with no entries in channel index                                                                                                                                        | `MessageFanoutCompleted { sessionCount: 0 }` returned; no errors                                                                                                                                            | `MessageFanoutCompleted { sessionCount: 0 }` returned                                                   | ✅     |
| 15   | **fanout — Closed session race:** session terminated between channel index lookup and delivery (simulated by closing session before fanout)                                                                                        | `deliverMessage` silently drops (handled inside WebSocketSession); not counted in sessionCount; no `SessionDeliveryFailed` emitted                                                                          | `MessageFanoutCompleted { sessionCount: 0 }`; no `SessionDeliveryFailed`                                | ✅     |
| 16   | **getSessionsForChannel — reflects mutations:** subscribe 2 sessions to channel; unsubscribe 1; close the other                                                                                                                    | Returns correct set at each mutation step: `[conn-1, conn-2]` → `[conn-1]` → `[]`                                                                                                                           | Set reflects each mutation immediately                                                                  | ✅     |
| 17   | **Integration — catch-up delivery (closes feat-006/007/008 deferred steps):** register channel + member via ACL adapters; open session; post 5 messages via `handlePostChannelMessage`; `subscribeToChannel` with `lastKnownSeq=2` | Stored `sendFn` called exactly 3 times (seq 3, 4, 5 in ascending order); `MissedMessagesDelivered { fromSeq: 2, toSeq: 5, messageCount: 3 }` returned; real `ChannelRepository` confirms messages persisted | 3 sendFn calls (seq 3, 4, 5); `MissedMessagesDelivered` correct; integration chain fully exercised      | ✅     |
| 18   | **Integration — multi-session fanout:** open 2 sessions, both subscribe to same channel; call `fanout(event)`                                                                                                                      | Both stored `sendFn`s called with event; `MessageFanoutCompleted { sessionCount: 2 }` returned                                                                                                              | Both sendFn spies called once each; `MessageFanoutCompleted { sessionCount: 2 }`                        | ✅     |
| 19   | **Integration — closed session fanout:** open session, subscribe, `closeSession`, call `fanout`                                                                                                                                    | `MessageFanoutCompleted { sessionCount: 0 }` — closed session silently drops                                                                                                                                | `MessageFanoutCompleted { sessionCount: 0 }`                                                            | ✅     |
| 20   | **Integration — closeSession clears all channel index entries:** subscribe session to 3 channels, `closeSession`, call `getSessionsForChannel` on all 3                                                                            | All 3 channel index sets empty after close                                                                                                                                                                  | `getSessionsForChannel` returns `[]` for all 3 channels                                                 | ✅     |

**Total: 20 UAT steps, all PASS** (exercised by FanoutCoordinator.test.ts × 24 tests)

---

## Screenshots

Not applicable — in-process coordinator, no UI or HTTP surface in SL-001.

---

## Deferred UAT Step (to be run when real WebSocket transport is wired)

When HTTP upgrade handling and real WebSocket wire framing are implemented (future slice):

1. Establish a WebSocket session for a registered channel with member `user-42`
2. Post 5 messages to the channel
3. Disconnect and reconnect — supply `lastKnownSeq = 2` in the subscribe payload
4. Verify the server delivers exactly messages seq 3, 4, 5 as a catch-up batch before resuming the live feed
5. Confirm `MissedMessagesDelivered` is emitted with `fromSeq = 2`, `toSeq = 5`, `messageCount = 3`
6. Post a new live message — verify it arrives at the reconnected session via fanout
7. Open a second session for the same channel — verify both sessions receive the next posted message

This is the final deferred E2E step for SL-001. It supersedes and closes the deferred steps recorded in feat-006, feat-007, and feat-008 uat.md files.

---

## Regressions Checked

Full test suite (185 tests) re-run. All previously verified features passed:

| feat-id  | name                                  | test file                       | tests | result |
| -------- | ------------------------------------- | ------------------------------- | ----- | ------ |
| feat-001 | channel-aggregate                     | Channel.test.ts                 | 20    | ✅     |
| feat-002 | channel-created-acl-wiring            | ChannelCreatedAcl.test.ts       | 11    | ✅     |
| feat-003 | member-added-to-channel-acl-wiring    | MemberAddedToChannelAcl.test.ts | 13    | ✅     |
| feat-004 | channel-message-posted-event-emission | PostChannelMessageAcl.test.ts   | 31    | ✅     |
| feat-005 | channel-feed-view                     | ChannelFeedView.test.ts         | 22    | ✅     |
| feat-006 | channel-sequence-head                 | ChannelSequenceHead.test.ts     | 10    | ✅     |
| feat-007 | messages-since-seq                    | ChannelMessagesSinceSeq.test.ts | 15    | ✅     |
| feat-008 | websocket-session-aggregate           | WebSocketSession.test.ts        | 34    | ✅     |

---

## Known Issues

- `@colloquium/reddit-clone-api` reports "No test files found, exiting with code 1" in the monorepo-wide `pnpm turbo test` run. This is a **pre-existing condition** carried forward from feat-006, feat-007, and feat-008 — the package has no tests configured. No action required for this feature.
