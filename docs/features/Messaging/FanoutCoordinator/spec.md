# Feature Spec: active-sessions-for-channel (feat-009)

**Owning BC:** Messaging
**Type:** infrastructure coordinator (labelled read-model in state.json — see Architecture Decision below)
**Slice:** SL-001

---

## Architecture Decision

`FanoutCoordinator` is an in-process infrastructure service, not a passive read model. It owns:

1. **SessionRegistry** — `Map<connectionId, { session: WebSocketSession, sendFn: (msg: unknown) => void }>`
2. **Channel index** — `Map<channelId, Set<connectionId>>` (secondary index for efficient fanout)

The "active-sessions-for-channel" name refers to the `getSessionsForChannel(channelId)` query the coordinator exposes. The coordinator itself orchestrates the full lifecycle: session registration, subscription management, channel index maintenance, and live message fanout.

No HTTP surface in SL-001 — all calls are in-process. `fanout(event)` is called directly by the caller after `handlePostChannelMessage` returns a `ChannelMessagePostedV1` payload.

`sendFn` is stored at `openSession` time. The coordinator calls the stored `sendFn` during fanout, so callers do not need to supply a sendFn map at fanout time.

---

## Entities

### FanoutCoordinator (infrastructure service — in-process, never persisted)

| Internal State    | Type                                                                               | Description                                           |
| ----------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `sessions`        | `Map<connectionId, { session: WebSocketSession, sendFn: (msg: unknown) => void }>` | Session registry; one entry per open connection       |
| `channelSessions` | `Map<channelId, Set<connectionId>>`                                                | Secondary index: which connections watch each channel |

The coordinator has no states of its own — it is a long-lived singleton that mutates as sessions are opened, subscribed, and closed.

---

## Commands / Operations

### `openSession(connectionId: string, memberId: string, sendFn: (msg: unknown) => void): WebSocketSessionOpened[]`

Creates a new `WebSocketSession`, calls `session.registerSession(memberId)`, stores `{ session, sendFn }` in the registry under `connectionId`.

- Throws `DuplicateConnectionError` if `connectionId` already exists in the registry.
- Returns the events emitted by `session.registerSession`: `[WebSocketSessionOpened]`.

### `subscribeToChannel(connectionId: string, channelId: string, lastKnownSeq: number, repo: ChannelRepository): (ChannelSubscriptionRegistered | MissedMessagesDelivered)[]`

Delegates to `sessions.get(connectionId).session.subscribeToChannel(channelId, lastKnownSeq, repo, sendFn)`.

- Throws `SessionNotFoundError` if `connectionId` is not in the registry.
- Adds `connectionId` to `channelSessions.get(channelId)` (creating the set if absent).
- Returns events from the delegate call (`ChannelSubscriptionRegistered` + optionally `MissedMessagesDelivered`).
- On re-subscribe: delegate's idempotency applies; index add is idempotent (Set).

### `unsubscribeFromChannel(connectionId: string, channelId: string): ChannelSubscriptionRemoved[]`

Delegates to `sessions.get(connectionId).session.unsubscribeFromChannel(channelId)`.

- Throws `SessionNotFoundError` if `connectionId` is not in the registry.
- Removes `connectionId` from `channelSessions.get(channelId)` if present (no-op if absent — consistent with `WebSocketSession.unsubscribeFromChannel`).
- Returns events from the delegate call (0 or 1 `ChannelSubscriptionRemoved`).

### `closeSession(connectionId: string): WebSocketSessionClosed[]`

Delegates to `sessions.get(connectionId).session.terminateSession()`.

- Throws `SessionNotFoundError` if `connectionId` is not in the registry.
- Removes `connectionId` from every set in `channelSessions` (atomically clears the secondary index for this connection).
- Removes the `{ session, sendFn }` entry from `sessions`.
- Returns events from the delegate call: `[WebSocketSessionClosed]`.

### `fanout(event: ChannelMessagePostedV1): (MessageFanoutCompleted | SessionDeliveryFailed)[]`

Delivers a live message to all sessions subscribed to `event.channelId`.

