# Feature Spec: channel-message-posted-event-emission (feat-004)

**Owning BC:** Messaging
**Type:** contract (outbound ACL adapter — producer side)
**Contract:** CT-003 — ChannelMessagePosted v1 (produced)
**Slice:** SL-001

---

## Adapter Mapping

This feature has no state machine. It is a stateless orchestration + translation layer — a function that:

1. Receives a `PostChannelMessage` command payload
2. Validates the payload fields before touching the domain
3. Loads the `Channel` aggregate from the repository
4. Calls `postChannelMessage(authorId, content)` on the aggregate
5. Saves the resulting domain events through the repository
6. Translates the emitted `ChannelMessagePosted` domain event to a CT-003 `ChannelMessagePostedV1` payload and returns it

**Delivery mechanism:** In-process function call (SL-001 stub — no message bus wiring).

**Translation rule:**

| Domain event field | Maps to CT-003 field | Disposition                              |
| ------------------ | -------------------- | ---------------------------------------- |
| `channelId`        | `channelId`          | forwarded                                |
| `messageId`        | `messageId`          | forwarded                                |
| `authorId`         | `authorId`           | forwarded                                |
| `content`          | `content`            | forwarded                                |
| `seq`              | `seq`                | forwarded                                |
| `postedAt`         | `postedAt`           | forwarded                                |
| `mentionedIds`     | `mentionedIds`       | forwarded (always `[]` in SL-001)        |

All 7 CT-003 fields are present in the domain event — no field is discarded or invented.

**Implementation shape:**

```typescript
handlePostChannelMessage(
  payload: PostChannelMessagePayload,
  repo: ChannelRepository
): ChannelMessagePostedV1

// throws: InvalidPayloadError | ChannelNotFoundError | ChannelAccessDeniedError | MessageValidationFailedError
```

```typescript
type PostChannelMessagePayload = {
  channelId: string;
  authorId: string;
  content: string;
};

type ChannelMessagePostedV1 = {
  channelId: string;
  messageId: string;
  authorId: string;
  content: string;
  seq: number;
  postedAt: number;
  mentionedIds: string[];
};
```

**Error type note:** `InvalidPayloadError` and `ChannelNotFoundError` already exist in `errors.ts` (created for feat-003). This feature must add `ChannelAccessDeniedError` and `MessageValidationFailedError` to that shared module.

`MessageValidationFailedError` carries the domain reason code:

```typescript
class MessageValidationFailedError extends Error {
  constructor(
    public readonly channelId: string,
    public readonly reason: 'EMPTY_CONTENT' | 'CONTENT_TOO_LONG'
  ) { ... }
}
```

---

## Invariants

- `channelId`, `authorId`, and `content` must be non-null, non-undefined, non-empty strings in the incoming payload — the adapter rejects with `InvalidPayloadError` before loading the domain
- The returned `ChannelMessagePostedV1` must contain all 7 CT-003 fields; none may be null, undefined, or absent
- `seq` in the returned payload is a positive integer, strictly greater than the `seq` of any previously emitted CT-003 event for the same `channelId` (guaranteed by the Channel aggregate's monotonic sequence)
- `mentionedIds` is always `[]` in SL-001 — the adapter must never populate it with non-empty values in this slice
- The adapter must NOT return a CT-003 payload for a `PostChannelMessage` that was rejected by the domain — domain failures must propagate as typed errors
- The adapter must NOT swallow errors thrown by the Channel aggregate or the repository

---

## Failure Modes

| Trigger | Expected behavior |
| ------- | ----------------- |
| `payload.channelId` is null, undefined, or `""` | Adapter throws `InvalidPayloadError` before loading the domain; no Channel touched |
| `payload.authorId` is null, undefined, or `""` | Adapter throws `InvalidPayloadError` before loading the domain; no Channel touched |
| `payload.content` is null, undefined, or `""` | Adapter throws `InvalidPayloadError` before loading the domain; no Channel touched |
| `repo.findById(channelId)` returns null | Adapter throws `ChannelNotFoundError`; no domain event emitted |
| Domain emits `ChannelAccessDenied` (`authorId` not in `allowedPosters`) | Adapter throws `ChannelAccessDeniedError` with `{ channelId, authorId }`; no CT-003 payload returned |
| Domain emits `MessageValidationFailed` with reason `EMPTY_CONTENT` | Adapter throws `MessageValidationFailedError` with `{ channelId, reason: 'EMPTY_CONTENT' }`; no CT-003 payload returned |
| Domain emits `MessageValidationFailed` with reason `CONTENT_TOO_LONG` | Adapter throws `MessageValidationFailedError` with `{ channelId, reason: 'CONTENT_TOO_LONG' }`; no CT-003 payload returned |
| Two calls with identical `(channelId, authorId, content)` | Each call succeeds independently — two distinct CT-003 payloads are returned with distinct `messageId` and strictly increasing `seq` values; content duplication is a user concern, not a domain invariant |

---

## External Contracts

- CT-003: `ChannelMessagePosted` v1 (produced) — defines the outbound payload schema this adapter must emit

---

## Test Strategy

- [ ] **Payload validation (domain unit):**
  - Missing `channelId` → `InvalidPayloadError` thrown before domain call
  - Missing `authorId` → `InvalidPayloadError` thrown before domain call
  - Missing `content` → `InvalidPayloadError` thrown before domain call; note this is a double-guard (the domain also rejects empty content, but the adapter catches it first)
  - Channel not found in repo → `ChannelNotFoundError` thrown; no new Channel created

- [ ] **Domain failure propagation:**
  - `authorId` not in `allowedPosters` → `ChannelAccessDeniedError` thrown; no CT-003 payload returned; confirm repo.save not called after domain rejection
  - Content is `""` submitted after passing payload validation → `MessageValidationFailedError` with reason `EMPTY_CONTENT` (edge case: empty string passes the `""` guard but the domain may still reject it — verify the guard catches it first)
  - Content is `"   "` (whitespace only) → domain emits `MessageValidationFailed(EMPTY_CONTENT)` (since the domain uses `content.trim().length === 0`) — adapter translates to `MessageValidationFailedError`
  - Content is a string of length 4001 → `MessageValidationFailedError` with reason `CONTENT_TOO_LONG`

- [ ] **Contract mapping:**
  - Valid `PostChannelMessage` payload → returned `ChannelMessagePostedV1` contains all 7 CT-003 fields, none null
  - `channelId`, `authorId`, `content` in the returned payload match the input payload exactly
  - `messageId` is a non-empty string (UUID format not enforced in tests, but must be non-empty)
  - `seq` is a positive integer (`seq >= 1`)
  - `postedAt` is a positive integer (Unix ms)
  - `mentionedIds` is `[]` (not null, not undefined, not populated)
  - Two successive calls return CT-003 payloads where `seq₂ > seq₁` (monotonic ordering)

- [ ] **Integration:** Full wiring through `ChannelRepository`
  - After `handlePostChannelMessage`, a subsequent `repo.findById(channelId)` returns a channel whose event log includes `ChannelMessagePosted` with the returned `seq`
  - Two successive calls produce two distinct `messageId` values

- [ ] **E2E:** Not applicable — in-process stub, no HTTP surface in SL-001. Covered transitively when the HTTP `POST /channels/:id/messages` endpoint is wired (future slice).

**UAT step (deferred to HTTP endpoint feature):** When an HTTP POST endpoint is wired, POST a message from an authorised member and verify a CT-003 `ChannelMessagePostedV1` event is returned/emitted with the correct `channelId`, `authorId`, `content`, strictly increasing `seq`, and a non-empty `messageId`.
