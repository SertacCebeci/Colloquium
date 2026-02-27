# Feature Spec: channel-feed-view (feat-005)

**Owning BC:** Messaging
**Type:** read-model (in-process query function)
**Slice:** SL-001

---

## Query Interface

```typescript
queryChannelFeed(
  payload: ChannelFeedPayload,
  repo: ChannelRepository
): ChannelMessagePostedV1[]
```

```typescript
type ChannelFeedPayload = {
  channelId: string;
  limit: number;
  before?: number; // seq cursor — exclusive upper bound; if omitted, returns the latest `limit` messages
};
```

**Return type:** `ChannelMessagePostedV1[]` — same shape as the CT-003 contract (reused for consistency):

```typescript
type ChannelMessagePostedV1 = {
  channelId: string;
  messageId: string;
  authorId: string;
  content: string;
  seq: number;
  postedAt: number;
  mentionedIds: string[]; // always [] in SL-001
};
```

**Read source:** The Channel aggregate's persisted event log, accessed via `repo.findById(channelId)`. `ChannelMessagePosted` domain events are extracted from the hydrated Channel's event history, filtered, and returned in ascending `seq` order.

**Delivery mechanism:** In-process function call (SL-001 stub — no HTTP route wired). HTTP `GET /channels/:id/messages` wired in a future slice.

---

## Pagination Semantics

- **Initial load** (no `before`): return the `limit` messages with the highest `seq` values, ordered by `seq` ascending (oldest first within the page).
- **Scroll-back** (`before` provided): return the `limit` messages with the highest `seq` values strictly below `before`, ordered by `seq` ascending. The client passes the `seq` of the oldest visible message as the `before` cursor.
- **Empty result** (no messages match): return `[]` — not an error.

---

## Invariants

- The returned array is ordered by `seq` ascending — no two items share the same `seq`; no item out of `seq` order
- Every returned item satisfies `seq < before` when `before` is provided
- The returned array contains at most `limit` items
- Every returned item has `channelId` equal to `payload.channelId`
- `mentionedIds` is `[]` on every returned item in SL-001

---

## Failure Modes

| Trigger | Expected behavior |
| ------- | ----------------- |
| `payload.channelId` is null, undefined, or `""` | `InvalidPayloadError` thrown before loading the domain; no Channel touched |
| `payload.limit` is ≤ 0, not an integer, or missing | `InvalidPayloadError` thrown before loading the domain |
| `payload.before` is provided and is ≤ 0 or not an integer | `InvalidPayloadError` thrown before loading the domain |
| `repo.findById(channelId)` returns null | `ChannelNotFoundError` thrown; no result produced |
| Channel exists but has posted zero messages | Returns `[]` — no error |
| Channel exists but no messages satisfy `seq < before` | Returns `[]` — no error (cursor past the beginning of history) |
| `before` is 1 (smallest valid seq) | Returns `[]` — no messages have `seq < 1` |

---

## External Contracts

None — this feature is bounded within Messaging. It reads from the internal Channel event log and returns a view of `ChannelMessagePostedV1` items; it does not produce or consume any cross-context contract.

---

## Test Strategy

- [ ] **Payload validation:**
  - Missing/blank `channelId` → `InvalidPayloadError` thrown; no repo call
  - `limit = 0` → `InvalidPayloadError`
  - `limit = -1` → `InvalidPayloadError`
  - `before = 0` (provided) → `InvalidPayloadError`
  - `before = -5` (provided) → `InvalidPayloadError`
  - Channel not found → `ChannelNotFoundError`

- [ ] **Pagination logic (domain unit, in-memory repo):**
  - Channel with 3 posted messages, `limit = 10`, no `before` → returns all 3 in ascending seq order
  - Channel with 10 posted messages, `limit = 3`, no `before` → returns the 3 highest-seq messages in ascending order (seq 8, 9, 10)
  - Channel with 10 posted messages, `limit = 3`, `before = 8` → returns messages with seq 5, 6, 7
  - Channel with 10 posted messages, `limit = 3`, `before = 3` → returns messages with seq 1, 2 (fewer than limit — not an error)
  - Channel with 0 posted messages → returns `[]`
  - `before = 1` → returns `[]` (no message has seq < 1)
  - `before` beyond the highest seq (e.g., `before = 999` on a 10-message channel) → returns the `limit` most recent messages (no `before` filtering effect)

- [ ] **Field correctness:**
  - Every returned item has `channelId`, `messageId`, `authorId`, `content`, `seq`, `postedAt`, `mentionedIds` — none null or undefined
  - `mentionedIds` is `[]` on every returned item
  - `seq` values in the returned array are strictly increasing

- [ ] **Integration:** Full wiring through `ChannelRepository`
  - Post 5 messages via `handlePostChannelMessage`, then call `queryChannelFeed` with `limit = 3` — returns the 3 most recent messages in ascending seq order
  - Post 5 messages, then call with `limit = 3, before = 4` — returns messages with seq 1, 2, 3

- **E2E:** Not applicable — in-process stub, no HTTP surface in SL-001.

**UAT step (deferred to HTTP endpoint feature):** When the HTTP `GET /channels/:id/messages` endpoint is wired, call it with `?limit=3` after posting 5 messages and verify the response contains the 3 most recent messages in ascending seq order with all 7 `ChannelMessagePostedV1` fields present.
