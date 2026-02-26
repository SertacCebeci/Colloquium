# Feature Spec: channel-message-form-state (feat-007)

**Owning BC:** Messaging
**Type:** read-model
**Slice:** SL-002

---

## Overview

This feature wires the `MessageComposer` aggregate (feat-002) to the React layer via a
`useMessageComposer` hook. It owns:

1. **Form state management** — `inputValue`, `validationError`, `errorMessage`, and
   `state` (the `MessageComposerState` machine).
2. **HTTP mutation** — calls CT-005 (`POST /channels/:channelId/messages`) via TanStack Query
   `useMutation`.
3. **Cache append** — on 201, appends the server-returned `MessageItem` to the TanStack Query
   `channelFeed` cache using `queryClient.setQueryData`; no second GET is issued.

feat-002 owns the pure domain logic; feat-007 owns the React + network adapter only.

---

## Entities

### MessageComposer state machine (inherited from feat-002)

| State        | Description                                                                       |
| ------------ | --------------------------------------------------------------------------------- |
| `Idle`       | `inputValue` is empty or whitespace; no submission in flight                      |
| `Typing`     | User has entered non-empty content; input is editable                             |
| `Submitting` | POST in flight; input is locked; `onSubmit` is a no-op                            |
| `Error`      | Most recent POST returned non-2xx; `errorMessage` is set; input is editable again |

**Transitions:**

| From              | Trigger                                    | To                              |
| ----------------- | ------------------------------------------ | ------------------------------- |
| `Idle` / `Typing` | `onChange(value)` — value.trim() non-empty | `Typing`                        |
| `Typing`          | `onChange(value)` — value.trim() empty     | `Idle`                          |
| `Idle`            | `onSubmit()` — empty input                 | `Idle` (validationError set)    |
| `Typing`          | `onSubmit()` — content > 4000 chars        | `Typing` (validationError set)  |
| `Typing`          | `onSubmit()` — valid content               | `Submitting`                    |
| `Submitting`      | CT-005 returns 201                         | `Idle` (inputValue reset to "") |
| `Submitting`      | CT-005 returns non-2xx                     | `Error`                         |
| `Error`           | `onSubmit()` — content still present       | `Submitting`                    |
| `Submitting`      | `onSubmit()` called while in-flight        | `Submitting` (no-op)            |

---

## Hook Interface

```ts
export type MessageComposerState = "Idle" | "Typing" | "Submitting" | "Error";

export interface UseMessageComposerResult {
  state: MessageComposerState;
  inputValue: string;
  validationError: string | null; // set by validateInput on onSubmit
  errorMessage: string | null; // set on CT-005 non-2xx; null in all other states
  onChange: (value: string) => void;
  onSubmit: () => void;
}

function useMessageComposer(channelId: string, token: string): UseMessageComposerResult;
```

**Usage pattern:**

```tsx
const { state, inputValue, validationError, errorMessage, onChange, onSubmit } = useMessageComposer(
  channelId,
  token
);

return (
  <>
    {errorMessage && <ErrorBanner message={errorMessage} />}
    <textarea
      value={inputValue}
      onChange={(e) => onChange(e.target.value)}
      disabled={state === "Submitting"}
    />
    <button onClick={onSubmit} disabled={state !== "Typing"}>
      Send
    </button>
    {validationError && <span>{validationError}</span>}
  </>
);
```

---

## Pure Functions (domain layer)

```ts
// Exported for isolated unit testing
function validateInput(content: string): string | null;
// Returns null if valid, "empty" if blank/whitespace, "too-long" if > 4000 chars

function mapMutationStateToComposerState(
  isPending: boolean,
  isError: boolean,
  inputValue: string
): MessageComposerState;
// Derives state from TanStack Query mutation status + inputValue
```

---

## Cache Append Contract

On CT-005 201 response, the hook calls:

```ts
queryClient.setQueryData(["channelFeed", channelId], (old: InfiniteData<ChannelFeedPageV1>) => ({
  ...old,
  pages: old.pages.map((page, i) =>
    i === old.pages.length - 1 ? { ...page, messages: [...page.messages, newMessage] } : page
  ),
}));
```

