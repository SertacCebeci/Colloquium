# Feature Spec: e2e-channel-feed-playwright (feat-009)

**Owning BC:** Messaging
**Type:** read-model (assembled UI page + Playwright E2E)
**Slice:** SL-002

---

## Overview

This feature assembles the complete **ChannelFeedPage** in `colloquium-web` by wiring the three
hooks from feat-005 through feat-008 into a rendered React component, adds a
`/channels/:channelId` route, and verifies the assembled page end-to-end with Playwright against a
real running `colloquium-api` instance (the existing `uat-seed-server.ts`, port 5099, in-memory).

**Scope:**

1. `ChannelFeedPage` component in `apps/colloquium-web/src/features/messaging/ChannelFeedPage.tsx`
2. Route `/channels/:channelId?token=<JWT>` added to `colloquium-web/src/App.tsx`
3. Vite proxy (`/channels → http://localhost:5099`) so hooks keep using relative URLs
4. Playwright installed and configured in `apps/colloquium-web`
5. Three Playwright E2E tests covering the critical path nodes

---

## ChannelFeedPage Component

### Props / inputs

```tsx
// Token read from URL query param: /channels/:channelId?token=<JWT>
// channelId read from React Router useParams()
// No explicit props needed.
function ChannelFeedPage(): JSX.Element;
```

### DOM structure (required data-testids for Playwright)

```tsx
<div data-testid="channel-feed-page">
  {/* Error banner — visible only when errorState.visible */}
  {errorState.visible && (
    <div data-testid="error-banner">
      <span data-testid="error-message">{errorState.message}</span>
      {errorState.retryable && (
        <button data-testid="retry-button" onClick={() => void feed.refetch()}>
          Retry
        </button>
      )}
    </div>
  )}

  {/* Message list — newest-first, newest at top */}
  <div data-testid="messages">
    {feed.messages.map((msg) => (
      <div key={msg.messageId} data-testid={`message-${msg.messageId}`}>
        <span data-testid="message-content">{msg.content}</span>
      </div>
    ))}
  </div>

  {/* Infinite scroll sentinel — at the BOTTOM (triggers LoadingMore for older pages) */}
  <div data-testid="sentinel" ref={feed.sentinelRef} />

  {/* Composer */}
  <textarea
    data-testid="composer-input"
    value={composer.inputValue}
    onChange={(e) => composer.onChange(e.target.value)}
    disabled={composer.state === "Submitting"}
    placeholder="Write a message…"
  />
  <button data-testid="composer-send" onClick={composer.onSubmit}>
    Send
  </button>
</div>
```

### State machine rendering rules

| Feed State    | Rendered                                                          |
| ------------- | ----------------------------------------------------------------- |
| `Idle`        | Empty messages div; no spinner needed                             |
| `Loading`     | Empty messages div; optionally show loading indicator             |
| `Loaded`      | All messages rendered; sentinel visible for scroll detection      |
| `LoadingMore` | All current messages rendered; spinner below sentinel (optional)  |
| `Error`       | Error banner visible with `retryable=true`; messages may be stale |

| Composer State | Rendered                                                         |
| -------------- | ---------------------------------------------------------------- |
| `Idle`         | Empty textarea; Send button enabled                              |
| `Typing`       | Textarea has content; Send button enabled                        |
| `Submitting`   | Textarea disabled                                                |
| `Error`        | Error banner visible with `retryable=false`; textarea re-enabled |

---

## Vite Proxy Configuration

Add to `apps/colloquium-web/vite.config.ts`:

```ts
server: {
  proxy: {
    '/channels': {
      target: 'http://localhost:5099',
      changeOrigin: true,
    },
  },
},
```

This forwards all `/channels/*` requests from the Vite dev server (port 5174) to the
uat-seed-server (port 5099), so hooks continue using relative URLs unchanged.

---

## Playwright Setup

### Install

```bash
pnpm --filter @colloquium/colloquium-web add -D @playwright/test
npx playwright install chromium
```

