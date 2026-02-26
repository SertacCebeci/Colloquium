# Feature Spec: post-channel-message-api-wiring (feat-004)

**Owning BC:** Messaging
**Type:** contract
**Slice:** SL-002

---

## Overview

This feature wires CT-005 (`PostChannelMessage`) into the Hono/OpenAPIHono layer. It is the
**producer side** of the contract: the Hono route handler, JWT authentication adapter, request
body Zod schema, domain error → HTTP status code mapping, and OpenAPI schema registration.

The consumer side (MessageComposer `PostMessageAPICallMade` → `MessageAppendedOptimistically`
flow) is wired in feat-007 (`channel-message-form-state`).

**Key domain dependency:** `handlePostChannelMessage` already exists in
`packages/messaging/src/channel/PostChannelMessageAcl.ts`. The handler returns
`ChannelMessagePostedV1` which uses domain-internal field names (`seq`, `postedAt` as Unix ms).
The Hono adapter must remap these to the CT-005 response shape (`sequenceNumber`, `postedAt` as
ISO 8601 string).

---

## Adapter Layers

### 1. Auth adapter (JWT → requesterId / authorId)

Identical pattern to CT-004 (feat-003):

| Step | Condition                                                | Result                   |
| ---- | -------------------------------------------------------- | ------------------------ |
| 1    | `Authorization` header absent or does not start `Bearer` | 401 returned immediately |
| 2    | `jwt.verify()` throws (malformed, expired, wrong secret) | 401 returned             |
| 3    | JWT valid but `sub` claim missing                        | 401 returned             |
| 4    | JWT valid and `sub` present                              | `authorId = decoded.sub` |

`authorId` is passed to `handlePostChannelMessage` — it is NOT taken from the request body
(CT-005 explicitly forbids this).

### 2. Request body adapter

The OpenAPIHono Zod schema enforces structural validity:

- `content: z.string()` — required; missing or non-string → 400 (Zod validation error, before
  handler runs)

Content-level validation (empty after trim, >4000 chars) is **not** enforced at the Zod layer —
it is delegated to the domain via `handlePostChannelMessage`, which throws
`MessageValidationFailedError` → mapped to 422 by the handler.

### 3. Response shape adapter (domain → CT-005)

`handlePostChannelMessage` returns `ChannelMessagePostedV1`:

| Domain field | CT-005 field     | Transform                                 |
| ------------ | ---------------- | ----------------------------------------- |
| `channelId`  | `channelId`      | identity                                  |
| `messageId`  | `messageId`      | identity                                  |
| `authorId`   | `authorId`       | identity                                  |
| `content`    | `content`        | identity                                  |
| `seq`        | `sequenceNumber` | rename                                    |
| `postedAt`   | `postedAt`       | `new Date(result.postedAt).toISOString()` |

### 4. Domain error → HTTP status code mapping

| Domain error                                     | HTTP status | Response body                                                  |
| ------------------------------------------------ | ----------- | -------------------------------------------------------------- |
| `InvalidPayloadError`                            | 400         | `{ error: e.message }` (missing/null content field)            |
| `ChannelNotFoundError`                           | 404         | `{ error: "Channel not found" }`                               |
| `ChannelAccessDeniedError`                       | 403         | `{ error: "Channel not accessible" }`                          |
| `MessageValidationFailedError(EMPTY_CONTENT)`    | 422         | `{ error: "Message content must not be empty" }`               |
| `MessageValidationFailedError(CONTENT_TOO_LONG)` | 422         | `{ error: "Message content must not exceed 4000 characters" }` |
| Unhandled (re-thrown)                            | 500         | Hono default error handler                                     |

---

## Entities

### Route registration

```
POST /channels/{channelId}/messages
```

Registered via `app.openapi(PostChannelMessageRoute, handler)` — included in the OpenAPI spec
at `/api/openapi.json` and Swagger UI at `/api/docs`.

**OpenAPI schemas (Zod):**

| Schema                             | Shape                                                                   |
| ---------------------------------- | ----------------------------------------------------------------------- |
| `PostChannelMessageBodySchema`     | `{ content: z.string() }`                                               |
| `PostChannelMessageResponseSchema` | `{ messageId, channelId, authorId, content, sequenceNumber, postedAt }` |
| `ErrorSchema`                      | `{ error: string }` (reused from CT-004)                                |

---

