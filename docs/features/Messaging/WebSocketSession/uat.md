# UAT — websocket-session-aggregate (feat-008)

**Result:** PASS
**Date:** 2026-02-25
**Feature:** feat-008 — websocket-session-aggregate
**Slice:** SL-001

---

## UAT Method

This feature is a **pure in-memory infrastructure aggregate** (no HTTP route, no UI surface in SL-001).
Playwright / browser UAT is not applicable — the spec explicitly states: "E2E: Not applicable — in-process stub, no real WebSocket transport in SL-001."
The end-to-end WebSocket verification (reconnect + catch-up + live fanout) is deferred to feat-009 C7.
UAT is exercised via the Vitest test suite — 34 dedicated tests plus the full regression suite (161 tests total).

This feature also closes the deferred UAT steps recorded in:

- **feat-006 uat.md** — "Confirm the WebSocket session uses the seq head as the high-water mark for catch-up batching" → verified by integration Step 9 and 10 below.
- **feat-007 uat.md** — "Verify catch-up delivery of seq 3, 4, 5 via `queryMessagesSinceSeq`" → verified by integration Step 9 below.

---

## Steps Executed

| Step | Action                                                                                                                                                                                                | Expected                                                                                                                                                                                             | Observed                                                                                                                | Result |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------ |
| 1    | **Payload validation — blank channelId:** call `subscribeToChannel` with `channelId: ""`                                                                                                              | `InvalidPayloadError` thrown; no repo call, no state change                                                                                                                                          | `InvalidPayloadError` thrown; repo never accessed                                                                       | ✅     |
| 2    | **Payload validation — whitespace-only channelId:** call with `channelId: "   "`                                                                                                                      | `InvalidPayloadError` thrown                                                                                                                                                                         | `InvalidPayloadError` thrown                                                                                            | ✅     |
| 3    | **Payload validation — negative lastKnownSeq:** call `subscribeToChannel` with `lastKnownSeq: -1`                                                                                                     | `InvalidPayloadError` thrown; no repo call                                                                                                                                                           | `InvalidPayloadError` thrown                                                                                            | ✅     |
| 4    | **Channel not found:** `subscribeToChannel` where `repo.findById` returns null                                                                                                                        | `ChannelNotFoundError` thrown; `channelId` NOT added to `subscribedChannels`                                                                                                                         | `ChannelNotFoundError` thrown; channel absent from subscriptions                                                        | ✅     |
| 5    | **registerSession state machine:** call `registerSession("user-42")`                                                                                                                                  | Session transitions to `Open`; `WebSocketSessionOpened { connectionId, memberId, openedAt }` emitted                                                                                                 | `Open` state confirmed; event emitted with correct fields                                                               | ✅     |
| 6    | **subscribeToChannel — fully caught up:** `lastKnownSeq === head`                                                                                                                                     | `ChannelSubscriptionRegistered` emitted; `sendFn` NOT called; `MissedMessagesDelivered` NOT emitted                                                                                                  | `ChannelSubscriptionRegistered` emitted; spy confirms 0 `sendFn` calls                                                  | ✅     |
| 7    | **subscribeToChannel — gap exists:** `lastKnownSeq < head` (e.g., 2 of 5 messages known)                                                                                                              | `sendFn` called for each missed message in strictly ascending seq order; `MissedMessagesDelivered { fromSeq, toSeq, messageCount }` emitted after all sends; `ChannelSubscriptionRegistered` emitted | `sendFn` called in ascending order; `MissedMessagesDelivered` emitted with correct counts; event order correct          | ✅     |
| 8    | **subscribeToChannel idempotency — re-subscribe with advanced head:** re-subscribe same channel after head has advanced                                                                               | New catch-up batch delivered for the new gap; `MissedMessagesDelivered` emitted again with updated counts                                                                                            | New batch delivered; correct `fromSeq`/`toSeq`/`messageCount`                                                           | ✅     |
| 9    | **unsubscribeFromChannel — happy path:** unsubscribe a subscribed channel                                                                                                                             | Channel removed from `subscribedChannels`; `ChannelSubscriptionRemoved { connectionId, channelId }` emitted                                                                                          | Channel absent from subscriptions; event emitted                                                                        | ✅     |
| 10   | **unsubscribeFromChannel — not-subscribed no-op:** unsubscribe a channel not in `subscribedChannels`                                                                                                  | No event emitted; no error thrown                                                                                                                                                                    | 0 events; no error                                                                                                      | ✅     |
| 11   | **terminateSession — happy path:** call `terminateSession` on an `Open` session                                                                                                                       | State transitions to `Closed`; `subscribedChannels` cleared atomically; `WebSocketSessionClosed { connectionId, memberId, closedAt }` emitted                                                        | `Closed` state; empty subscriptions; event emitted                                                                      | ✅     |
| 12   | **terminateSession — idempotent:** call `terminateSession` on an already-`Closed` session                                                                                                             | No event emitted; no error thrown                                                                                                                                                                    | 0 events; no error                                                                                                      | ✅     |
| 13   | **deliverMessage — Open + subscribed:** call `deliverMessage(event, sendFn)` where session is `Open` and subscribed to `event.channelId`                                                              | `sendFn` called with `event`                                                                                                                                                                         | `sendFn` called once with the event payload                                                                             | ✅     |
| 14   | **deliverMessage — Closed session:** call `deliverMessage` on a `Closed` session                                                                                                                      | Silent drop — `sendFn` NOT called; no error thrown; no event emitted                                                                                                                                 | `sendFn` call count: 0; no error                                                                                        | ✅     |
| 15   | **deliverMessage — Open but not subscribed:** call `deliverMessage` where `event.channelId ∉ subscribedChannels`                                                                                      | Silent drop — `sendFn` NOT called                                                                                                                                                                    | `sendFn` call count: 0                                                                                                  | ✅     |
| 16   | **Closed guard on subscribeToChannel:** call `subscribeToChannel` on a `Closed` session                                                                                                               | Silent no-op — `sendFn` NOT called; no channel added; no events emitted                                                                                                                              | No state change; no `sendFn` call; no events                                                                            | ✅     |
| 17   | **Integration — post 5, subscribe with lastKnownSeq=2:** post 5 messages via `handlePostChannelMessage`; create session; call `subscribeToChannel` with `lastKnownSeq=2` via real `ChannelRepository` | `sendFn` called exactly 3 times (seq 3, 4, 5) in ascending order; `MissedMessagesDelivered { fromSeq: 2, toSeq: 5, messageCount: 3 }` emitted                                                        | 3 `sendFn` calls; payloads seq 3, 4, 5; `MissedMessagesDelivered` correct (closes feat-006 and feat-007 deferred steps) | ✅     |
| 18   | **Integration — post 3, subscribe with lastKnownSeq=0:** post 3 messages, subscribe with `lastKnownSeq=0`                                                                                             | `sendFn` called 3 times (seq 1, 2, 3); `MissedMessagesDelivered { fromSeq: 0, toSeq: 3, messageCount: 3 }`                                                                                           | 3 calls; correct payload                                                                                                | ✅     |
| 19   | **Integration — fully caught up:** subscribe with `lastKnownSeq = head` via real repo                                                                                                                 | `sendFn` NOT called; `MissedMessagesDelivered` NOT emitted                                                                                                                                           | 0 `sendFn` calls; no missed-messages event                                                                              | ✅     |

