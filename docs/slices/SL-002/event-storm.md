# Event Storm — SL-002: channel-feed-send-ui

## Domain Events

- `ChannelPageOpened` — user navigated to the channel URL; React page component mounted
- `ChannelFeedRequested` — frontend issued GET /channels/:channelId/messages (initial load, 50 most recent, no cursor)
- `AuthTokenValidated` — API JWT middleware verified the access token as valid and non-expired
- `ChannelMembershipVerified` — API confirmed the requesting user is an authorised member of the channel
- `ChannelFeedServed` — API returned up to 50 messages with a cursor pointing to the oldest message in the page
- `ChannelMessagesRendered` — React rendered the message list in the UI, newest at the bottom
- `UserScrolledToTop` — user reached the top of the visible message list; infinite scroll trigger fires
- `OlderMessagesRequested` — TanStack Query `fetchPreviousPage` issued GET /channels/:channelId/messages?before=<cursor>
- `OlderMessagesFetched` — API returned an older page of messages; UI prepended them above existing messages
- `MessageSubmitRequested` — user clicked "Send" or pressed Enter in the message input
- `EmptyMessageRejected` — client-side validation rejected a blank or whitespace-only message before any API call
- `PostMessageAPICallMade` — frontend sent POST /channels/:channelId/messages with content payload
- `ChannelMessagePosted` — (domain event, SL-001) message was persisted by the Channel aggregate and assigned a sequence number
- `MessageAppendedOptimistically` — new message from 201 response body was appended to local TanStack Query cache; no re-fetch
- `MessageInputCleared` — message input field was reset to empty string after successful send
- `APIErrorOccurred` — GET or POST returned a non-2xx response; error banner was displayed to the user

## Commands

- `FetchChannelFeed(channelId, before?: cursor)` — GET /channels/:channelId/messages?limit=50[&before=cursor]; returns a page of messages and the next cursor
- `PostChannelMessage(channelId, content)` — POST /channels/:channelId/messages; triggers domain `PostChannelMessage` command
- `RenderChannelPage(channelId)` — React Router / TanStack Router page mount; triggers initial data fetch
- `SubmitMessage(content)` — user-initiated form submission from the message input component
- `ValidateMessage(content)` — client-side guard: reject if content is blank or exceeds max length
- `AppendMessageToFeed(message)` — update TanStack Query infinite cache by appending the new message to the last page
- `ShowErrorBanner(error)` — render error state in channel feed UI with a retry affordance

## Policies

- When `ChannelPageOpened` → `FetchChannelFeed(channelId)` — channel feed is auto-fetched on component mount (TanStack Query `useInfiniteQuery`)
- When `UserScrolledToTop` and `hasPreviousPage = true` → `FetchChannelFeed(channelId, before=cursor)` — TanStack Query `fetchPreviousPage` triggered by intersection observer at the top of the list
- When `ChannelMessagePosted` (POST returns 201) → `AppendMessageToFeed` — optimistically update local cache from response body; no re-fetch
- When `ChannelMessagePosted` (POST returns 201) → `MessageInputCleared` — clear input immediately on success
- When `APIErrorOccurred` → `ShowErrorBanner` — any non-2xx from GET feed or POST message triggers the error state

## Read Models

- `ChannelFeedPage` — one page of the infinite scroll: `{ messages: MessageItem[], nextCursor: string | null }`; `MessageItem = { messageId, authorId, content, sequenceNumber, postedAt }`
- `InfiniteChannelFeed` — TanStack Query infinite query result: `{ pages: ChannelFeedPage[], pageParams: (string | null)[] }`; rendered by flattening all pages, newest at bottom
- `ChannelMessageFormState` — local React state for the input: `{ inputValue: string, isSubmitting: boolean, validationError: string | null }`
- `ChannelPageErrorState` — error banner content: `{ visible: boolean, message: string, retryable: boolean }`

## External Systems

- `IdentityAccessJWTMiddleware` — validates Bearer tokens on every API request; owned by the IdentityAccess BC; not implemented in this slice
- `PlaywrightTestRunner` — E2E test infrastructure; seeds a workspace + channel + user via DB, calls POST /auth/login to obtain a token, then exercises the full channel feed flow
- `TanStackQuery (client)` — manages HTTP caching, infinite scroll page state, and background refetch; `useInfiniteQuery` drives the feed; `getPreviousPageParam` supplies the before-cursor for older-page fetches

## Hot Spots (resolved)

- **Feed update strategy after POST** → Resolved: append optimistically from 201 response body using TanStack Query cache mutation; no second GET call.
- **Playwright auth strategy** → Resolved: test setup POSTs to /auth/login with seeded credentials; exercises the real auth path in CI.
- **Feed pagination strategy** → Resolved: TanStack Query `useInfiniteQuery`; initial load = 50 most recent messages; scroll-to-top triggers `fetchPreviousPage` with `before=<cursor>`; cursor is the `sequenceNumber` of the oldest visible message.
- **Error state UI** → Resolved: yes — minimal error banner rendered when GET /messages or POST /messages returns a non-2xx response; banner includes a retry affordance.
