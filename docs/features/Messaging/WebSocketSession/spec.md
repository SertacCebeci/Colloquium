# Feature Spec: websocket-session-aggregate (feat-008)

**Owning BC:** Messaging
**Type:** aggregate (infrastructure aggregate — never persisted)
**Slice:** SL-001

---

## Architecture Decisions

**Single-per-connection:** `WebSocketSession` is one aggregate instance per `connectionId`. A `SessionRegistry` (`Map<connectionId, WebSocketSession>`) lives in the adapter layer and is managed by the `FanoutCoordinator` (feat-009).

**Injected `sendFn`:** Commands that push messages to the client accept `sendFn: (msg: unknown) => void`. The real transport wires a WebSocket `.send()` call; tests pass a spy. No formal `IWebSocketTransport` port is required.

**External `FanoutCoordinator`:** Lives in feat-009. It holds the registry and the channel→sessions mapping. When a live `ChannelMessagePosted` event arrives it calls `session.deliverMessage(event, sendFn)` for each session subscribed to that channel.

**feat-008 scope:** `WebSocketSession` aggregate — state machine, catch-up delivery inside `subscribeToChannel`, and `deliverMessage` for live fanout. Registry and fanout coordination are feat-009.

---

## Entities

### WebSocketSession (infrastructure aggregate)

> Tracks a single client connection's lifecycle and channel subscriptions. In-memory only — never serialised or persisted.

| State    | Description                                                     |
| -------- | --------------------------------------------------------------- |
| `Open`   | Active connection; eligible to receive messages                 |
| `Closed` | Connection terminated; silently drops all incoming fanout calls |

**Transitions:**

| From   | Command                                            | To       |
| ------ | -------------------------------------------------- | -------- |
| (new)  | `RegisterWebSocketSession(memberId, connectionId)` | `Open`   |
| `Open` | `SubscribeToChannel(channelId, lastKnownSeq, ...)` | `Open`   |
| `Open` | `UnsubscribeFromChannel(channelId)`                | `Open`   |
| `Open` | `TerminateWebSocketSession()`                      | `Closed` |

---

## Commands

### `registerSession(memberId: string): WebSocketSessionOpened[]`

Constructs the aggregate in `Open` state.

- Emits `WebSocketSessionOpened { connectionId, memberId, openedAt }`.

### `subscribeToChannel(channelId: string, lastKnownSeq: number, repo: ChannelRepository, sendFn: (msg: unknown) => void): (ChannelSubscriptionRegistered | MissedMessagesDelivered)[]`

Adds `channelId` to `subscribedChannels`. When a gap exists (`lastKnownSeq < queryChannelSequenceHead(channelId, repo)`):

1. Call `queryMessagesSinceSeq({ channelId, fromSeq: lastKnownSeq }, repo)` to get the catch-up batch.
2. Call `sendFn(msg)` for each message in strictly ascending seq order.
3. Emit `MissedMessagesDelivered { connectionId, channelId, fromSeq: lastKnownSeq, toSeq: head, messageCount }`.

Always emits `ChannelSubscriptionRegistered { connectionId, channelId, lastKnownSeq }`.

When re-subscribing to an already-subscribed channel (idempotency): re-evaluate the gap and deliver a new catch-up batch if `lastKnownSeq` is behind the current head.

### `unsubscribeFromChannel(channelId: string): ChannelSubscriptionRemoved[]`

Removes `channelId` from `subscribedChannels`. Emits `ChannelSubscriptionRemoved { connectionId, channelId }`. No-op (no event) if the channel was not in `subscribedChannels`.

### `terminateSession(): WebSocketSessionClosed[]`

Transitions to `Closed`. Clears `subscribedChannels`. Emits `WebSocketSessionClosed { connectionId, memberId, closedAt }`.

### `deliverMessage(event: ChannelMessagePostedV1, sendFn: (msg: unknown) => void): void`

Called by `FanoutCoordinator` (feat-009) to push a live message.

- If session is `Closed`: silently return without calling `sendFn`. No event emitted.
- If session is `Open` but `event.channelId ∉ subscribedChannels`: silently return without calling `sendFn`.
- If session is `Open` and subscribed: call `sendFn(event)`.

> `deliverMessage` does not return domain events — it is a side-effecting delivery call, not a command that modifies session state. Events for delivery outcomes (`MessageFanoutCompleted`, `SessionDeliveryFailed`) are owned by `FanoutCoordinator` (feat-009).

---

## Events Emitted

| Event                           | Payload                                                                             |
| ------------------------------- | ----------------------------------------------------------------------------------- |
| `WebSocketSessionOpened`        | `{ connectionId, memberId, openedAt: number }`                                      |
| `ChannelSubscriptionRegistered` | `{ connectionId, channelId, lastKnownSeq: number }`                                 |
| `MissedMessagesDelivered`       | `{ connectionId, channelId, fromSeq: number, toSeq: number, messageCount: number }` |
| `ChannelSubscriptionRemoved`    | `{ connectionId, channelId }`                                                       |
| `WebSocketSessionClosed`        | `{ connectionId, memberId, closedAt: number }`                                      |

---

## Invariants