## Invariants

- A request without a valid Bearer JWT (missing, malformed, no `sub` claim) **must** receive a
  `401` response; no domain logic is invoked and no message is persisted
- The `authorId` in the 201 response **must** equal the `sub` claim of the Bearer JWT — the
  client never supplies `authorId` in the request body
- A `content` field that is whitespace-only (e.g., `"   "`) after trim **must** be rejected
  with `422` — the handler may not silently strip content or return 200
- A `content` field exceeding 4000 characters **must** be rejected with `422`
- A 201 response **must** contain all six fields from `PostChannelMessageResponseSchema`;
  none may be null or omitted
- `sequenceNumber` in the 201 response **must** be strictly greater than any previously
  observed `sequenceNumber` in the same channel
- The `postedAt` field in the 201 response **must** be a valid ISO 8601 UTC timestamp string
  (converted from the domain's Unix ms `postedAt`)
- The handler must call `repo.save()` if and only if `handlePostChannelMessage` returns a
  `ChannelMessagePostedV1` — no partial saves on error paths

---

## Failure Modes

| Trigger                                                  | Expected behavior                                                                      |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `Authorization` header absent                            | 401; `{ error: "Unauthorized" }`; no domain call                                       |
| `Bearer <token>` where token fails `jwt.verify()`        | 401; `{ error: "Unauthorized" }`; no domain call                                       |
| Valid JWT but `sub` claim missing                        | 401; `{ error: "Unauthorized" }`; no domain call                                       |
| Request body is not valid JSON                           | 400 (Hono/Zod layer); `{ error: "..." }` before handler runs                           |
| Request body is `{}` (missing `content` field)           | 400 (Hono/Zod layer); `{ error: "..." }` before handler runs                           |
| `content: ""` (empty string)                             | 400 — caught by `handlePostChannelMessage` null guard (`!payload.content`)             |
| `content: "   "` (whitespace only)                       | 422; `{ error: "Message content must not be empty" }` (domain: EMPTY_CONTENT)          |
| `content` exceeds 4000 characters                        | 422; `{ error: "Message content must not exceed 4000 characters" }` (CONTENT_TOO_LONG) |
| `channelId` path param does not match any stored channel | 404; `{ error: "Channel not found" }`                                                  |
| JWT `sub` is not a member of the channel                 | 403; `{ error: "Channel not accessible" }`                                             |
| Unhandled exception inside handler                       | 500; Hono default error response                                                       |

---

## External Contracts

- CT-005: PostChannelMessage (produced — this feature is the provider side)

---

## Test Strategy

- [x] **Contract:** `channels.test.ts` — verifies all CT-005 error codes (401 ×3, 400 missing
      body, 403, 404, 422 empty content, 422 too long) and the 201 success shape; verifies all six
      response fields are present; verifies `sequenceNumber` is a positive integer; verifies
      `postedAt` is a valid ISO 8601 string. 13 new tests added (26 total in file).
- [x] **Integration:** POST + GET round-trip — seeds 3 messages, POSTs a 4th, asserts
      `sequenceNumber = 4` and the new message appears at position 0 in the feed.
- [x] **Domain unit:** N/A — adapter logic is thin; domain invariants are covered by
      `PostChannelMessageAcl.test.ts` and `Channel.test.ts` in SL-001.
- [ ] **E2E:** Deferred to feat-009 (`e2e-channel-feed-playwright`).

  **E2E automation skipped for feat-004 scope** — this feature is a backend HTTP handler;
  no React component or browser surface exists at this boundary. Manual UAT gate for feat-004:
  1. Start `colloquium-api` on port 5099 via `src/uat-seed-server.ts` (75 messages seeded).
  2. `POST /channels/ch-uat-001/messages` with no Authorization header — assert 401.
  3. `POST /channels/ch-uat-001/messages` with valid Bearer JWT and `{ content: "UAT post" }`
     — assert 201; all six fields present; `sequenceNumber = 76`; `postedAt` is ISO 8601 string.
  4. `GET /channels/ch-uat-001/messages` — assert the new message appears at position 0
     (newest-first), `content = "UAT post"`, `sequenceNumber = 76`.
  5. `POST /channels/ch-uat-001/messages` with `{ content: "   " }` — assert 422.

  _(Full browser UAT — MessageComposer form submit, optimistic append, error states —
  is in feat-009.)_
