# UAT — post-channel-message-api-wiring (feat-004)

**Result:** PASS
**Date:** 2026-02-26
**Feature:** feat-004 — post-channel-message-api-wiring
**Slice:** SL-002 (channel-feed-send-ui)

---

## UAT Method

This feature is a **backend HTTP handler** (`POST /channels/:channelId/messages`) with no
browser UI in SL-002 scope (the MessageComposer form + optimistic append are wired in
feat-007; Playwright E2E is deferred to feat-009).

UAT was executed by:

1. Starting `colloquium-api` on port 5099 with a pre-seeded in-memory repo (75 messages,
   1 channel `ch-uat-001`, 1 member `uat-user-1`) via `src/uat-seed-server.ts`.
2. Navigating Puppeteer MCP to `http://localhost:5099/api/docs` to confirm route registration.
3. Using `puppeteer_evaluate(fetch(...))` + curl to send real HTTP requests to the live server
   and assert responses.

---

## Steps Executed

| Step | Action                                                                                                | Expected                                                                                                             | Observed                                                                                                                                                  | Result |
| ---- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 1    | Navigate to `http://localhost:5099/api/docs`                                                          | Swagger UI loads; both `POST /channels/{channelId}/messages` and `GET` routes visible                                | Swagger UI loaded; `POST /channels/{channelId}/messages` and `GET /channels/{channelId}/messages` both visible in "default" group                         | ✅     |
| 2    | `POST /channels/ch-uat-001/messages` — no Authorization header; body `{ content: "UAT post" }`        | 401 Unauthorized; `{ "error": "Unauthorized" }`; no domain call                                                      | HTTP 401; `{ "error": "Unauthorized" }` (confirmed via browser fetch and curl)                                                                            | ✅     |
| 3    | `POST /channels/ch-uat-001/messages` — valid Bearer JWT (`sub=uat-user-1`); `{ content: "UAT post" }` | 201 Created; all 6 fields present; `sequenceNumber = 76`; `postedAt` is ISO 8601 UTC string; `authorId = uat-user-1` | HTTP 201; `{ messageId, channelId: "ch-uat-001", authorId: "uat-user-1", content: "UAT post", sequenceNumber: 76, postedAt: "2026-02-26T11:45:31.901Z" }` | ✅     |
| 4    | `GET /channels/ch-uat-001/messages` — valid Bearer JWT                                                | 200 OK; "UAT post" at position 0 (newest-first); `sequenceNumber = 76`                                               | HTTP 200; first message: `{ content: "UAT post", sequenceNumber: 76, postedAt: "2026-02-26T11:45:31.901Z" }`; 50 messages in page                         | ✅     |
| 5    | `POST /channels/ch-uat-001/messages` — valid JWT; `{ content: "   " }` (whitespace-only)              | 422 Unprocessable Entity; `{ "error": "Message content must not be empty" }`                                         | HTTP 422; `{ "error": "Message content must not be empty" }` — domain `EMPTY_CONTENT` invariant enforced                                                  | ✅     |

**Total: 5/5 steps PASS**

---

## Screenshots

- `feat-004-step-1.png` — Swagger UI: both POST and GET routes registered
- `feat-004-step-2.png` — Step 2: no-auth GET → 401 `{"error":"Unauthorized"}` (browser)
- `feat-004-step-3.png` — Step 3: valid JWT POST → 201 with all 6 fields, sequenceNumber=76
- `feat-004-step-4.png` — Step 4: authenticated GET → UAT post at position 0, sequenceNumber=76
- `feat-004-step-5.png` — Step 5: whitespace-only content → 422 EMPTY_CONTENT
- `feat-004-step-5-regression.png` — Regression: 363 tests pass across all packages

---

## Regressions Checked

Full monorepo test suite re-run via `pnpm turbo test`.

| feat-id             | name                                  | method                                      | tests | result |
| ------------------- | ------------------------------------- | ------------------------------------------- | ----- | ------ |
| SL-002/feat-003     | get-channel-messages-api-wiring       | GET w/o auth → 401 confirmed live (Step 2)  | 26    | ✅     |
| SL-002/feat-002     | message-composer-aggregate            | `MessageComposer.test.ts` (messaging suite) | 242   | ✅     |
| SL-002/feat-001     | channel-feed-aggregate                | `Channel.test.ts` (messaging suite)         | 242   | ✅     |
| SL-001/feat-001     | channel-aggregate                     | `Channel.test.ts`                           | 242   | ✅     |
| SL-001/feat-002     | channel-created-acl-wiring            | `ChannelCreatedAcl.test.ts`                 | 242   | ✅     |
| SL-001/feat-003     | member-added-to-channel-acl-wiring    | `MemberAddedToChannelAcl.test.ts`           | 242   | ✅     |
| SL-001/feat-004     | channel-message-posted-event-emission | `PostChannelMessageAcl.test.ts`             | 242   | ✅     |
| SL-001/feat-005–009 | feed/seq/session read models          | full messaging suite                        | 242   | ✅     |

**363/363 tests pass. Regressions detected: 0.**

---

## Known Issues

- Browser console shows expected non-error 404 for `favicon.ico` — automatic browser
  prefetch against an API-only server; identical to feat-003 known issue, not a feature defect.
- Playwright E2E scenario (MessageComposer form submit, optimistic append, error states)
  is deferred to feat-009 (`e2e-channel-feed-playwright`) per the spec. The UAT above is the
  complete manual gate for feat-004 scope.
