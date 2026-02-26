# UAT — get-channel-messages-api-wiring (feat-003)

**Result:** PASS
**Date:** 2026-02-26
**Feature:** feat-003 — get-channel-messages-api-wiring
**Slice:** SL-002 (channel-feed-send-ui)

---

## UAT Method

This feature is a **backend HTTP handler** (`GET /channels/:channelId/messages`) with no
browser UI in SL-002 scope (the React `ChannelFeed` component and `useInfiniteQuery` hook are
built in feat-005/feat-006; Playwright E2E is deferred to feat-009).

UAT was executed by:

1. Starting `colloquium-api` on port 5099 with a pre-seeded in-memory repo (75 messages,
   1 channel, 1 member) via `src/uat-seed-server.ts`.
2. Navigating Playwright MCP to `http://localhost:5099/api/docs` (same-origin context).
3. Using `browser_evaluate(fetch(...))` to send real HTTP requests to the live server and
   assert responses.

---

## Steps Executed

| Step | Action                                                                       | Expected                                                                                           | Observed                                                                                                                                          | Result |
| ---- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 1    | `GET /channels/ch-uat-001/messages` — no Authorization header                | 401 Unauthorized; `{ error: "Unauthorized" }`                                                      | `{ status: 401, body: { error: "Unauthorized" } }`                                                                                                | ✅     |
| 2    | `GET /channels/ch-uat-001/messages` — valid Bearer JWT (member `uat-user-1`) | 200 OK; `{ messages: [...], nextCursor: string }` shape; 50 items; `nextCursor` non-null (75 > 50) | `{ status: 200, messageCount: 50, nextCursor: "26", nextCursorIsNonNull: true, hasMessages: true, firstSeq: 75, lastSeq: 26 }`                    | ✅     |
| 3    | `GET /channels/ch-uat-001/messages?before=26` — page 2 via cursor            | 200 OK; 25 messages; `nextCursor: null`; `firstSeq=25`, `lastSeq=1`; contiguous with page 1        | `{ status: 200, messageCount: 25, nextCursor: null, nextCursorIsNull: true, firstSeq: 25, lastSeq: 1, isDescending: true, noGapWithPage1: true }` | ✅     |
| 4    | `GET /channels/ch-uat-001/messages?limit=999` — exceeds max 50               | 400 Bad Request; `{ error: "..." }` (InvalidPayloadError)                                          | `{ status: 400, body: { error: "GetChannelMessages payload: limit must be a positive integer ≤ 50" } }`                                           | ✅     |

**Total: 4/4 steps PASS**

---

## Screenshots

- `feat-003-step-1.png` — Step 1: no-auth 401 rejection
- `feat-003-step-2.png` — Step 2: valid JWT → 200 ChannelFeedPage shape (50 items, nextCursor non-null)
- `feat-003-step-3.png` — Step 3: page-2 cursor pagination (25 items, nextCursor null, no gap)
- `feat-003-step-4.png` — Step 4: limit=999 → 400 InvalidPayloadError
- `feat-003-step-5-regression.png` — Regression check: 255 tests pass

---

## Regressions Checked

Full `packages/messaging` suite (242 tests) and `apps/colloquium-api` suite (13 tests) re-run.
All SL-002 and SL-001 completed features passed:

| feat-id         | name                                  | test coverage                                           | tests | result |
| --------------- | ------------------------------------- | ------------------------------------------------------- | ----- | ------ |
| SL-002/feat-001 | channel-feed-aggregate                | HTTP golden path: 401 (Step 1 above)                    | —     | ✅     |
| SL-002/feat-002 | message-composer-aggregate            | `MessageComposer.test.ts` (35 tests in messaging suite) | 35    | ✅     |
| SL-001/feat-001 | channel-aggregate                     | `Channel.test.ts`                                       | 20    | ✅     |
| SL-001/feat-002 | channel-created-acl-wiring            | `ChannelCreatedAcl.test.ts`                             | 11    | ✅     |
| SL-001/feat-003 | member-added-to-channel-acl-wiring    | `MemberAddedToChannelAcl.test.ts`                       | 13    | ✅     |
| SL-001/feat-004 | channel-message-posted-event-emission | `PostChannelMessageAcl.test.ts`                         | 31    | ✅     |
| SL-001/feat-005 | channel-feed-view                     | `ChannelFeedView.test.ts`                               | 22    | ✅     |
| SL-001/feat-006 | channel-sequence-head                 | `ChannelSequenceHead.test.ts`                           | 10    | ✅     |
| SL-001/feat-007 | messages-since-seq                    | `ChannelMessagesSinceSeq.test.ts`                       | 15    | ✅     |
| SL-001/feat-008 | websocket-session-aggregate           | `WebSocketSession.test.ts`                              | 34    | ✅     |
| SL-001/feat-009 | active-sessions-for-channel           | `FanoutCoordinator.test.ts`                             | 24    | ✅     |
| CT-004 contract | channels.test.ts (API suite)          | 13 contract + integration tests                         | 13    | ✅     |

**Total: 255/255 tests pass. Regressions detected: 0.**

---

## Known Issues

- Browser console shows three expected "errors" during UAT:
  - `favicon.ico` → 404: automatic browser prefetch, not a feature issue (known from feat-001).
  - `/channels/ch-uat-001/messages` → 401: intentional no-auth test in Step 1.
  - `/channels/ch-uat-001/messages?limit=999` → 400: intentional over-limit test in Step 4.
- Playwright E2E scenario (infinite scroll, `useInfiniteQuery` state machine, message list
  render) is deferred to feat-009 (`e2e-channel-feed-playwright`) per the spec. The UAT above
  is the complete manual gate for feat-003 scope.
