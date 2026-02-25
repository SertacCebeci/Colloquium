# CT-004: GetChannelMessages

**Type:** API
**Provider:** Messaging (colloquium-blog-api)
**Consumer:** Messaging (colloquium-blog frontend)
**Slice:** SL-002

## Endpoint

**Method:** GET
**Path:** `/channels/:channelId/messages`

## Request Schema

Query parameters:

```json
{
  "before": "string | undefined",
  "limit": "number | undefined"
}
```

- `before` — the `sequenceNumber` (as a string) of the oldest message from the previous page; omit for the initial load (most recent messages)
- `limit` — number of messages to return; defaults to `50`; max `50`

No request body.

## Response Schema (success — 200)

```json
{
  "messages": [
    {
      "messageId": "string",
      "authorId": "string",
      "content": "string",
      "sequenceNumber": "number",
      "postedAt": "string"
    }
  ],
  "nextCursor": "string | null"
}
```

- `messages` — ordered newest-first by `sequenceNumber` within the page; length 0–50 inclusive
- `nextCursor` — the `sequenceNumber` of the oldest message in this page, as a string; `null` when no older messages exist (beginning of history reached)
- `messageId` — UUID (string)
- `authorId` — UUID of the posting member (string)
- `postedAt` — ISO 8601 UTC timestamp string

## Error Codes

| Code | Meaning                                                      |
| ---- | ------------------------------------------------------------ |
| 401  | Missing or invalid Bearer token; client must re-authenticate |
| 403  | Authenticated user is not a member of the requested channel  |
| 404  | Channel does not exist                                       |

## Consumer Expectations

- `messages` array is always present (may be empty `[]` if the channel has no messages)
- `nextCursor` is either a non-empty string or exactly `null` — never `undefined` or an empty string
- All `sequenceNumber` values within a page are strictly decreasing (newest first)
- `postedAt` is always a valid ISO 8601 UTC string (parseable by `new Date()`)

## Producer Guarantees

- Will always return all required fields; no field will be omitted from a message item
- Will never return more than `limit` messages per response
- Will preserve the `sequenceNumber` ordering invariant across pages: the oldest message in page N has a lower `sequenceNumber` than the newest message in page N+1 (the page fetched with that cursor)
- Error responses include a JSON body: `{ "error": "string" }`

## Backward Compatibility Rule

Additive changes only (new optional fields on `MessageItem`, new optional query parameters). Breaking changes — removing fields, changing `nextCursor` semantics, altering sort order — require a versioned path (`/v2/channels/:channelId/messages`).

## Contract Test Plan

Integration test verifying that the Messaging API returns a valid `ChannelFeedPage` response for both the initial load (no cursor) and paginated load (with `before` cursor), and correctly enforces 401/403/404 error codes.
