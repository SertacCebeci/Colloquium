# Feature Spec: messages-since-seq (feat-007)

**Owning BC:** Messaging
**Type:** read-model (in-process query function)
**Slice:** SL-001

---

## Query Interface

```typescript
queryMessagesSinceSeq(
  payload: MessagesSinceSeqPayload,
  repo: ChannelRepository
): ChannelMessagePostedV1[]
```

```typescript
type MessagesSinceSeqPayload = {
  channelId: string;
  fromSeq: number;
};

// ChannelMessagePostedV1 is reused as the view type across all read-model query
// functions in this BC (queryChannelFeed, queryChannelSequenceHead). A dedicated
// ChannelMessageView (without the `type` discriminant) was considered but rejected
// as redundant — see uat.md Known Issues for rationale.
type ChannelMessagePostedV1 = {
  type: "ChannelMessagePosted";
  channelId: string;
  messageId: string;
  authorId: string;
  content: string;
  seq: number;
  postedAt: number;
  mentionedIds: string[];
};
```

**Return type:** `ChannelMessagePostedV1[]` — all `ChannelMessagePosted` events on the channel whose `seq > fromSeq`, in strictly ascending seq order. Returns `[]` when no messages satisfy the condition.

**Read source:** The Channel aggregate's persisted event log, accessed via `ChannelRepository`. `ChannelMessagePosted` domain events are extracted, filtered to `seq > fromSeq`, and returned in ascending seq order.

**Delivery mechanism:** In-process function call (SL-001 stub — no HTTP route). Consumed internally by `WebSocketSession.SubscribeToChannel` during catch-up delivery: when `lastKnownSeq < ChannelSequenceHead`, this function provides the catch-up batch.

---

## Semantics

- **`fromSeq = 0`:** returns all messages on the channel (`seq > 0` is always true since seq starts at 1).
- **`fromSeq = N` (N > 0):** returns only messages whose seq is strictly greater than N.
- **Channel with no messages:** returns `[]` — not an error.
- **All messages have seq ≤ fromSeq:** returns `[]` — not an error; the client is fully caught up.
- **Returned messages are always in strictly ascending seq order** — the catch-up consumer can push them to the client in order without re-sorting.

---

## Invariants

- Every returned item has `seq > payload.fromSeq` (strictly greater — `fromSeq` itself is excluded)
- Returned items are in strictly ascending seq order (no ties, no gaps in the returned slice)
- Every returned item contains all 7 canonical fields: `channelId`, `messageId`, `authorId`, `content`, `seq`, `postedAt`, `mentionedIds`
- `mentionedIds` is always `[]` in SL-001 (mention detection is out of scope)
- The function does not mutate the Channel aggregate or produce any side effect on the repository

---

## Failure Modes

| Trigger                                              | Expected behavior                                                            |
| ---------------------------------------------------- | ---------------------------------------------------------------------------- |
| `payload.channelId` is null, undefined, or `""`      | `InvalidPayloadError` thrown before repo access; no Channel is loaded        |
| `payload.channelId` is whitespace only               | `InvalidPayloadError` thrown before repo access                              |
| `payload.fromSeq` is negative                        | `InvalidPayloadError` thrown before repo access; negative seq has no meaning |
| `payload.fromSeq` is missing (undefined/null)        | `InvalidPayloadError` thrown before repo access                              |
| `repo.findById(channelId)` returns null              | `ChannelNotFoundError` thrown; no result produced                            |
| Channel exists but all messages have `seq ≤ fromSeq` | Returns `[]` — client is fully caught up; not an error                       |
| Channel exists with no posted messages               | Returns `[]` — not an error                                                  |

---

## External Contracts

None — this feature is bounded within Messaging. It reads from the internal Channel event log and returns a view slice; it does not produce or consume any cross-context contract.

---

## Test Strategy

- [ ] **Payload validation:**
  - Missing/blank `channelId` → `InvalidPayloadError` thrown; no repo call
  - Whitespace-only `channelId` → `InvalidPayloadError` thrown
  - Negative `fromSeq` → `InvalidPayloadError` thrown
  - Missing `fromSeq` (undefined) → `InvalidPayloadError` thrown
  - Channel not found → `ChannelNotFoundError` thrown

- [ ] **Domain unit (in-memory repo):**
  - `fromSeq = 0`, channel with 3 messages → returns all 3 in ascending seq order
  - `fromSeq = 2`, channel with 5 messages → returns messages with seq 3, 4, 5
  - `fromSeq = 5`, channel with 5 messages → returns `[]`
  - `fromSeq = 0`, channel with no messages → returns `[]`
  - All 7 fields present on every returned item; `mentionedIds = []`
  - Items are in strictly ascending seq order (verified by comparing consecutive items)

- [ ] **No-repo-side-effect:** call `queryMessagesSinceSeq`, then verify that `repo.findById(channelId)` returns the same channel state — no mutations

- [ ] **Integration:** Full wiring through `ChannelRepository` + `handlePostChannelMessage`
  - Post 6 messages via `handlePostChannelMessage`, call with `fromSeq = 3` → returns messages with seq 4, 5, 6
  - Post 3 messages, call with `fromSeq = 0` → returns all 3 in ascending order

- **E2E:** Not applicable — in-process stub, no HTTP surface in SL-001.

  **Deferred UAT step (to be executed at feat-008 C7):**
  1. Establish a WebSocket session for a registered channel with member `user-42`
  2. Post 5 messages to the channel
  3. Disconnect and reconnect — supply `lastKnownSeq = 2` in the subscribe payload
  4. Verify that the server delivers exactly messages with seq 3, 4, 5 as a catch-up batch before resuming the live feed
  5. Confirm `MissedMessagesDelivered` is emitted with `fromSeq = 2`, `toSeq = 5`, `messageCount = 3`

  This step constitutes the end-to-end verification of `queryMessagesSinceSeq` as consumed by `WebSocketSession.SubscribeToChannel`.
