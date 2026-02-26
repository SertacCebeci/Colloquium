# Feature Spec: infinite-channel-feed-read-model (feat-006)

**Owning BC:** Messaging
**Type:** read-model
**Slice:** SL-002

---

## Overview

This feature adds **scroll-driven pagination** to the channel feed data layer built in feat-005.
It wraps `useChannelFeed` with a `useInfiniteChannelFeed` hook that internally creates an
`IntersectionObserver` watching a caller-supplied `sentinelRef` element. When the sentinel
enters the viewport AND the feed has more pages, `fetchNextPage()` is called automatically,
triggering the `Loaded → LoadingMore` transition from the ChannelFeed state machine.

feat-005 owns the query interface and state machine; feat-006 owns the auto-trigger mechanism
only. The full `UseChannelFeedResult` is re-exported unchanged — consumers swap
`useChannelFeed` for `useInfiniteChannelFeed` with no other changes required.

---

## Entities

### ChannelFeed state machine (inherited from feat-005)

| State         | Description                                                                     |
| ------------- | ------------------------------------------------------------------------------- |
| `Idle`        | `channelId` is absent or empty — observer not attached                          |
| `Loading`     | Initial page fetch in flight; sentinel not yet active                           |
| `Loaded`      | At least one page available; observer is active and watching `sentinelRef`      |
| `LoadingMore` | `fetchNextPage()` has been called; observer is suspended until fetch resolves   |
| `Error`       | Most recent fetch returned non-2xx; observer remains attached for retry support |

**Transitions (observer-driven additions):**

| From          | Trigger                                                | To            |
| ------------- | ------------------------------------------------------ | ------------- |
| `Loaded`      | `sentinelRef` enters viewport AND `hasNextPage = true` | `LoadingMore` |
| `LoadingMore` | CT-004 paginated 200 response                          | `Loaded`      |
| `LoadingMore` | CT-004 paginated non-2xx response                      | `Error`       |

All other transitions are inherited unchanged from feat-005.

---

## Hook Interface

```ts
interface UseInfiniteChannelFeedResult extends UseChannelFeedResult {
  sentinelRef: React.RefObject<HTMLDivElement>;
  // Attach to the bottom sentinel element (e.g. <div ref={sentinelRef} />).
  // The observer is active while state = "Loaded" and hasNextPage = true.
}

function useInfiniteChannelFeed(channelId: string, token: string): UseInfiniteChannelFeedResult;
```

**Usage pattern:**

```tsx
const { state, messages, sentinelRef } = useInfiniteChannelFeed(channelId, token);
return (
  <>
    {messages.map((m) => (
      <MessageRow key={m.messageId} {...m} />
    ))}
    <div ref={sentinelRef} aria-hidden />
  </>
);
```

---

## IntersectionObserver contract

- **Observed element:** `sentinelRef.current` (a `<div>` at the bottom of the message list)
- **Observer options:** `{ threshold: 0, rootMargin: "0px" }`
  (trigger as soon as any pixel of the sentinel enters the viewport)
- **Guard condition:** `fetchNextPage()` is called only when ALL of:
  1. `entry.isIntersecting === true`
  2. `hasNextPage === true`
  3. `state === "Loaded"` (not `"LoadingMore"` — prevents duplicate page requests)
- **Lifecycle:**
  - Observer created in `useEffect` when `sentinelRef.current` is non-null
  - Observer disconnected in `useEffect` cleanup on unmount
  - `useEffect` dependencies include `channelId` — observer is re-created on channel change
- **Unsupported environment:** if `typeof IntersectionObserver === "undefined"` (SSR or very old browser), skip observer setup silently; pagination falls back to the manual `fetchNextPage()` on the returned result

---

## Invariants

- `fetchNextPage()` must never be called when `state === "LoadingMore"` — TanStack Query would enqueue a duplicate page request
- `fetchNextPage()` must never be called when `hasNextPage === false` — the cursor chain is exhausted
- `sentinelRef` must be a stable `RefObject` across renders — do NOT recreate it on each render
- When `channelId` changes the observer must be fully disconnected before re-attaching to the new channel's sentinel
- If `sentinelRef.current` is null at observer creation time (element not yet mounted), the observer is not started; it will be created on the next render cycle once the element mounts
- `UseInfiniteChannelFeedResult` must be a strict superset of `UseChannelFeedResult` — all fields from feat-005 are present with identical semantics

---

## Failure Modes

| Trigger                                                                    | Expected behavior                                                                                              |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `sentinelRef` element never mounts (null ref on first render)              | Observer not started; no `fetchNextPage` call; sentinel observed on next render cycle when non-null            |
| Sentinel enters viewport while `state = "LoadingMore"`                     | `fetchNextPage()` not called (guard); observer stays attached; next intersection after Loaded fires            |
| Sentinel enters viewport while `hasNextPage = false`                       | `fetchNextPage()` not called (guard); observer stays attached but will never fire again                        |
| `IntersectionObserver` not available in environment (SSR / legacy browser) | Observer setup skipped silently; hook still returns `fetchNextPage` for manual triggering                      |
| Second page returns 404 while sentinel is intersecting                     | State transitions to `Error`; observer remains attached; `refetch()` available on result                       |
| `channelId` changes mid-observation                                        | Observer disconnected immediately (old channel); new observer attached after `state = "Loaded"` on new channel |

---

## External Contracts

- **CT-004: GetChannelMessages** (consumed — inherited via `useChannelFeed` from feat-005)

---

## Package location

Same as feat-005: `packages/ui/src/hooks/useInfiniteChannelFeed.ts`.
Must not live in `packages/messaging` — React and `useRef`/`useEffect` are not permitted there.

---

## Test Strategy

- [x] **Domain unit:** Test the observer guard function in isolation —
      `shouldFetchNextPage({ state, hasNextPage })` returns `true` only when
      `state === "Loaded" && hasNextPage === true`; returns `false` for all other state/hasNextPage
      combinations (6 combinations covering `LoadingMore`, `Loading`, `Idle`, `Error`, `hasNextPage = false`).
      → `packages/ui/src/hooks/useInfiniteChannelFeed.test.ts` — 11 tests, all GREEN
- [x] **Integration:** Render a test component with `useInfiniteChannelFeed("ch-1", "tok")`
      inside a `QueryClientProvider`; use mocked fetch and a `MockIntersectionObserver`;
      assert that making the sentinel intersect triggers `LoadingMore → Loaded` with accumulated messages;
      assert that intersecting again when `hasNextPage = false` does NOT trigger a second page fetch;
      assert that intersecting during `LoadingMore` does NOT trigger a duplicate fetch.
      → `packages/ui/src/hooks/useInfiniteChannelFeed.integration.test.tsx` — 7 tests, all GREEN
- [ ] **E2E:** Deferred to feat-009 (`e2e-channel-feed-playwright`) — browser-level scroll
      through a real message list with a real IntersectionObserver. Not appropriate at this layer;
      feat-006 is a scroll-trigger hook with no rendered UI of its own.
