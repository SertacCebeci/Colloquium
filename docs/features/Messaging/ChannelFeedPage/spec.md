# Feature Spec: channel-feed-page-read-model (feat-005)

**Owning BC:** Messaging
**Type:** read-model
**Slice:** SL-002

---

## Overview

This feature is the **data layer** of the channel feed: a `useChannelFeed(channelId, token)`
React hook that wraps TanStack Query's `useInfiniteQuery` and exposes a typed read model
mapping the `ChannelFeed` state machine from `docs/slices/SL-002/model.md`.

The hook is the consumer side of **CT-004** (`GetChannelMessages`). It makes zero domain
decisions — it maps API responses and TanStack Query internal states to the well-defined
ChannelFeed state machine.

feat-006 (`infinite-channel-feed-read-model`) extends this hook with an intersection observer
that triggers `fetchNextPage`, enabling the `LoadingMore` state. feat-005 only exposes the
data interface; feat-006 activates scroll-driven pagination.

---

## Entities

### ChannelFeed state machine

| State         | TanStack Query mapping                        | Description                                                             |
| ------------- | --------------------------------------------- | ----------------------------------------------------------------------- |
| `Idle`        | `enabled: false` (no channelId)               | Hook not yet active; `channelId` is absent or empty                     |
| `Loading`     | `isLoading: true`                             | Initial page fetch in flight; no messages available yet                 |
| `Loaded`      | `isSuccess: true && !isFetchingNextPage`      | At least one page returned; `messages` array is populated               |
| `LoadingMore` | `isSuccess: true && isFetchingNextPage: true` | Additional page fetch in flight (triggered by feat-006 scroll observer) |
| `Error`       | `isError: true`                               | Most recent fetch returned a non-2xx status; `errorMessage` is non-null |

**Transitions:**

| From          | Trigger                             | To            |
| ------------- | ----------------------------------- | ------------- |
| `Idle`        | `channelId` becomes non-empty       | `Loading`     |
| `Loading`     | CT-004 returns 200                  | `Loaded`      |
| `Loading`     | CT-004 returns non-2xx              | `Error`       |
| `Loaded`      | `fetchNextPage()` called (feat-006) | `LoadingMore` |
| `LoadingMore` | CT-004 (paginated) returns 200      | `Loaded`      |
| `LoadingMore` | CT-004 (paginated) returns non-2xx  | `Error`       |
| `Error`       | `refetch()` called (retry)          | `Loading`     |

---

## Hook Interface

```ts
type ChannelFeedState = "Idle" | "Loading" | "Loaded" | "LoadingMore" | "Error";

interface UseChannelFeedResult {
  state: ChannelFeedState;
  messages: MessageItem[]; // flattened across all pages, newest-first
  hasNextPage: boolean; // true when last page's nextCursor is non-null
  nextCursor: string | null; // sequenceNumber of oldest loaded message
  error: string | null; // non-null only in Error state
  fetchNextPage: () => void; // triggers LoadingMore (consumed by feat-006)
  refetch: () => void; // retry from Error state
}

function useChannelFeed(channelId: string, token: string): UseChannelFeedResult;
```

---

## Query function

The `queryFn` maps to CT-004:

```
GET /channels/:channelId/messages[?before=<cursor>]
Authorization: Bearer <token>
```

- Initial fetch: no `before` param
- Subsequent pages: `before=<nextCursor>` from the previous page's response
- `getNextPageParam`: `(lastPage) => lastPage.nextCursor ?? undefined`
  (returning `undefined` signals TanStack Query that no more pages exist)
- Query key: `["channelFeed", channelId]` — `channelId` change invalidates the cache

---

## Message flattening

`messages` returned by the hook is the ordered union of all loaded pages:

```ts
const messages = data.pages.flatMap((page) => page.messages);
```

- Each page is already newest-first (CT-004 guarantee)
- Page 1 contains messages with the highest sequence numbers
- Page 2 contains older messages (before the cursor from page 1), also newest-first within the page
- The flat array therefore presents messages in newest-first order globally

**Invariant:** if `pages.length > 1`, then
`messages[page1.length - 1].sequenceNumber - 1 === messages[page1.length].sequenceNumber`
(no gap between page boundary; consecutive sequence numbers).

---

## Invariants

