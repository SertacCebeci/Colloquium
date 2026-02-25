# UAT — messages-since-seq (feat-007)

**Result:** PASS
**Date:** 2026-02-25
**Feature:** feat-007 — messages-since-seq
**Slice:** SL-001

---

## UAT Method

This feature is an **in-process read model** (no HTTP route, no UI surface in SL-001).
Playwright / browser UAT is not applicable — the spec explicitly states: "E2E: Not applicable — in-process stub, no HTTP surface in SL-001."
The end-to-end verification (WebSocket catch-up delivery) is deferred to feat-008 C7, where `WebSocketSession.SubscribeToChannel` consumes this function.
UAT is exercised via the Vitest test suite — 15 dedicated tests plus the full regression suite (127 tests total).

---

## Steps Executed

| Step | Action                                                                                                             | Expected                                          | Observed                                   | Result |
| ---- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- | ------------------------------------------ | ------ |
| 1    | **Payload validation — empty channelId:** call `queryMessagesSinceSeq` with `channelId: ""`                        | `InvalidPayloadError` thrown; no repo call        | `InvalidPayloadError` thrown               | ✅     |
| 2    | **Payload validation — whitespace-only channelId:** call with `channelId: "   "`                                   | `InvalidPayloadError` thrown                      | `InvalidPayloadError` thrown               | ✅     |
| 3    | **Payload validation — negative fromSeq:** call with `fromSeq: -1`                                                 | `InvalidPayloadError` thrown; no repo call        | `InvalidPayloadError` thrown               | ✅     |
| 4    | **Payload validation — missing fromSeq:** call with `fromSeq: undefined`                                           | `InvalidPayloadError` thrown                      | `InvalidPayloadError` thrown               | ✅     |
| 5    | **No-repo-call on invalid payload:** empty repo untouched after failed call                                        | `emptyRepo.findById("ch-1")` returns null         | null returned — repo never accessed        | ✅     |
| 6    | **Channel not found:** call with valid payload on empty repo                                                       | `ChannelNotFoundError` thrown                     | `ChannelNotFoundError` thrown              | ✅     |
| 7    | **Domain unit — fromSeq=0, 3 messages:** query with `fromSeq: 0` on channel with 3 messages                        | Returns all 3 in ascending seq order: `[1, 2, 3]` | `[1, 2, 3]` returned                       | ✅     |
| 8    | **Domain unit — fromSeq=2, 5 messages:** query with `fromSeq: 2` on channel with 5 messages                        | Returns messages with seq `[3, 4, 5]`             | `[3, 4, 5]` returned                       | ✅     |
| 9    | **Domain unit — fully caught up:** query with `fromSeq: 5` on channel with 5 messages                              | Returns `[]` — client is fully caught up          | `[]` returned                              | ✅     |
| 10   | **Domain unit — no messages:** query with `fromSeq: 0` on channel with no posted messages                          | Returns `[]` — not an error                       | `[]` returned                              | ✅     |
| 11   | **7 canonical fields present:** inspect every item returned for 2-message channel                                  | All 7 fields present; `mentionedIds = []` on each | All fields present; `mentionedIds` is `[]` | ✅     |
| 12   | **Strictly ascending seq order:** query `fromSeq: 1` on 4-message channel                                          | Returns `[2, 3, 4]`; each `seq[i] > seq[i-1]`     | `[2, 3, 4]`; strictly ascending confirmed  | ✅     |
| 13   | **No side effects:** compare `findSequenceHead` before and after query                                             | Repo sequence head unchanged                      | Same value before and after — no mutation  | ✅     |
| 14   | **Integration — post 6, query fromSeq=3:** post 6 messages via `handlePostChannelMessage`, query with `fromSeq: 3` | Returns `[4, 5, 6]` via real `ChannelRepository`  | `[4, 5, 6]` returned                       | ✅     |
| 15   | **Integration — post 3, query fromSeq=0:** post 3 messages, query with `fromSeq: 0`                                | Returns `[1, 2, 3]` via real `ChannelRepository`  | `[1, 2, 3]` returned                       | ✅     |

**Total: 15/15 ChannelMessagesSinceSeq tests PASS (within 127/127 suite-wide PASS)**

---

## Screenshots

Not applicable — in-process function, no UI or HTTP surface in SL-001.

---

## Deferred UAT Step (to be run at feat-008 C7)

When feat-008 (`websocket-session-aggregate`) consumes `queryMessagesSinceSeq` for catch-up delivery:

1. Establish a WebSocket session for a registered channel with member `user-42`
2. Post 5 messages to the channel
3. Disconnect and reconnect — supply `lastKnownSeq = 2` in the subscribe payload
4. Verify that the server delivers exactly messages with seq 3, 4, 5 as a catch-up batch before resuming the live feed
5. Confirm `MissedMessagesDelivered` is emitted with `fromSeq = 2`, `toSeq = 5`, `messageCount = 3`

This step constitutes the end-to-end verification of `queryMessagesSinceSeq` as consumed by `WebSocketSession.SubscribeToChannel`.

---

## Regressions Checked

Full test suite (127 tests) re-run. All previously verified features passed:

| feat-id  | name                                  | test file                       | tests | result |
| -------- | ------------------------------------- | ------------------------------- | ----- | ------ |
| feat-001 | channel-aggregate                     | Channel.test.ts                 | 20    | ✅     |
| feat-002 | channel-created-acl-wiring            | ChannelCreatedAcl.test.ts       | 11    | ✅     |
| feat-003 | member-added-to-channel-acl-wiring    | MemberAddedToChannelAcl.test.ts | 13    | ✅     |
| feat-004 | channel-message-posted-event-emission | PostChannelMessageAcl.test.ts   | 31    | ✅     |
| feat-005 | channel-feed-view                     | ChannelFeedView.test.ts         | 22    | ✅     |
| feat-006 | channel-sequence-head                 | ChannelSequenceHead.test.ts     | 10    | ✅     |

---

## Known Issues

- `@colloquium/reddit-clone-api` reports "No test files found, exiting with code 1" in the monorepo-wide `pnpm turbo test` run. This is a **pre-existing condition** unrelated to the Messaging BC or feat-007 — the package has no tests configured. No action required for this feature.
- The return type `ChannelMessagePostedV1[]` reuses the event discriminant type (`type: "ChannelMessagePosted"`) rather than a dedicated view type. A `ChannelMessageView` (without the `type` field) was considered and rejected as redundant — the `type` field is harmless as a view payload and all three Messaging read models (`queryChannelFeed`, `queryChannelSequenceHead`, `queryMessagesSinceSeq`) already use this type consistently. No action required.