1. `deliverMessage` called on a `Closed` session never invokes `sendFn` — the drop is silent (no error thrown, no event emitted by the session)
2. `deliverMessage` called on an `Open` session not subscribed to `event.channelId` never invokes `sendFn`
3. During `subscribeToChannel`, `sendFn` is called for catch-up messages in **strictly ascending seq order** before `MissedMessagesDelivered` is emitted
4. `MissedMessagesDelivered` is emitted **only when a gap exists** (`lastKnownSeq < ChannelSequenceHead`); if the client is fully caught up, no catch-up event or sendFn calls are made
5. `subscribeToChannel` is idempotent: re-subscribing re-evaluates `lastKnownSeq` against the current head and delivers a fresh catch-up batch if a new gap has opened since the last subscription
6. `subscribedChannels` is always empty after `terminateSession` (cleared atomically with transition to `Closed`)

---

## Failure Modes

| Trigger                                                                                       | Expected behavior                                                            |
| --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `subscribeToChannel` called with blank/null `channelId`                                       | `InvalidPayloadError` thrown; no repo call, no sendFn call, no state change  |
| `subscribeToChannel` called with `lastKnownSeq < 0`                                           | `InvalidPayloadError` thrown; no repo call, no state change                  |
| `subscribeToChannel` — `repo.findById(channelId)` returns null (channel unknown to Messaging) | `ChannelNotFoundError` thrown; `channelId` NOT added to `subscribedChannels` |
| `unsubscribeFromChannel` called for a channel not in `subscribedChannels`                     | No-op — no event emitted, no error thrown                                    |
| `terminateSession` called on an already-`Closed` session                                      | No-op — no event emitted, no error thrown (idempotent)                       |
| `deliverMessage` called on a `Closed` session                                                 | Silent drop — no `sendFn` call, no error                                     |
| `deliverMessage` called for a channel not in `subscribedChannels`                             | Silent drop — no `sendFn` call, no error                                     |

---

## External Contracts

None — this feature is bounded within Messaging. It consumes three internal Messaging primitives:

- `Channel` aggregate (feat-001) via `ChannelRepository.findById`
- `queryChannelSequenceHead` (feat-006) — gap-detection gate in `subscribeToChannel`
- `queryMessagesSinceSeq` (feat-007) — catch-up batch fetch in `subscribeToChannel`

No cross-context contracts are produced or consumed in SL-001.

---

## Test Strategy

- [ ] **Payload validation:**
  - Blank `channelId` in `subscribeToChannel` → `InvalidPayloadError`; no repo call
  - Negative `lastKnownSeq` → `InvalidPayloadError`; no repo call
  - Channel not found → `ChannelNotFoundError`; channel NOT added to subscriptions

- [ ] **Domain unit (in-memory repo + sendFn spy):**
  - `registerSession` → session is `Open`; emits `WebSocketSessionOpened`
  - `subscribeToChannel` when fully caught up (`lastKnownSeq === head`) → emits `ChannelSubscriptionRegistered`; sendFn NOT called; `MissedMessagesDelivered` NOT emitted
  - `subscribeToChannel` with gap (`lastKnownSeq < head`) → sendFn called for each missed message in ascending seq order; `MissedMessagesDelivered` emitted with correct `fromSeq`, `toSeq`, `messageCount`
  - `subscribeToChannel` idempotency: re-subscribe with same `lastKnownSeq` while head has advanced → new catch-up batch delivered
  - `unsubscribeFromChannel` removes channel from subscriptions; emits `ChannelSubscriptionRemoved`
  - `unsubscribeFromChannel` on non-subscribed channel → no-op; no event
  - `terminateSession` → transitions to `Closed`; clears `subscribedChannels`; emits `WebSocketSessionClosed`
  - `terminateSession` on already-`Closed` session → no-op
  - `deliverMessage` on `Open` subscribed session → sendFn called with event
  - `deliverMessage` on `Closed` session → sendFn NOT called
  - `deliverMessage` on `Open` session not subscribed to channel → sendFn NOT called

- [ ] **Integration (full wiring through `ChannelRepository` + real post/query chain):**
  - Post 5 messages via `handlePostChannelMessage`; create session; `subscribeToChannel` with `lastKnownSeq = 2` → sendFn called 3 times with seq 3, 4, 5 in order; `MissedMessagesDelivered { fromSeq: 2, toSeq: 5, messageCount: 3 }` emitted
  - Post 3 messages; `subscribeToChannel` with `lastKnownSeq = 0` → sendFn called 3 times; `MissedMessagesDelivered { fromSeq: 0, toSeq: 3, messageCount: 3 }` emitted
  - `subscribeToChannel` with `lastKnownSeq = head` → sendFn NOT called; `MissedMessagesDelivered` NOT emitted

- [ ] **E2E:** Not applicable — in-process stub, no real WebSocket transport in SL-001.

  **Deferred UAT step (to be executed at feat-009 C7, closing feat-006 + feat-007 deferred steps):**
  1. Establish a WebSocket session for a registered channel with member `user-42`
  2. Post 5 messages to the channel
  3. Disconnect and reconnect — supply `lastKnownSeq = 2` in the subscribe payload
  4. Verify that the server delivers exactly messages with seq 3, 4, 5 as a catch-up batch before resuming the live feed
  5. Confirm `MissedMessagesDelivered` is emitted with `fromSeq = 2`, `toSeq = 5`, `messageCount = 3`
  6. Post a new live message — verify it arrives at the reconnected session via fanout