`newMessage` is the 201 response body (fields: `messageId`, `authorId`, `content`,
`sequenceNumber`, `postedAt`) — directly `MessageItem`-compatible per CT-005 consumer
expectations. No transformation required.

---

## Invariants

- `validateInput("")` returns `"empty"` — `onSubmit` from `Idle` sets `validationError = "empty"` and does NOT issue a POST
- `validateInput("x".repeat(4001))` returns `"too-long"` — `onSubmit` blocks the POST and sets `validationError = "too-long"`
- `validateInput("hello")` returns `null` — `onSubmit` proceeds to `Submitting`
- While `state === "Submitting"`, calling `onSubmit()` again is a no-op (mutation `isPending` guard)
- On 201 success: `inputValue` resets to `""`, `state` returns to `"Idle"`, `validationError` clears to `null`
- On non-2xx: `state` transitions to `"Error"` and `errorMessage` is set to the server's `error` field or fallback HTTP status text
- `errorMessage` is `null` in every state except `"Error"`
- `validationError` is cleared to `null` when `onSubmit` succeeds (transitions to `Submitting`)

---

## Failure Modes

| Trigger                                                          | Expected behavior                                                                                    |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `onSubmit()` called with `inputValue = ""` (Idle state)          | `validationError = "empty"` set; no POST issued; state stays `Idle`                                  |
| `onSubmit()` called with `inputValue.length > 4000`              | `validationError = "too-long"` set; no POST issued; state stays `Typing`                             |
| CT-005 returns 401 (token expired)                               | State → `Error`; `errorMessage` = server `error` field or "Unauthorized"; input re-enabled           |
| CT-005 returns 403 (not a channel member)                        | State → `Error`; `errorMessage` = server `error` field; input re-enabled                             |
| CT-005 returns 422 (content invalid per server)                  | State → `Error`; `errorMessage` = server `error` field (e.g., "content too long"); input re-enabled  |
| CT-005 returns 5xx                                               | State → `Error`; `errorMessage` = server `error` or fallback "Server error"; input re-enabled        |
| `onSubmit()` called twice rapidly (double-tap)                   | Second call is a no-op while `state === "Submitting"`; only one POST issued                          |
| `channelId` changes while `Submitting` (channel switch mid-post) | TanStack Query mutation is scoped to the invocation; cache append uses the old channelId; acceptable |

---

## External Contracts

- **CT-005: PostChannelMessage** (consumed — POST /channels/:channelId/messages)

---

## Package Location

`packages/ui/src/hooks/useMessageComposer.ts`
Must not live in `packages/messaging` — React and TanStack Query are not permitted there.

---

## Test Strategy

- [x] **Domain unit:** Test `validateInput` in isolation — returns `null` for valid content, `"empty"` for
      blank/whitespace, `"too-long"` for > 4000 chars. Test `mapMutationStateToComposerState` for all
      `isPending` × `isError` × `inputValue` combinations. No React, no HTTP.
      → `packages/ui/src/hooks/useMessageComposer.test.ts` — 18 tests, all GREEN

- [x] **Contract:** CT-005 consumer contract tests — verify POST to correct URL with `Authorization` header
      and `{ content }` body; verify 201 response deserialization; verify 422/401/403/404 error handling
      routes to `Error` state with correct `errorMessage`.
      → `packages/ui/src/hooks/useMessageComposer.contract.test.ts` — 11 tests, all GREEN

- [x] **Integration:** Render a `ComposerHarness` component wrapping `useMessageComposer("ch-1", "tok")`
      inside `QueryClientProvider`; mock fetch; assert:
  - `onChange("hello")` → `state = "Typing"`
  - `onSubmit()` → `state = "Submitting"` → POST issued
  - 201 response → `state = "Idle"`, `inputValue = ""`, cache updated with new message
  - Non-2xx response → `state = "Error"`, `errorMessage` set
  - `onSubmit()` while `Submitting` → no second POST
    → `packages/ui/src/hooks/useMessageComposer.integration.test.tsx` — 9 tests, all GREEN

- [ ] **E2E:** Deferred to feat-009 (`e2e-channel-feed-playwright`) — full compose → send → feed-append
      flow with a real server. Not appropriate at this layer; feat-007 is a mutation hook with no
      rendered UI of its own.