1. Look up `channelSessions.get(event.channelId)` → `Set<connectionId>` (empty set if channel has no subscribers).
2. For each `connectionId` in the set:
   - Retrieve `{ session, sendFn }` from `sessions`. If absent (race — session closed between index lookup and delivery): skip.
   - Call `session.deliverMessage(event, sendFn)`.
   - If `sendFn` throws: catch the error; push `SessionDeliveryFailed { connectionId, messageId: event.messageId, reason: error.message }` to the result. Continue to next session.
   - If delivery is silent (session `Closed` or not subscribed — handled inside `deliverMessage`): counts as 0 delivered.
3. After all sessions processed: push `MessageFanoutCompleted { channelId: event.channelId, messageId: event.messageId, sessionCount }` where `sessionCount` = number of `sendFn` calls that did **not** throw.
4. Return the accumulated event array (0–N `SessionDeliveryFailed` followed by 1 `MessageFanoutCompleted`).

> `fanout` never throws. All errors are captured as `SessionDeliveryFailed` events.

### `getSessionsForChannel(channelId: string): string[]`

Returns `Array.from(channelSessions.get(channelId) ?? [])` — the list of `connectionId`s currently subscribed to `channelId`. Order is not guaranteed.

Read-only. Does not mutate any state.

---

## Events Emitted

| Event                           | Payload                                                             | Emitted by           |
| ------------------------------- | ------------------------------------------------------------------- | -------------------- |
| `WebSocketSessionOpened`        | `{ connectionId, memberId, openedAt: number }`                      | Delegated — feat-008 |
| `ChannelSubscriptionRegistered` | `{ connectionId, channelId, lastKnownSeq: number }`                 | Delegated — feat-008 |
| `MissedMessagesDelivered`       | `{ connectionId, channelId, fromSeq, toSeq, messageCount: number }` | Delegated — feat-008 |
| `ChannelSubscriptionRemoved`    | `{ connectionId, channelId }`                                       | Delegated — feat-008 |
| `WebSocketSessionClosed`        | `{ connectionId, memberId, closedAt: number }`                      | Delegated — feat-008 |
| `MessageFanoutCompleted`        | `{ channelId, messageId: string, sessionCount: number }`            | Owned — this feature |
| `SessionDeliveryFailed`         | `{ connectionId, messageId: string, reason: string }`               | Owned — this feature |

---

## Invariants

1. `openSession` called with a duplicate `connectionId` throws `DuplicateConnectionError` before any mutation — no partial state is written.
2. `subscribeToChannel`, `unsubscribeFromChannel`, and `closeSession` throw `SessionNotFoundError` when `connectionId` is not in the registry.
3. `closeSession` removes `connectionId` from **every** `channelSessions` set atomically — after `closeSession` returns, no channel index entry references the closed connection.
4. `fanout` never throws — all `sendFn` errors are captured as `SessionDeliveryFailed` events and fanout continues to remaining sessions (best-effort delivery).
5. `MessageFanoutCompleted.sessionCount` equals the number of sessions for which `sendFn` was called **without throwing** — sessions that silently dropped (Closed race) are not counted.
6. `getSessionsForChannel` reflects all in-progress `subscribeToChannel` and `unsubscribeFromChannel` mutations without delay — it is a synchronous in-memory map lookup with no eventual consistency.

---

## Failure Modes

| Trigger                                                                                                                       | Expected behavior                                                                                                                                                              |
| ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `openSession` called with a `connectionId` already in the registry                                                            | `DuplicateConnectionError` thrown; existing session and sendFn are untouched                                                                                                   |
| `subscribeToChannel` / `unsubscribeFromChannel` / `closeSession` with unknown `connectionId`                                  | `SessionNotFoundError` thrown; no state change                                                                                                                                 |
| `subscribeToChannel` with blank `channelId` or negative `lastKnownSeq`                                                        | `InvalidPayloadError` thrown (propagated from `WebSocketSession.subscribeToChannel`); channel index not updated                                                                |
| `subscribeToChannel` for a `channelId` not found in `ChannelRepository`                                                       | `ChannelNotFoundError` thrown (propagated); `connectionId` NOT added to channel index                                                                                          |
| `fanout` for a `channelId` with no entries in `channelSessions`                                                               | `MessageFanoutCompleted { sessionCount: 0 }` emitted; no errors                                                                                                                |
| `fanout` where one `sendFn` throws                                                                                            | `SessionDeliveryFailed` emitted for that connectionId; fanout continues to remaining sessions; final `MessageFanoutCompleted.sessionCount` reflects only successful deliveries |
| `fanout` where the session registry entry is absent at delivery time (race: session closed between index lookup and delivery) | Session silently skipped; not counted in `sessionCount`; no `SessionDeliveryFailed` emitted (not a transport error)                                                            |
| `closeSession` on a `connectionId` not in the registry                                                                        | `SessionNotFoundError` thrown                                                                                                                                                  |