### Config — `apps/colloquium-web/playwright.config.ts`

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:5174",
  },
  webServer: [
    {
      // UAT seed server — in-memory API with 75 messages
      command: "tsx ../../apps/colloquium-api/src/uat-seed-server.ts",
      url: "http://localhost:5099",
      stdout: "pipe",
      reuseExistingServer: false,
    },
    {
      // Vite web app — proxies /channels/* to port 5099
      command: "pnpm dev",
      url: "http://localhost:5174",
      reuseExistingServer: false,
    },
  ],
});
```

### Token fixture

`apps/colloquium-web/e2e/fixtures.ts` — generate the JWT that matches uat-seed-server constants:

```ts
import jwt from "jsonwebtoken";

export const UAT_SECRET = "uat-secret-2026";
export const UAT_CHANNEL_ID = "ch-uat-001";
export const UAT_MEMBER_ID = "uat-user-1";
export const UAT_TOKEN = jwt.sign({ sub: UAT_MEMBER_ID }, UAT_SECRET);
export const CHANNEL_URL = `/channels/${UAT_CHANNEL_ID}?token=${UAT_TOKEN}`;
```

---

## Invariants

- After page load with a valid token, at least one `data-testid="message-*"` element is visible
  within 5 seconds (uat-seed-server always has 75 messages)
- After `composer-send` click with non-empty input, the new message appears in the message list
  with a `data-testid="message-<messageId>"` element within 3 seconds
- After scrolling to the sentinel on a page with 75 messages (page 1 has 50, page 2 has 25),
  the total message count in the DOM increases from 50 to 75 within 5 seconds
- When navigating with `?token=invalid-token`, the `data-testid="error-banner"` element is
  visible within 5 seconds and `data-testid="retry-button"` is present
- `data-testid="error-banner"` is never visible when feed state is `Loaded` and composer state
  is not `Error`

---

## Failure Modes

| Trigger                                                                | Expected behavior                                                                              |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Navigate to `/channels/ch-uat-001?token=bad-token`                     | Feed → Error; `error-banner` appears with message "Unauthorized"; `retry-button` is present    |
| Playwright can't connect to uat-seed-server (port 5099 not responding) | `webServer` start fails; Playwright exits with "server not ready" error before any test runs   |
| Composer textarea submitted while empty (no text typed)                | No POST issued; validation error "empty" shown inline; `error-banner` not shown                |
| Send button clicked with valid content and valid token                 | POST 201; new message appears in list; textarea cleared; no error banner                       |
| Scroll to sentinel when `nextCursor = null` (all 75 messages loaded)   | No additional fetch issued; message count stays at 75; `LoadingMore` state not triggered again |

---

## External Contracts

- **CT-004: GetChannelMessages** (consumed — via `useInfiniteChannelFeed`)
- **CT-005: PostChannelMessage** (consumed — via `useMessageComposer`)

---

## Test Strategy

- [ ] **Domain unit:** N/A — this feature assembles hooks; all domain logic is covered by
      feat-005 through feat-008's unit tests.

- [ ] **Integration (component render):** Shallow render of `ChannelFeedPage` with mocked hooks
      verifying correct data-testid structure and conditional rendering of error banner / retry button.
      → `apps/colloquium-web/src/features/messaging/ChannelFeedPage.test.tsx`

- [ ] **E2E — critical path node 1: Messages load on page open**
      Navigate to `/channels/ch-uat-001?token=<UAT_TOKEN>`.
      Assert: ≥ 1 `data-testid="message-*"` elements visible within 5s.
      Assert: `data-testid="error-banner"` is not visible.

- [ ] **E2E — critical path node 2: Send a message**
      Navigate to page. Wait for Loaded state.
      Type "Hello E2E" in `data-testid="composer-input"`.
      Click `data-testid="composer-send"`.
      Assert: new message with content "Hello E2E" appears in the message list within 3s.
      Assert: textarea is cleared after send.

- [ ] **E2E — critical path node 3: Infinite scroll loads older messages**
      Navigate to page. Wait for Loaded state (50 messages visible).
      Count messages. Assert count = 50.
      Scroll sentinel into view.
      Wait for message count to reach 75.
      Assert: total `data-testid="message-*"` elements = 75.

- [ ] **E2E — critical path node 4: Feed error banner on bad token**
      Navigate to `/channels/ch-uat-001?token=bad-token`.
      Assert: `data-testid="error-banner"` is visible within 5s.
      Assert: `data-testid="retry-button"` is present (feed error is retryable).
      Assert: `data-testid="error-message"` text contains "Unauthorized".
