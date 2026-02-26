# Feature Spec: get-channel-messages-api-wiring (feat-003)

**Owning BC:** Messaging
**Type:** contract
**Slice:** SL-002

---

## Overview

This feature wires CT-004 (`GetChannelMessages`) into the Hono/OpenAPIHono layer. It is the
**producer side** of the contract: the Hono route handler, JWT authentication adapter,
query-parameter coercion, domain error mapping, and OpenAPI schema registration.

The consumer side (TanStack Query `useInfiniteQuery` hook) is deferred to feat-005
(`channel-feed-page-read-model`) and feat-006 (`infinite-channel-feed-read-model`).

**Implementation note:** The Hono handler and contract tests were written prior to formal
feature speccing (commit `138d53c`). This spec is a retrospective document capturing the
design decisions already present in `apps/colloquium-api/src/app.ts` and `channels.test.ts`.

---

## Adapter Layers

### 1. Auth adapter (JWT → requesterId)

The handler extracts `requesterId` from a Bearer JWT before delegating to the domain:

| Step | Condition                                                | Result                      |
| ---- | -------------------------------------------------------- | --------------------------- |
| 1    | `Authorization` header absent or does not start `Bearer` | 401 returned immediately    |
| 2    | `jwt.verify()` throws (malformed, expired, wrong secret) | 401 returned                |
| 3    | JWT valid but `sub` claim missing                        | 401 returned                |
| 4    | JWT valid and `sub` present                              | `requesterId = decoded.sub` |

`requesterId` is passed to `handleGetChannelMessages` — the domain layer enforces channel
membership checks against the channel's `ChannelFeedView`.

### 2. Query parameter adapter (string → number)

OpenAPI query parameters arrive as strings. The handler coerces them before calling the domain:

- `before` (string | undefined) → `Number(beforeStr)` | undefined
- `limit` (string | undefined) → `Number(limitStr)` | undefined

Validation rules enforced in the domain layer (`handleGetChannelMessages`):

- `limit` must be a valid integer (NaN → `InvalidPayloadError` → 400)
- `limit` must not exceed 50 (> 50 → `InvalidPayloadError` → 400)

### 3. Domain error → HTTP status code mapping

| Domain error               | HTTP status | Response body                         |
| -------------------------- | ----------- | ------------------------------------- |
| `ChannelNotFoundError`     | 404         | `{ error: "Channel not found" }`      |
| `ChannelAccessDeniedError` | 403         | `{ error: "Channel not accessible" }` |
| `InvalidPayloadError`      | 400         | `{ error: e.message }`                |
| Unhandled (re-thrown)      | 500         | Hono default error handler            |

---

## Entities

### Route registration

```
GET /channels/{channelId}/messages
```

Registered via `app.openapi(GetChannelMessagesRoute, handler)` — automatically included in
the OpenAPI spec at `/api/openapi.json` and Swagger UI at `/api/docs`.

**OpenAPI schemas (Zod):**

| Schema                  | Shape                                                           |
| ----------------------- | --------------------------------------------------------------- |
| `MessageItemSchema`     | `{ messageId, authorId, content, sequenceNumber, postedAt }`    |
| `ChannelFeedPageSchema` | `{ messages: MessageItemSchema[], nextCursor: string \| null }` |
| `ErrorSchema`           | `{ error: string }`                                             |

---

## Invariants

- A request without a valid Bearer JWT (missing, malformed, no `sub` claim) **must** receive a
  `401` response before any domain logic is invoked — no channel data is exposed to unauthenticated callers
- `limit` query parameter exceeding 50 **must** be rejected with `400` — the handler may not
  silently clamp the value; the caller receives an error
- `limit` query parameter that is not a valid integer string **must** be rejected with `400`
  (e.g., `?limit=abc`)
- A 200 response **must** contain an `application/json` body conforming exactly to
  `ChannelFeedPageSchema`: `messages` array present (may be empty), `nextCursor` is `string | null`
  (never `undefined`, never an empty string `""`)
- All error responses (401, 403, 404, 400) **must** include a JSON body with an `error` string field
- The `nextCursor` value is the `sequenceNumber` of the **oldest** message in the page as a string;
  when all messages fit in a single page `nextCursor` is `null`

---

## Failure Modes

| Trigger                                                  | Expected behavior                                                           |
| -------------------------------------------------------- | --------------------------------------------------------------------------- |
| `Authorization` header absent                            | 401; `{ error: "Unauthorized" }`; no domain call made                       |
| `Bearer <token>` where token fails `jwt.verify()`        | 401; `{ error: "Unauthorized" }`; no domain call made                       |
| Valid JWT but `sub` claim missing                        | 401; `{ error: "Unauthorized" }`; no domain call made                       |
| `channelId` path param does not match any stored channel | 404; `{ error: "Channel not found" }` (via `ChannelNotFoundError`)          |
| `requesterId` (JWT `sub`) is not a member of the channel | 403; `{ error: "Channel not accessible" }` (via `ChannelAccessDeniedError`) |
| `?limit=999` (exceeds maximum 50)                        | 400; `{ error: "..." }` (via `InvalidPayloadError`)                         |
| `?limit=abc` (non-numeric string)                        | 400; `{ error: "..." }` (via `InvalidPayloadError`)                         |
| `?before=abc` (non-numeric cursor)                       | 400; `{ error: "..." }` (via `InvalidPayloadError`)                         |
| Unhandled exception inside handler                       | Hono re-throws; framework default 500 response                              |

---

## External Contracts

- CT-004: GetChannelMessages (produced — this feature is the provider side)

---

## Test Strategy

- [x] **Contract:** `channels.test.ts` — verifies all CT-004 error codes (401 ×3, 403, 404)
      and the 200 success shape; verifies descending `sequenceNumber` order; verifies `nextCursor`
      null when all messages fit on one page. Three 400 cases: `limit > 50`, `limit=abc`, `before=abc`.
- [x] **Integration:** Two-page cursor pagination — seeds 75 messages; verifies page 1 returns
      50 newest (seq 75→26) with non-null `nextCursor`; verifies page 2 returns remaining 25
      (seq 25→1) with `nextCursor: null`.
- [x] **Domain unit:** N/A — adapter logic is thin; domain invariants are covered by
      `ChannelFeedView.test.ts` and `GetChannelMessagesAcl.test.ts` in SL-001.
- [ ] **E2E:** Deferred to feat-009 (`e2e-channel-feed-playwright`) — full browser path
      (TanStack Query → GET → render) is tested there.

  **E2E automation skipped for feat-003 scope** — this feature is a backend HTTP handler;
  no React component or browser surface exists at this boundary. Manual UAT gate for feat-003:
  1. Start `colloquium-api` on port 5099 with a seeded channel (≥ 51 messages, 1 member).
  2. `GET /channels/{channelId}/messages` with no auth header — assert 401.
  3. `GET /channels/{channelId}/messages` with a valid Bearer JWT (channel member) — assert
     200 with `{ messages: [...], nextCursor: string }` shape; 50 items; `nextCursor` non-null.
  4. `GET /channels/{channelId}/messages?before={nextCursor}` — assert 200; fewer than 50
     items; `nextCursor: null` (beginning of history reached).
  5. `GET /channels/{channelId}/messages?limit=999` — assert 400.

  _(Full browser UAT — TanStack Query pagination, infinite scroll trigger, message list render —
  is in feat-009.)_