- When `state = "Idle"`, `messages` must be an empty array and `error` must be `null`
- When `state = "Loading"`, `messages` must be an empty array (no stale data shown)
- When `state = "Loaded"`, `messages.length ≥ 0` and `data.pages.length ≥ 1`
- When `state = "Error"`, `error` must be a non-empty string (HTTP status message or network error text)
- `messages` must be ordered by `sequenceNumber` descending globally across all pages
- `nextCursor` must equal `String(messages[messages.length - 1].sequenceNumber)` when `hasNextPage: true`
- `hasNextPage` must be `false` when the last page's `nextCursor` is `null`
- Changing `channelId` resets the hook to `Loading` state with an empty `messages` array (cache key change)
- The `Authorization: Bearer <token>` header must be present on every CT-004 request; an absent
  or malformed token causes an `Error` state with a message derived from the 401 response

---

## Failure Modes

| Trigger                                                            | Expected behavior                                                                                                                  |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `channelId` is an empty string                                     | `state = "Idle"`; hook disabled; no fetch issued; `messages = []`                                                                  |
| CT-004 returns 401 (expired or missing token)                      | `state = "Error"`; `error = "Unauthorized"`; no messages shown                                                                     |
| CT-004 returns 403 (user not a member of the channel)              | `state = "Error"`; `error = "Channel not accessible"`; no messages shown                                                           |
| CT-004 returns 404 (channel does not exist)                        | `state = "Error"`; `error = "Channel not found"`; no messages shown                                                                |
| CT-004 returns 500 or network error                                | `state = "Error"`; `error` is a non-empty string from the response body or network error message                                   |
| Second page fetch (with cursor) returns 404                        | `state = "Error"`; previously loaded messages are preserved in `messages` (TanStack Query `keepPreviousData` or `placeholderData`) |
| `channelId` changes while `state = "Loading"`                      | Previous query is cancelled; new query starts; `state = "Loading"` with fresh empty `messages`                                     |
| CT-004 returns a page with `messages = []` and `nextCursor = null` | `state = "Loaded"`; `messages = []` (empty channel); `hasNextPage = false`                                                         |

---

## External Contracts

- **CT-004: GetChannelMessages** (consumed — this hook is the React consumer)

---

## Package location

The hook **must not** live in `packages/messaging` (no React or TanStack Query allowed there).
It lives in the React layer — either `packages/ui/src/hooks/` if reused across apps, or
`apps/<web-app>/src/features/messaging/hooks/` if app-specific.

The `MessageItem` and `ChannelFeedPageV1` types are imported from `@colloquium/messaging`
(already exported from `packages/messaging/src/index.ts`).

---

## Test Strategy

- [x] **Domain unit:** Test `getNextPageParam` in isolation — `(page) => page.nextCursor ?? undefined`
      returns the cursor string when non-null, and `undefined` when null. Test message flattening
      logic across 2 pages with 50+25 items; assert 75 messages in correct order; assert no gap
      at the page boundary.
      → `packages/ui/src/hooks/useChannelFeed.test.ts` — 16 tests, all GREEN
- [x] **Contract (CT-004 consumed):** Verify the hook issues `GET /channels/:channelId/messages`
      with the correct `Authorization: Bearer <token>` header; verify `before=<cursor>` is appended
      on second-page fetches; verify the hook maps the `{ messages, nextCursor }` response shape
      to the hook's return value correctly (fetch spy returning fixture pages).
      → `packages/ui/src/hooks/useChannelFeed.contract.test.ts` — 11 tests, all GREEN
- [x] **Integration:** Render a test component with `useChannelFeed("ch-1", "tok")` inside a
      `QueryClientProvider`; use mocked fetch to simulate CT-004; assert state sequence `Loading → Loaded`;
      assert `messages` contains the fixture data; call `fetchNextPage()` and assert `LoadingMore → Loaded`
      with accumulated messages. Assert `Error` state when fetch returns 401.
      → `packages/ui/src/hooks/useChannelFeed.integration.test.tsx` — 10 tests, all GREEN
- [ ] **E2E:** Deferred to feat-009 (`e2e-channel-feed-playwright`) — browser-level scroll,
      render, and auth integration. E2E automation not appropriate at this layer; feat-005 is a
      data hook with no rendered UI of its own.
