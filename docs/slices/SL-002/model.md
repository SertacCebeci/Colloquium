# Model — SL-002

## Aggregate: ChannelFeed (Messaging)

### States

| State         | Description                                                            |
| ------------- | ---------------------------------------------------------------------- |
| `Idle`        | Initial state — no data loaded, no fetch in flight                     |
| `Loading`     | Initial page fetch in progress (GET /channels/:id/messages, no cursor) |
| `Loaded`      | At least one page of messages available; infinite scroll is active     |
| `LoadingMore` | An older page fetch is in progress (GET with before=cursor)            |
| `Error`       | Most recent GET returned a non-2xx response; error banner is visible   |

### Transitions

| From          | Command / Event                              | To            |
| ------------- | -------------------------------------------- | ------------- |
| `Idle`        | `FetchChannelFeed(channelId)`                | `Loading`     |
| `Loading`     | ← `ChannelFeedServed`                        | `Loaded`      |
| `Loading`     | ← `APIErrorOccurred`                         | `Error`       |
| `Loaded`      | `FetchChannelFeed(channelId, before=cursor)` | `LoadingMore` |
| `LoadingMore` | ← `OlderMessagesFetched`                     | `Loaded`      |
| `LoadingMore` | ← `APIErrorOccurred`                         | `Error`       |
| `Error`       | `FetchChannelFeed(channelId)` (retry)        | `Loading`     |

### Invariants

- A `Loaded` feed must have `pages.length ≥ 1`
- A `LoadingMore` state requires the last page's `nextCursor` to be non-null
- Each page contains between 0 and 50 messages (inclusive)
- An `Error` state must have a non-null, non-empty `errorMessage` string
- Messages within a page are ordered by `sequenceNumber` descending in the API response (newest first)

### Commands

- `FetchChannelFeed(channelId: string, before?: string)` — issues GET /channels/:channelId/messages?limit=50[&before=cursor]; transitions Idle→Loading or Loaded→LoadingMore
- `RetryFeed(channelId: string)` — alias for FetchChannelFeed without cursor; transitions Error→Loading

### Events Emitted

- `ChannelFeedRequested` — `{ channelId, cursor: null }`
- `ChannelFeedServed` — `{ channelId, messages: MessageItem[], nextCursor: string | null }`
- `OlderMessagesRequested` — `{ channelId, cursor: string }`
- `OlderMessagesFetched` — `{ channelId, messages: MessageItem[], nextCursor: string | null }`
- `APIErrorOccurred` — `{ source: 'feed-fetch' | 'message-post', statusCode: number, message: string }`

---

## Aggregate: MessageComposer (Messaging)

### States

| State        | Description                                                                       |
| ------------ | --------------------------------------------------------------------------------- |
| `Idle`       | Input is empty; no submission in flight                                           |
| `Typing`     | User has entered text; input is non-empty                                         |
| `Submitting` | POST /channels/:channelId/messages is in flight; input is locked                  |
| `Error`      | POST returned a non-2xx response; error message is shown; input is editable again |

### Transitions

| From              | Command / Event                                            | To                                    |
| ----------------- | ---------------------------------------------------------- | ------------------------------------- |
| `Idle`            | `ValidateMessage("")` (empty)                              | `Idle` (validationError shown inline) |
| `Idle` / `Typing` | user types content                                         | `Typing`                              |
| `Typing`          | `ValidateMessage(content)` — content empty or > 4000 chars | `Typing` (validationError shown)      |
| `Typing`          | `SubmitMessage(content)` — valid content                   | `Submitting`                          |
| `Submitting`      | ← `ChannelMessagePosted` (201)                             | `Idle`                                |
| `Submitting`      | ← `APIErrorOccurred`                                       | `Error`                               |
| `Error`           | `SubmitMessage(content)`                                   | `Submitting`                          |

### Invariants

- A `Submitting` state requires `inputValue.trim().length > 0`
- The transition `Submitting → Idle` (success path) must set `inputValue = ""` and `isSubmitting = false`
- An `Error` state must carry a non-null, non-empty error message (either a validation error or an API error string)
- `inputValue` must not exceed 4000 characters; exceeding this threshold prevents entering `Submitting`

### Commands

- `ValidateMessage(content: string)` — client-side guard; rejects empty or oversized content; does not change aggregate state but sets `validationError`
- `SubmitMessage(content: string)` — requires `content.trim().length > 0` and `content.length ≤ 4000`; transitions `Typing → Submitting`
- `ClearInput()` — resets `inputValue` to `""`; called automatically on `Submitting → Idle` success

### Events Emitted

- `EmptyMessageRejected` — `{ reason: 'empty' | 'too-long', inputValue: string }`
- `PostMessageAPICallMade` — `{ channelId: string, content: string }`
- `MessageAppendedOptimistically` — `{ message: MessageItem }` (from 201 response body)
- `MessageInputCleared` — `{}`
- `APIErrorOccurred` — `{ source: 'message-post', statusCode: number, message: string }`

---

## Cross-Context Integrations

### ChannelFeedPage (v1)

**Schema:**

```ts
{
  messages: Array<{
    messageId: string; // UUID
    authorId: string; // UUID of the posting member
    content: string; // message body text
    sequenceNumber: number; // monotonically increasing, server-assigned
    postedAt: string; // ISO 8601 UTC timestamp
  }>;
  nextCursor: string | null; // sequenceNumber of the oldest message in this page,
  // as a string; null if no older messages exist
}
```

**Semantics:** Ordered page of channel messages, newest-first within the page. A `null` nextCursor means the beginning of the channel history has been reached and no further `fetchPreviousPage` calls should be issued.

**Versioning:** New optional fields only; removing or renaming existing fields, or changing `nextCursor` semantics, requires v2.

---

### PostChannelMessageRequest (v1)

**Schema:**

```ts
{
  content: string; // non-empty after trim, max 4000 chars
}
```

**Semantics:** The textual body of a new channel message. The API is responsible for associating `authorId` from the validated JWT — the client does not send it.

**Versioning:** New optional fields only; breaking changes require v2.

---

### PostChannelMessageResponse (v1)

**Schema:**

```ts
{
  messageId: string; // UUID assigned by the server
  channelId: string; // UUID of the target channel
  authorId: string; // UUID of the posting member (from JWT)
  content: string; // echoed back from request
  sequenceNumber: number; // server-assigned sequence number
  postedAt: string; // ISO 8601 UTC timestamp
}
```

**Semantics:** The persisted message record. All fields are populated by the server; the client uses this response body to perform the optimistic cache append — no second GET is needed. Fields match `MessageItem` in `ChannelFeedPage` plus `channelId`.

**Versioning:** New optional fields only; breaking changes require v2.
