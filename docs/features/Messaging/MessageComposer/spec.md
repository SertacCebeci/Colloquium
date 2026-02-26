# Feature Spec: message-composer-aggregate (feat-002)

**Owning BC:** Messaging
**Type:** aggregate
**Slice:** SL-002

---

## Overview

`MessageComposer` is a **client-side aggregate** modelling the state of a channel message input form. It owns validation, submission lifecycle, and error display. It emits domain events consumed by the UI layer (feat-007 — `channel-message-form-state`) and issues a `PostMessageAPICallMade` event that the HTTP adapter (feat-004 — `post-channel-message-api-wiring`) acts on.

The aggregate has no server-side persistence: its state lives in the React component tree (or a Zustand slice wired in feat-007).

---

## Entities

### MessageComposer state machine

| State        | Description                                                                       |
| ------------ | --------------------------------------------------------------------------------- |
| `Idle`       | Input is empty; no submission in flight                                           |
| `Typing`     | User has entered text; input is non-empty                                         |
| `Submitting` | POST /channels/:channelId/messages is in flight; input is locked                  |
| `Error`      | POST returned a non-2xx response; error message is shown; input is editable again |

**Transitions:**

| From              | Command / Event                                            | To                                    |
| ----------------- | ---------------------------------------------------------- | ------------------------------------- |
| `Idle`            | `ValidateMessage("")` (empty input)                        | `Idle` (validationError shown inline) |
| `Idle` / `Typing` | user types content                                         | `Typing`                              |
| `Typing`          | `ValidateMessage(content)` — content empty or > 4000 chars | `Typing` (validationError shown)      |
| `Typing`          | `SubmitMessage(content)` — valid content                   | `Submitting`                          |
| `Submitting`      | ← `ChannelMessagePosted` (201 response body received)      | `Idle` (+ auto-fires `ClearInput`)    |
| `Submitting`      | ← `APIErrorOccurred`                                       | `Error`                               |
| `Error`           | `SubmitMessage(content)`                                   | `Submitting`                          |

---

## Invariants

- A `Submitting` state requires `inputValue.trim().length > 0` — a submission cannot be in-flight for an empty message
- The `Submitting → Idle` transition (success path) must atomically set `inputValue = ""` and `isSubmitting = false`; both mutations happen before any re-render
- An `Error` state must carry a non-null, non-empty `errorMessage` string — rendering an error banner with no message is not permitted
- `inputValue` must not exceed 4000 characters; at 4001 characters `SubmitMessage` is rejected and the aggregate remains in `Typing` with `validationError: "too-long"`
- `ValidateMessage` never mutates aggregate state (`isSubmitting` remains unchanged) — it only sets `validationError`

---

## Failure Modes

| Trigger                                                                          | Expected behavior                                                                                                                             |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `SubmitMessage("")` or `SubmitMessage("   ")` called from `Idle` or `Typing`     | Command rejected; `EmptyMessageRejected { reason: 'empty' }` emitted; aggregate stays in current state                                        |
| `inputValue.length` exceeds 4000 before submission attempt                       | `ValidateMessage` emits `EmptyMessageRejected { reason: 'too-long' }`; `SubmitMessage` is blocked; state stays `Typing`                       |
| POST returns 4xx (e.g., 401 session expired, 403 not a member, 429 rate-limited) | `APIErrorOccurred { source: 'message-post', statusCode: <n>, message: <server message> }` emitted; transitions to `Error`                     |
| POST returns 5xx (server error)                                                  | `APIErrorOccurred { source: 'message-post', statusCode: 5xx, message: "Server error" }` emitted; transitions to `Error`; input editable again |
| `SubmitMessage` called while aggregate is already in `Submitting`                | Command is ignored; no second POST is issued; `isSubmitting` remains `true` (guards against double-tap)                                       |
| `SubmitMessage` called from `Error` state with the previously-failing content    | Aggregate re-enters `Submitting`; a fresh POST is issued; error banner is dismissed                                                           |

---

## External Contracts

None — this aggregate is bounded within the Messaging BC. The HTTP adapter that calls CT-005 (`PostChannelMessage`) is wired in feat-004 (`post-channel-message-api-wiring`), which depends on this feature. The composer emits `PostMessageAPICallMade`; the adapter listens and issues the POST.

---

## Test Strategy

- [ ] **Domain unit:** Test every state machine transition in isolation (no HTTP, no React). Verify all 5 invariants as explicit assertions. Verify `ValidateMessage` sets `validationError` without mutating `isSubmitting`. Verify double-`SubmitMessage` guard is a no-op. Assert `ClearInput` fires on the `Submitting → Idle` success path.
- [ ] **Integration:** N/A at this feature's scope — the aggregate is a pure in-memory state machine with no persistence layer.
- [ ] **E2E:** Deferred to feat-009 (`e2e-channel-feed-playwright`) which covers the full compose → send → feed-append flow after all UI features are complete.

  **E2E automation skipped for feat-002 scope** — the `MessageComposer` aggregate has no browser surface area at this feature's boundary (the React form component and Zustand wiring are feat-007). Manual UAT gate for feat-002:
  1. Instantiate `new MessageComposer("ch-1")` in a browser console or test harness.
  2. Call `typeContent("Hello")` — assert `state === "Typing"`.
  3. Call `submitMessage("Hello")` — assert `state === "Submitting"` and `PostMessageAPICallMade` event is returned.
  4. Call `messagePosted({ messageId: "m1", authorId: "u1", content: "Hello", sequenceNumber: 1, postedAt: "…" })` — assert `state === "Idle"`, `inputValue === ""`, `isSubmitting === false`.
  5. Call `messageFailed(500, "Server error")` (from a fresh `submittingComposer`) — assert `state === "Error"`, `errorMessage === "Server error"`.
