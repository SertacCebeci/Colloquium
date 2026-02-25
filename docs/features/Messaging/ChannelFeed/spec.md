# Feature Spec: channel-feed-aggregate (feat-001)

**Owning BC:** Messaging
**Type:** aggregate
**Slice:** SL-002

---

## Overview

`ChannelFeed` is a two-sided aggregate:

- **Backend side** — a stateless Hono route handler (`GET /channels/:channelId/messages`) that queries the existing `ChannelFeedView` read model (built in SL-001) and returns a paginated `ChannelFeedPage` (CT-004).
- **Frontend side** — a TanStack Query `useInfiniteQuery` hook that manages the five-state pagination machine below. The React `ChannelFeed` component renders the flattened page list, newest at the bottom.

---

## Entities

### ChannelFeed state machine (frontend / TanStack Query)

| State         | Description                                                           |
| ------------- | --------------------------------------------------------------------- |
| `Idle`        | Initial state — no data loaded, no fetch in flight                    |
| `Loading`     | Initial page fetch in progress (GET without cursor)                   |
| `Loaded`      | At least one page of messages is available; infinite scroll is active |
| `LoadingMore` | An older-page fetch is in progress (GET with `before=cursor`)         |
| `Error`       | Most recent GET returned a non-2xx response; error banner is visible  |

**Transitions:**

| From          | Command / Event                              | To            |
| ------------- | -------------------------------------------- | ------------- |
| `Idle`        | `FetchChannelFeed(channelId)`                | `Loading`     |
| `Loading`     | ← `ChannelFeedServed`                        | `Loaded`      |
| `Loading`     | ← `APIErrorOccurred`                         | `Error`       |
| `Loaded`      | `FetchChannelFeed(channelId, before=cursor)` | `LoadingMore` |
| `LoadingMore` | ← `OlderMessagesFetched`                     | `Loaded`      |
| `LoadingMore` | ← `APIErrorOccurred`                         | `Error`       |
| `Error`       | `FetchChannelFeed(channelId)` (retry)        | `Loading`     |

### Backend handler (stateless)

Inputs: `channelId` (path param), `before` (optional query string), `limit` (optional, default 50, max 50)
Auth: Bearer JWT — `channelId` membership checked against `ChannelFeedView`
Output: `ChannelFeedPage` (see CT-004)

---

## Invariants

- A `Loaded` feed must have `pages.length ≥ 1`
- A `LoadingMore` transition may only occur when the last page's `nextCursor` is non-null (`hasPreviousPage = true`)
- Each page returned by the API contains between 0 and 50 messages (inclusive)
- An `Error` state must carry a non-null, non-empty `errorMessage` string
- Messages within a page are ordered by `sequenceNumber` descending in the API response (newest first in the response body; the UI renders them bottom-up so they appear chronological)
- The API never returns a `nextCursor` value that equals the `sequenceNumber` of the _newest_ message in the page — it always points to the _oldest_

---

## Failure Modes

| Trigger                                                                 | Expected behavior                                                                                   |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Bearer token is absent or malformed on GET request                      | API returns 401; TanStack Query transitions to `Error`; error banner shows "Session expired"        |
| Authenticated user is not a member of the requested channel             | API returns 403; TanStack Query transitions to `Error`; error banner shows "Channel not accessible" |
| `channelId` does not exist in the database                              | API returns 404; TanStack Query transitions to `Error`; error banner shows "Channel not found"      |
| `FetchChannelFeed(before=cursor)` called when `nextCursor = null`       | Command is rejected client-side; no API call is made; `hasPreviousPage = false` blocks the trigger  |
| API returns a page where `nextCursor = null`                            | `hasPreviousPage` is set to `false`; intersection observer at top of list stops triggering          |
| Network request times out (TanStack Query default: 3 retries exhausted) | Transitions to `Error` with `retryable: true`; retry button re-issues `FetchChannelFeed`            |
| API response body is missing the `messages` field (malformed JSON)      | TanStack Query throws a parse error; transitions to `Error`; banner shows a generic error message   |

---

## External Contracts

- CT-004: GetChannelMessages (produced — this feature implements the provider side and the consumer hook)

---

## Test Strategy

- [x] **Domain unit:** Test the TanStack Query state machine in isolation — verify each transition (Idle→Loading, Loading→Loaded, Loading→Error, Loaded→LoadingMore, LoadingMore→Loaded, Error→Loading retry). Assert all 6 invariants via unit assertions against mock query results.
- [x] **Contract:** Integration test verifying the Hono route handler returns a response that satisfies CT-004: correct `ChannelFeedPage` shape on 200; correct error codes (401/403/404) with JSON error bodies; `nextCursor` is null when no older messages exist.
- [x] **Integration:** Hono route + Prisma test database — seed a channel with 75 messages; verify the initial fetch returns the 50 most recent with a non-null `nextCursor`; verify the second fetch (with `before=cursor`) returns the remaining 25 with `nextCursor = null`.
- [x] **E2E:** Playwright opens a channel page (seeded with messages), asserts the message list renders; scrolls to the top of the list, asserts older messages are prepended (infinite scroll trigger fires).
