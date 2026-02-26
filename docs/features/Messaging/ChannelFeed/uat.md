# UAT — channel-feed-aggregate (feat-001)

**Result:** PASS
**Date:** 2026-02-26
**Feature:** feat-001 — channel-feed-aggregate
**Slice:** SL-002 (channel-feed-send-ui)

---

## UAT Method

This feature is a **backend HTTP handler** (`GET /channels/:channelId/messages`) with no
browser UI in SL-002 (the React `ChannelFeed` component and `useInfiniteQuery` hook are built
in feat-005/feat-006; Playwright E2E is deferred to feat-009).

UAT was executed by:

1. Starting `colloquium-api` on port 5099 with a pre-seeded in-memory repo (75 messages,
   1 channel, 1 member) via `src/uat-seed-server.ts`.
2. Using Playwright MCP `browser_evaluate(fetch(...))` to send real HTTP requests to the
   live server and assert responses.

---

## Steps Executed

| Step | Action                                                                       | Expected                                                                                           | Observed                                                                                                                      | Result |
| ---- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------ |
| 1    | `GET /channels/ch-uat-001/messages` — no Authorization header                | 401 Unauthorized; `{ error: string }`                                                              | `{ status: 401, body: { error: "Unauthorized" } }`                                                                            | ✅     |
| 2    | `GET /channels/ch-uat-001/messages` — valid Bearer JWT (member `uat-user-1`) | 200 OK; `{ messages: [...], nextCursor: string }` shape; 50 items; `nextCursor` non-null (75 > 50) | `{ status: 200, hasMessages: true, hasNextCursor: true, messageCount: 50, nextCursorValue: "26", nextCursorIsNonNull: true }` | ✅     |
| 3    | Inspect `sequenceNumber` order across all 50 messages in page 1              | All 50 strictly descending (`firstSeq=75`, `lastSeq=26`)                                           | `isDescending: true`, `sampleTop3: [75,74,73]`, `sampleBottom3: [28,27,26]`                                                   | ✅     |
| 4    | `GET /channels/ch-uat-001/messages?before=26` — page 2 via cursor            | 200 OK; 25 messages; `nextCursor: null`; `firstSeq=25`, `lastSeq=1`; no gap with page 1            | `{ page2_count: 25, page2_nextCursor: null, page2_firstSeq: 25, page2_lastSeq: 1, noGap: true, page2_isDescending: true }`    | ✅     |

**Total: 4/4 steps PASS**

---

## Screenshots

- `feat-001-step-1.png` — Step 1: no-auth 401 rejection
- `feat-001-step-2.png` — Step 2: valid JWT → 200 ChannelFeedPage shape
- `feat-001-step-3.png` — Step 3: descending sequenceNumber order verified
- `feat-001-step-4.png` — Step 4: two-page cursor pagination (no gap, no overlap)
- `feat-001-step-5.png` — Regression check: 218 tests pass

---

## Regressions Checked

Full `packages/messaging` suite (207 tests) and `apps/colloquium-api` suite (11 tests)
re-run. All SL-001 completed features passed:

| feat-id (SL-001) | name                                  | test file                       | tests | result |
| ---------------- | ------------------------------------- | ------------------------------- | ----- | ------ |
| feat-001         | channel-aggregate                     | Channel.test.ts                 | 20    | ✅     |
| feat-002         | channel-created-acl-wiring            | ChannelCreatedAcl.test.ts       | 11    | ✅     |
| feat-003         | member-added-to-channel-acl-wiring    | MemberAddedToChannelAcl.test.ts | 13    | ✅     |
| feat-004         | channel-message-posted-event-emission | PostChannelMessageAcl.test.ts   | 31    | ✅     |
| feat-005         | channel-feed-view                     | ChannelFeedView.test.ts         | 22    | ✅     |
| feat-006         | channel-sequence-head                 | ChannelSequenceHead.test.ts     | 10    | ✅     |
| feat-007         | messages-since-seq                    | ChannelMessagesSinceSeq.test.ts | 15    | ✅     |
| feat-008         | websocket-session-aggregate           | WebSocketSession.test.ts        | 34    | ✅     |
| feat-009         | active-sessions-for-channel           | FanoutCoordinator.test.ts       | 24    | ✅     |

**Total regressions detected: 0** (218/218 tests pass)

---

## Known Issues

- Browser console shows two expected "errors" during UAT:
  - `favicon.ico` → 404: automatic browser prefetch, not a feature issue.
  - `channels/ch-uat-001/messages` → 401: intentional no-auth test in Step 1.
- Playwright E2E scenario (infinite scroll, `useInfiniteQuery` state machine) is deferred
  to feat-009 (`e2e-channel-feed-playwright`) per the spec. The UAT above is the complete
  manual gate for feat-001 scope.
