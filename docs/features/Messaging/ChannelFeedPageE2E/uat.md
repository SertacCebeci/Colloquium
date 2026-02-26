# UAT — e2e-channel-feed-playwright (feat-009)

**Result:** PASS
**Date:** 2026-02-26
**Feature:** feat-009 — e2e-channel-feed-playwright
**Slice:** SL-002 (channel-feed-send-ui)

---

## UAT Method

This feature assembles the `ChannelFeedPage` component in `apps/colloquium-web` and verifies the
critical path end-to-end via Playwright MCP against the running `uat-seed-server` (port 5099,
in-memory, 75 messages seeded) and Vite dev server (port 5174).

The Playwright automated test suite (`pnpm --filter @colloquium/colloquium-web test:e2e`) was also
confirmed to pass all 4 tests before UAT was run.

---

## Steps Executed

| Step | Action                                                                                       | Expected                                                                              | Observed                                                                                        | Result |
| ---- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------ |
| 1    | Navigate to `/channels/ch-uat-001?token=<UAT_TOKEN>` (valid JWT signed with uat-secret-2026) | ≥1 `data-testid="message-*"` elements visible; `error-banner` absent                  | 50 messages rendered (UAT message 75 of 75 … UAT message 26 of 75); no error banner             | ✅     |
| 2    | Type "Hello UAT" in `composer-input`, click `composer-send`                                  | Message "Hello UAT" appears in feed; textarea cleared                                 | "Hello UAT" visible at bottom of feed; textarea shows placeholder "Write a message…"            | ✅     |
| 3    | Navigate fresh, wait for 50 messages, scroll `sentinel` into view                            | Message count increases beyond 50 after scroll                                        | countBefore=100 (50 msgs × 2 elements each), countAfter=152 (76 msgs × 2 elements after scroll) | ✅     |
| 4    | Navigate to `/channels/ch-uat-001?token=bad-token-here` (invalid JWT)                        | `error-banner` visible; `error-message` text = "Unauthorized"; `retry-button` present | error-banner visible; errorMessage="Unauthorized"; retryVisible=true                            | ✅     |

---

## Screenshots

- feat-009-step-1.png — Initial page load with 50 messages, no error banner
- feat-009-step-2.png — After sending "Hello UAT" — message at bottom, textarea cleared
- feat-009-step-3.png — After infinite scroll — all messages loaded including older pages
- feat-009-step-4.png — Error banner with "Unauthorized" text and Retry button

---

## Regressions Checked

| Feature                                     | Regression Method                                                                | Result |
| ------------------------------------------- | -------------------------------------------------------------------------------- | ------ |
| feat-008 (channel-page-error-state)         | `pnpm --filter @colloquium/ui exec vitest run` — 140 tests (19 files)            | ✅     |
| feat-007 (channel-message-form-state)       | `pnpm --filter @colloquium/ui exec vitest run` — 140 tests (included)            | ✅     |
| feat-006 (infinite-channel-feed-read-model) | `pnpm --filter @colloquium/ui exec vitest run` — 140 tests (included)            | ✅     |
| feat-005 (channel-feed-page-read-model)     | `pnpm --filter @colloquium/ui exec vitest run` — 140 tests (included)            | ✅     |
| feat-004 (post-channel-message-api-wiring)  | `pnpm --filter @colloquium/colloquium-api exec vitest run` — 26 tests            | ✅     |
| feat-003 (get-channel-messages-api-wiring)  | `pnpm --filter @colloquium/colloquium-api exec vitest run` — 26 tests (included) | ✅     |
| feat-002 (message-composer-aggregate)       | `pnpm --filter @colloquium/messaging exec vitest run` — 242 tests (12 files)     | ✅     |
| feat-001 (channel-feed-aggregate)           | `pnpm --filter @colloquium/messaging exec vitest run` — 242 tests (included)     | ✅     |
| SL-002/feat-009 component render tests      | `pnpm --filter @colloquium/colloquium-web exec vitest run` — 16 tests (1 file)   | ✅     |

---

## Known Issues

- Console shows `[ERROR] Failed to load resource: 401` when navigating with a bad token. This is
  expected behavior — the 401 response from the API is the mechanism that triggers the error banner.
  Not a defect.