**Total: 19 UAT steps, all PASS** (exercised by WebSocketSession.test.ts × 34 tests)

---

## Screenshots

Not applicable — in-process aggregate, no UI or HTTP surface in SL-001.

---

## Deferred UAT Step (to be run at feat-009 C7)

When feat-009 (`active-sessions-for-channel` / `FanoutCoordinator`) provides real WebSocket transport:

1. Establish a WebSocket session for a registered channel with member `user-42`
2. Post 5 messages to the channel
3. Disconnect and reconnect — supply `lastKnownSeq = 2` in the subscribe payload
4. Verify that the server delivers exactly messages with seq 3, 4, 5 as a catch-up batch before resuming the live feed
5. Confirm `MissedMessagesDelivered` is emitted with `fromSeq = 2`, `toSeq = 5`, `messageCount = 3`
6. Post a new live message — verify it arrives at the reconnected session via fanout

This step supersedes and closes the deferred steps recorded in feat-006 and feat-007 uat.md files.

---

## Regressions Checked

Full test suite (161 tests) re-run. All previously verified features passed:

| feat-id  | name                                  | test file                       | tests | result |
| -------- | ------------------------------------- | ------------------------------- | ----- | ------ |
| feat-001 | channel-aggregate                     | Channel.test.ts                 | 20    | ✅     |
| feat-002 | channel-created-acl-wiring            | ChannelCreatedAcl.test.ts       | 11    | ✅     |
| feat-003 | member-added-to-channel-acl-wiring    | MemberAddedToChannelAcl.test.ts | 13    | ✅     |
| feat-004 | channel-message-posted-event-emission | PostChannelMessageAcl.test.ts   | 31    | ✅     |
| feat-005 | channel-feed-view                     | ChannelFeedView.test.ts         | 22    | ✅     |
| feat-006 | channel-sequence-head                 | ChannelSequenceHead.test.ts     | 10    | ✅     |
| feat-007 | messages-since-seq                    | ChannelMessagesSinceSeq.test.ts | 15    | ✅     |

---

## Known Issues

- `@colloquium/reddit-clone-api` reports "No test files found, exiting with code 1" in the monorepo-wide `pnpm turbo test` run. This is a **pre-existing condition** carried forward from feat-006 and feat-007 — the package has no tests configured. No action required for this feature.
