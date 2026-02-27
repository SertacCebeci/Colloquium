# Feature Spec: channel-sequence-head (feat-006)

**Owning BC:** Messaging
**Type:** read-model (in-process query function)
**Slice:** SL-001

---

## Query Interface

```typescript
queryChannelSequenceHead(
  payload: ChannelSequenceHeadPayload,
  repo: ChannelRepository
): number
```

```typescript
type ChannelSequenceHeadPayload = {
  channelId: string;
};
```

**Return type:** `number` — the highest `seq` among all `ChannelMessagePosted` events recorded on the channel. Returns `0` when the channel exists but has no posted messages (seq numbering starts at 1, so `0` is an unambiguous sentinel meaning "no messages").

**Read source:** The Channel aggregate's persisted event log, accessed via `ChannelRepository`. `ChannelMessagePosted` domain events are extracted and the maximum `seq` value is returned.

**Delivery mechanism:** In-process function call (SL-001 stub — no HTTP route). HTTP surface is deferred to a future slice; this primitive is consumed internally by `WebSocketSession` (feat-008) and `MessagesSinceSeq` (feat-007).

---

## Semantics

- **Channel with messages:** returns the `seq` of the most recently posted message.
- **Channel with no messages:** returns `0`. This is the natural lower bound — `lastKnownSeq = 0` and `ChannelSequenceHead = 0` means no gap, so no catch-up batch is triggered.
- **No two calls on the same channel with messages may return a value less than any previously returned value** — the seq is monotonically increasing; this read model reflects the latest snapshot at call time.

---

## Invariants

- The returned value is always `≥ 0`
- If the channel has at least one posted message, the returned value equals the `seq` field of the last `ChannelMessagePosted` event on that channel
- The returned value is `0` if and only if the channel has zero posted messages
- Two successive calls on a channel that receives a new message between them must return a strictly higher value on the second call

---

## Failure Modes

| Trigger | Expected behavior |
| ------- | ----------------- |
| `payload.channelId` is null, undefined, or `""` | `InvalidPayloadError` thrown before accessing the repo; no Channel touched |
| `repo.findById(channelId)` returns null (channel not registered) | `ChannelNotFoundError` thrown; no result produced |
| Channel exists but has zero posted messages | Returns `0` — not an error |

---

## External Contracts

None — this feature is bounded within Messaging. It reads from the internal Channel event log and returns a scalar; it does not produce or consume any cross-context contract.

---

## Test Strategy

- [ ] **Payload validation:**
  - Missing/blank `channelId` → `InvalidPayloadError` thrown; no repo call made
  - Channel not found → `ChannelNotFoundError` thrown

- [ ] **Domain unit (in-memory repo):**
  - Channel with 0 posted messages → returns `0`
  - Channel with 1 posted message → returns `1`
  - Channel with 5 posted messages → returns `5`
  - Post 3 messages, query → returns `3`; post 2 more, query again → returns `5` (head updates monotonically)

- [ ] **Integration:** Full wiring through `ChannelRepository`
  - Post 4 messages via `handlePostChannelMessage`, then call `queryChannelSequenceHead` → returns `4`
  - Post 0 messages (channel registered, no posts) → returns `0`

- **E2E:** Not applicable — in-process stub, no HTTP surface in SL-001.