---

## External Contracts

None — this feature is bounded within Messaging. It consumes three internal Messaging primitives:

- `WebSocketSession` aggregate (feat-008) — session lifecycle and message delivery
- `ChannelRepository` (feat-001) — passed through to `subscribeToChannel` for gap detection + catch-up
- `ChannelMessagePostedV1` type (feat-004) — the event struct passed to `fanout`

No cross-context contracts are produced or consumed in SL-001.

---

## Test Strategy

- [ ] **Domain unit (in-memory WebSocketSession instances + sendFn spies):**
  - `openSession` → session in registry; `WebSocketSessionOpened` emitted
  - `openSession` duplicate `connectionId` → `DuplicateConnectionError`; existing session untouched
  - `subscribeToChannel` → delegates to session; adds to channel index; `ChannelSubscriptionRegistered` returned
  - `subscribeToChannel` with gap → catch-up batch delivered via stored `sendFn`; `MissedMessagesDelivered` returned
  - `subscribeToChannel` unknown `connectionId` → `SessionNotFoundError`
  - `unsubscribeFromChannel` → removes from channel index; `ChannelSubscriptionRemoved` returned
  - `unsubscribeFromChannel` on non-subscribed channel → no-op (no event, no error)
  - `closeSession` → removes from registry; clears all channel index entries; `WebSocketSessionClosed` returned
  - `closeSession` unknown `connectionId` → `SessionNotFoundError`
  - `fanout` to 3 subscribed sessions → all 3 `sendFn`s called; `MessageFanoutCompleted { sessionCount: 3 }`
  - `fanout` where one `sendFn` throws → `SessionDeliveryFailed` for that session; other 2 receive; `MessageFanoutCompleted { sessionCount: 2 }`
  - `fanout` for channel with no subscribers → `MessageFanoutCompleted { sessionCount: 0 }`
  - `fanout` for Closed session (race — session terminated between index lookup and delivery) → silent drop; `MessageFanoutCompleted { sessionCount: 0 }`
  - `getSessionsForChannel` returns correct set after subscribe / unsubscribe / closeSession

- [ ] **Integration (FanoutCoordinator + real ChannelRepository + handlePostChannelMessage):**
  - Open session, subscribe with `lastKnownSeq=2` on a 5-message channel → catch-up: `sendFn` called 3× (seq 3, 4, 5); `MissedMessagesDelivered { fromSeq: 2, toSeq: 5, messageCount: 3 }` (closes deferred steps from feat-006, feat-007, and feat-008 uat.md)
  - Two sessions subscribe to same channel; `fanout(event)` → both `sendFn`s called; `MessageFanoutCompleted { sessionCount: 2 }`
  - Session closed; `fanout` → `MessageFanoutCompleted { sessionCount: 0 }` (closed session drops silently)
  - `closeSession` clears all channel index entries: subscribe to 3 channels, close session, `getSessionsForChannel` returns empty for all 3

- [ ] **E2E (UAT — manual check required):** E2E automation deferred: requires a real WebSocket transport layer (HTTP upgrade handler, wire framing) that is not implemented in SL-001. Automation will be added when the transport layer is wired. Until then, perform the following manual check before marking this feature released:
  1. Establish a WebSocket session for a registered channel with member `user-42`
  2. Post 5 messages to the channel
  3. Disconnect and reconnect — supply `lastKnownSeq = 2` in the subscribe payload
  4. Verify that the server delivers exactly messages with seq 3, 4, 5 as a catch-up batch before resuming the live feed
  5. Confirm `MissedMessagesDelivered` is emitted with `fromSeq = 2`, `toSeq = 5`, `messageCount = 3`
  6. Post a new live message — verify it arrives at the reconnected session via fanout
  7. Open a second session for the same channel — verify both sessions receive the next posted message
