# CT-005: PostChannelMessage

**Type:** API
**Provider:** Messaging (colloquium-blog-api)
**Consumer:** Messaging (colloquium-blog frontend)
**Slice:** SL-002

## Endpoint

**Method:** POST
**Path:** `/channels/:channelId/messages`

## Request Schema

```json
{
  "content": "string"
}
```

- `content` — the message body; must be non-empty after trim; must not exceed 4000 characters
- `authorId` is NOT in the request body — the API derives it from the validated Bearer token (JWT `sub` claim)

## Response Schema (success — 201)

```json
{
  "messageId": "string",
  "channelId": "string",
  "authorId": "string",
  "content": "string",
  "sequenceNumber": "number",
  "postedAt": "string"
}
```

- `messageId` — UUID assigned by the server at persistence time
- `channelId` — UUID echoed from the path parameter
- `authorId` — UUID of the posting member, extracted from the JWT
- `content` — echoed from the request body (as stored, after any server-side normalisation)
- `sequenceNumber` — monotonically increasing integer assigned by the Channel aggregate; unique within the channel
- `postedAt` — ISO 8601 UTC timestamp at which the message was persisted

## Error Codes

| Code | Meaning                                                                          |
| ---- | -------------------------------------------------------------------------------- |
| 400  | Malformed request body (not valid JSON or missing `content` field)               |
| 401  | Missing or invalid Bearer token; client must re-authenticate                     |
| 403  | Authenticated user is not a member of the target channel, or channel is archived |
| 404  | Channel does not exist                                                           |
| 422  | `content` fails validation (empty after trim, or exceeds 4000 characters)        |

## Consumer Expectations

- A 201 response body always contains all six fields; none will be null or omitted
- `sequenceNumber` is always greater than any previously observed `sequenceNumber` in the same channel
- The 201 response body's `MessageItem`-compatible fields (`messageId`, `authorId`, `content`, `sequenceNumber`, `postedAt`) are identical in shape to items returned by CT-004 — the consumer can safely append this response to the `ChannelFeedPage` cache without transformation
- Error responses include a JSON body: `{ "error": "string" }`

## Producer Guarantees

- Will always echo `content` exactly as stored; will not silently truncate or mutate content
- Will assign a globally unique `messageId` UUID for every 201 response
- Will assign a strictly increasing `sequenceNumber` per channel
- Is NOT idempotent — submitting the same request twice creates two messages

## Backward Compatibility Rule

Additive changes only (new optional fields in the response body). Removing fields, changing the meaning of `sequenceNumber`, or altering error code semantics require a versioned path (`/v2/channels/:channelId/messages`).

## Contract Test Plan

Integration test verifying that the Messaging API accepts a valid `PostChannelMessageRequest` and returns a `PostChannelMessageResponse` (201) with all required fields, and correctly enforces 401/403/404/422 error codes for invalid inputs.
