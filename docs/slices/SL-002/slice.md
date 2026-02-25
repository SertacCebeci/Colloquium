# SL-002: channel-feed-send-ui

**User journey:** A user opens a channel page, sees its past messages rendered in a React UI, and sends a new message — the new message appears in the feed. The entire flow is verified end-to-end by a Playwright test.

**Bounded contexts involved:** Messaging

**Success metric:** A Playwright E2E test opens a channel page, asserts that past messages render correctly, sends a new message via the UI, and asserts the new message appears in the feed — passing green in CI.

**Not in this slice:**

- WebSocket real-time push (live delivery); this slice uses HTTP fetch only
