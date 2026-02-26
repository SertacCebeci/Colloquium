# Feature Spec: channel-page-error-state (feat-008)

**Owning BC:** Messaging
**Type:** read-model
**Slice:** SL-002

---

## Overview

This feature projects the combined error state of the channel page into a single
`ChannelPageErrorState` value consumed by the UI error banner. It composites error signals from
two upstream hooks:

- **feat-006** (`useInfiniteChannelFeed`) — feed-fetch errors (`ChannelFeedState === "Error"`)
- **feat-007** (`useMessageComposer`) — message-post errors (`MessageComposerState === "Error"`)

**Error priority:** feed errors take precedence over composer errors when both are active
simultaneously (feed failure = user cannot read messages at all; composer failure = user can still
read, just not send).

**Retryability:**

- Feed error → `retryable = true` (UI shows a "Retry" button calling `feed.refetch()`)
- Composer error → `retryable = false` (error shown inline; user retries by clicking Send again)

---

## Read Model Shape

```ts
export interface ChannelPageErrorState {
  visible: boolean; // true when either feed or composer is in Error
  message: string; // error message to display; empty string when not visible
  retryable: boolean; // true only for feed errors (retry = re-fetch)
}
```

---

## Pure Function

```ts
// Exported for isolated unit testing — no React, no hooks
export function deriveErrorState(opts: {
  feedState: ChannelFeedState;
  feedError: Error | null;
  composerState: MessageComposerState;
  composerErrorMessage: string | null;
}): ChannelPageErrorState;
```

**Derivation rules:**

| feedState | composerState | visible | message                                            | retryable |
| --------- | ------------- | ------- | -------------------------------------------------- | --------- |
| `"Error"` | any           | `true`  | `feedError.message ?? "Failed to load messages"`   | `true`    |
| non-Error | `"Error"`     | `true`  | `composerErrorMessage ?? "Failed to send message"` | `false`   |
| non-Error | non-Error     | `false` | `""`                                               | `false`   |

---

## Hook Interface

```ts
export function useChannelPageErrorState(
  feed: UseInfiniteChannelFeedResult,
  composer: UseMessageComposerResult
): ChannelPageErrorState;
```

**Usage pattern — the page component composes all three hooks:**

```tsx
const feed = useInfiniteChannelFeed(channelId, token);
const composer = useMessageComposer(channelId, token);
const errorState = useChannelPageErrorState(feed, composer);

return (
  <>
    {errorState.visible && (
      <ErrorBanner
        message={errorState.message}
        onRetry={errorState.retryable ? feed.refetch : undefined}
      />
    )}
    {/* feed messages list */}
    {/* composer input */}
  </>
);
```

---

## Invariants

- When `feedState === "Error"`, `deriveErrorState` returns `visible = true`, `retryable = true`
- When `composerState === "Error"` and `feedState !== "Error"`, `deriveErrorState` returns `visible = true`, `retryable = false`
- When neither feed nor composer is in `"Error"`, `deriveErrorState` returns `visible = false`, `message = ""`, `retryable = false`
- `message` is never `null` or `undefined` — it is always a string (empty string when `visible = false`)
- Feed error has strict precedence: if `feedState === "Error"`, `composerState` value is irrelevant to the output
- `retryable = true` implies `visible = true` (a retryable error is always visible)

---

## Failure Modes

| Trigger                                                                     | Expected behavior                                                                      |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `feedState === "Error"` with `feedError = null` (error without message)     | `message = "Failed to load messages"` (fallback); `visible = true`, `retryable = true` |
| `composerState === "Error"` with `composerErrorMessage = null`              | `message = "Failed to send message"` (fallback); `visible = true`, `retryable = false` |
| Both `feedState === "Error"` and `composerState === "Error"` simultaneously | Feed error wins: `retryable = true`, message from feed error                           |
| `feedState` transitions from `"Error"` to `"Loading"` (retry issued)        | `visible` drops to `false` immediately (derived from current state, no stale cache)    |
| `composerState` transitions from `"Error"` to `"Submitting"` (retry send)   | `visible` drops to `false` immediately                                                 |

---

## External Contracts

None — this feature is bounded within the Messaging BC. It consumes hook results from feat-006
and feat-007 (both in `@colloquium/ui`) — no HTTP contracts involved.

---

## Package Location

`packages/ui/src/hooks/useChannelPageErrorState.ts`

---

## Test Strategy

- [ ] **Domain unit:** Test `deriveErrorState` in isolation for all combinations: feed Error / non-Error
      × composer Error / non-Error × null vs non-null error messages. Verify all 6 invariants. No React.
      → `packages/ui/src/hooks/useChannelPageErrorState.test.ts`

- [ ] **Integration:** Render a `ErrorStateHarness` component that composes `useInfiniteChannelFeed` +
      `useMessageComposer` + `useChannelPageErrorState` with mocked fetch; assert:
  - Feed 5xx → `visible = true`, `retryable = true`
  - Composer 4xx → `visible = true`, `retryable = false`
  - Both in Error → feed error wins (retryable = true)
  - Feed retries successfully → `visible = false`
    → `packages/ui/src/hooks/useChannelPageErrorState.integration.test.tsx`

- [ ] **E2E:** Deferred to feat-009 (`e2e-channel-feed-playwright`) — browser-level error banner
      verification with a real server. Not appropriate at this hook's boundary.
