# Reddit Clone — Design Document

**Date:** 2026-02-24
**Status:** Approved
**Branch:** feat/reddit-clone
**Scope:** Bootstrap a new standalone Modern Reddit clone as a first-class Colloquium monorepo member, driven by the `colloquium:project` skill with 265 end-to-end behavioral tests.

---

## Problem Statement

The Colloquium monorepo currently hosts `colloquium-chat`, a Slack-like messaging app. This project adds a second standalone app — a faithful one-to-one clone of modern Reddit (new.reddit.com) — following the same autonomous development pattern: `colloquium:project` skill, 265 behavioral test cases, full monorepo integration.

---

## Decision

**Approach A — Full Bootstrap via `colloquium:project` skill.**

- New standalone app: `apps/reddit-clone` + `apps/reddit-clone-api` + `packages/reddit-clone-types`
- Completely independent from `colloquium-chat` — separate users, separate database, separate auth
- Same proven tech stack as `colloquium-chat`
- Visual target: faithful to Reddit's current design (orange `#FF4500` accent, card-based layout, vote arrows, light/dark mode)
- Real-time: WebSockets for Reddit Chat (DMs) only; posts/votes/comments use REST
- 265 end-to-end behavioral tests drive all development

---

## Architecture

### Monorepo Placement

```
apps/
  reddit-clone/          # React + Vite frontend  (port 5174)
  reddit-clone-api/      # Hono + SQLite backend  (port 5002)
packages/
  reddit-clone-types/    # Zod schemas + inferred TypeScript types
```

Turborepo picks up new entries automatically. `pnpm dev` at the repo root starts all registered apps.

### State Tracking

```
.claude/
  projects/
    reddit-clone/
      project-state.json     # phase / step / task tracking
      app_spec.txt           # generated XML specification
      feature_list.json      # 265 behavioral test cases
      claude-progress.txt    # session-by-session log
```

---

## Tech Stack

| Layer              | Choice                                          |
| ------------------ | ----------------------------------------------- |
| Frontend framework | React 18 + Vite 5                               |
| Styling            | Tailwind CSS 4                                  |
| State management   | Zustand 5 (feature-sliced stores)               |
| Server state       | TanStack Query v5                               |
| Forms              | React Hook Form v7 + Zod resolvers              |
| URL state          | nuqs v2                                         |
| Routing            | React Router v7                                 |
| Backend            | Hono (Node adapter, TypeScript)                 |
| Database           | SQLite via Drizzle ORM                          |
| Auth               | JWT (access + refresh tokens, httpOnly cookies) |
| Real-time          | WebSockets (ws library) — chat only             |
| Frontend port      | 5174                                            |
| Backend port       | 5002                                            |

---

## Data Model

```sql
users              — id, username, email, password_hash, karma_post, karma_comment,
                     cake_day, avatar_url, bio, is_premium, coin_balance

communities        — id, name, slug, description, icon_url, banner_url,
                     type (public/private/restricted), rules_json, created_by

community_members  — user_id, community_id, role (member/moderator/owner),
                     flair, joined_at

posts              — id, title, body, url, type (text/link/image/video/poll/gallery),
                     author_id, community_id, flair, is_nsfw, is_spoiler, is_locked,
                     is_stickied, score, crosspost_parent_id, scheduled_at,
                     gallery_images_json, poll_options_json, poll_expires_at

comments           — id, body, author_id, post_id, parent_comment_id,
                     score, is_removed, is_distinguished

votes              — id, user_id, target_type (post/comment), target_id, value (+1/-1)

reports            — id, reporter_id, target_type (post/comment/community),
                     target_id, reason, custom_reason, resolved, resolved_by

awards             — id, name, icon, coin_cost, description

post_awards        — post_id, award_id, giver_id, given_at

saved_items        — user_id, target_type (post/comment), target_id, collection_id

collections        — id, user_id, name

custom_feeds       — id, user_id, name, slug, is_public

custom_feed_communities — feed_id, community_id

notifications      — id, user_id, type, payload_json, is_read, created_at

chat_messages      — id, sender_id, recipient_id, body, is_read,
                     is_deleted, is_request_accepted, created_at

wiki_pages         — id, community_id, slug, body, revised_by, revised_at,
                     permissions (all/members/mods)

wiki_revisions     — id, wiki_page_id, body, revised_by, revised_at

community_widgets  — id, community_id, type (text/links/rules), title,
                     content_json, sort_order

automod_rules      — id, community_id, rule_json

refresh_tokens     — id, user_id, token_hash, expires_at

hidden_posts       — user_id, post_id

blocked_users      — blocker_id, blocked_id

reddit_talk_rooms  — id, community_id, title, host_id, is_live, created_at

reddit_talk_participants — room_id, user_id, role (host/speaker/listener)
```

**Key design decisions:**

- `votes` is a single polymorphic table for both post and comment votes
- `posts.score` and `comments.score` are denormalized counters updated on each vote (avoids expensive COUNT joins on feed queries)
- `comments` self-references via `parent_comment_id` for unlimited nesting depth
- `reports` is polymorphic — covers posts, comments, and community-level reports
- `custom_feed_communities` is a join table supporting multireddit-style feeds

---

## Frontend Architecture

### Routes

```
/                                        Home feed
/r/:community                            Community page
/r/:community/submit                     Post submission
/r/:community/comments/:postId/:slug     Post + comment thread
/r/:community/wiki                       Wiki index
/r/:community/wiki/:page                 Wiki page
/r/:community/mod                        Mod queue
/r/:community/mod/log                    Mod log
/popular                                 Popular feed
/all                                     All feed
/u/:username                             User profile
/u/:username/saved                       Saved items
/u/:username/m/:feedSlug                 Custom feed
/search                                  Search results
/chat                                    DM inbox
/chat/:username                          DM conversation
/settings                                Account settings
/login
/register
```

### State Architecture

| Layer          | Responsibility                                                                       |
| -------------- | ------------------------------------------------------------------------------------ |
| TanStack Query | All server state: feed posts, comments, community info, user profiles, notifications |
| Zustand        | Client state: auth session, chat WebSocket connection, optimistic vote state         |
| nuqs           | URL state: feed sort (`?sort=hot&t=week`), search query, pagination cursor           |

### Key UI Components

| Component           | Description                                                                              |
| ------------------- | ---------------------------------------------------------------------------------------- |
| `PostCard`          | Compact (feed) and expanded (post page) variants; vote buttons, award display, flair tag |
| `CommentThread`     | Recursive tree renderer; collapse/expand at any level; unlimited depth                   |
| `VoteButtons`       | Optimistic upvote/downvote with score; orange active state                               |
| `CommunityHeader`   | Banner, icon, name, member count, Join/Leave button                                      |
| `MarkdownRenderer`  | Reddit-flavored markdown: bold, italic, links, code, tables, spoiler tags                |
| `RichTextComposer`  | Post/comment editor with markdown toolbar; character limit counter                       |
| `PollWidget`        | Radio-button options, vote bar, percentage display, expiry countdown                     |
| `GalleryCarousel`   | Multi-image post display with arrow navigation and counter                               |
| `AwardMenu`         | Coin-cost display, award selection, insufficient-coin guard                              |
| `ModQueue`          | Reported items list; approve/remove/dismiss actions                                      |
| `NotificationPanel` | Dropdown from nav bell; per-type read/unread; mark all read                              |
| `ChatPanel`         | WebSocket-backed DM conversation; typing presence; read receipts                         |
| `RedditTalkRoom`    | Audio room UI: participant list, raise hand, speaker slots                               |
| `WidgetSidebar`     | Community sidebar widgets; drag-to-reorder (mod only)                                    |

### Visual Identity

- Primary accent: Reddit orange `#FF4500`
- Light mode default; dark mode via class strategy with OS preference fallback
- Card-based layout with subtle box shadows
- Vote arrows on left side of every post and comment row
- Vote score between arrows; upvote arrow turns orange, downvote turns blue

---

## API Architecture

### Auth

```
POST /api/auth/register
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout
```

### Communities

```
GET    /api/r/:slug
POST   /api/r
PUT    /api/r/:slug
DELETE /api/r/:slug
POST   /api/r/:slug/join
POST   /api/r/:slug/leave
GET    /api/r/:slug/members
PUT    /api/r/:slug/members/:userId/flair
POST   /api/r/:slug/members/:userId/promote
POST   /api/r/:slug/members/:userId/demote
GET    /api/r/:slug/mod/queue
POST   /api/r/:slug/mod/approve/:targetType/:targetId
POST   /api/r/:slug/mod/remove/:targetType/:targetId
POST   /api/r/:slug/mod/ban/:userId
POST   /api/r/:slug/mod/unban/:userId
POST   /api/r/:slug/mod/mute/:userId
POST   /api/r/:slug/mod/sticky/:postId
POST   /api/r/:slug/mod/unsticky/:postId
POST   /api/r/:slug/mod/lock/:postId
POST   /api/r/:slug/mod/distinguish/:commentId
GET    /api/r/:slug/mod/log
GET    /api/r/:slug/wiki
GET    /api/r/:slug/wiki/:page
PUT    /api/r/:slug/wiki/:page
GET    /api/r/:slug/wiki/:page/revisions
POST   /api/r/:slug/wiki/:page/revert/:revisionId
GET    /api/r/:slug/widgets
POST   /api/r/:slug/widgets
PUT    /api/r/:slug/widgets/:widgetId
DELETE /api/r/:slug/widgets/:widgetId
PUT    /api/r/:slug/widgets/order
GET    /api/r/:slug/automod
PUT    /api/r/:slug/automod
```

### Posts

```
GET    /api/posts                        ?sort=hot|new|top|rising&t=hour|day|week|month|year|all&after=cursor&community=slug
POST   /api/posts
GET    /api/posts/:id
PUT    /api/posts/:id
DELETE /api/posts/:id
POST   /api/posts/:id/vote               body: { value: 1 | -1 | 0 }
POST   /api/posts/:id/save
POST   /api/posts/:id/unsave
POST   /api/posts/:id/hide
POST   /api/posts/:id/unhide
POST   /api/posts/:id/award
POST   /api/posts/:id/crosspost
POST   /api/posts/:id/report
POST   /api/posts/:id/poll-vote          body: { optionIndex: number }
```

### Comments

```
GET    /api/posts/:id/comments           ?sort=best|new|top|controversial
POST   /api/posts/:id/comments
PUT    /api/comments/:id
DELETE /api/comments/:id
POST   /api/comments/:id/vote
POST   /api/comments/:id/save
POST   /api/comments/:id/report
```

### Users & Profiles

```
GET    /api/u/:username
GET    /api/u/:username/posts
GET    /api/u/:username/comments
GET    /api/u/:username/saved
GET    /api/u/:username/m/:feedSlug
POST   /api/u/:username/m               create custom feed
PUT    /api/u/:username/m/:feedSlug
DELETE /api/u/:username/m/:feedSlug
POST   /api/u/:username/m/:feedSlug/communities
DELETE /api/u/:username/m/:feedSlug/communities/:communitySlug
POST   /api/u/:username/block
POST   /api/u/:username/unblock
```

### Search, Notifications, Settings

```
GET    /api/search                       ?q=&type=posts|communities|users&sort=relevance|new|top
GET    /api/notifications
PUT    /api/notifications/read-all
PUT    /api/notifications/:id/read
GET    /api/settings
PUT    /api/settings
DELETE /api/settings/account            deactivate
```

### Awards & Premium

```
GET    /api/awards
POST   /api/awards/purchase-coins
GET    /api/premium/status
POST   /api/premium/activate
```

### Reddit Talk

```
GET    /api/r/:slug/talk
POST   /api/r/:slug/talk                create room
DELETE /api/r/:slug/talk/:roomId        end room
POST   /api/r/:slug/talk/:roomId/join
POST   /api/r/:slug/talk/:roomId/leave
POST   /api/r/:slug/talk/:roomId/raise-hand
POST   /api/r/:slug/talk/:roomId/invite-speaker/:userId
POST   /api/r/:slug/talk/:roomId/remove-speaker/:userId
```

### WebSocket

```
WS     /ws/chat                         DM messaging — events: message.new, message.read, presence.update
```

---

## Test Suite: 265 Behavioral Scenarios

Tests are ordered by feature dependency. Each scenario maps to one `feature_list.json` entry with `description` (the behavioral scenario) and `steps` (the verification procedure).

### Distribution

| Range     | Feature Group                 | Count   |
| --------- | ----------------------------- | ------- |
| 1–8       | Auth                          | 8       |
| 9–20      | Communities                   | 12      |
| 21–40     | Posts                         | 20      |
| 41–50     | Voting                        | 10      |
| 51–68     | Comments                      | 18      |
| 69–80     | Feed & Sorting                | 12      |
| 81–88     | Search                        | 8       |
| 89–108    | Moderation                    | 20      |
| 109–116   | Wiki                          | 8       |
| 117–122   | Saved Items & Collections     | 6       |
| 123–132   | Notifications                 | 10      |
| 133–147   | Reddit Chat (WebSocket)       | 15      |
| 148–155   | Awards                        | 8       |
| 156–160   | Reddit Premium                | 5       |
| 161–165   | Community Highlights          | 5       |
| 166–171   | Karma & Flair                 | 6       |
| 172–177   | Settings                      | 6       |
| 178–185   | Dark Mode, Shortcuts, Sharing | 8       |
| 186–193   | Reports                       | 8       |
| 194–201   | Custom Feeds (Multireddits)   | 8       |
| 202–207   | Content Filtering             | 6       |
| 208–213   | Reddit Talk                   | 6       |
| 214–218   | Community Widgets             | 5       |
| 219–265   | Edge Cases                    | 47      |
| **Total** |                               | **265** |

### Full Behavioral Scenarios

#### Auth (1–8)

```
#1 — Server health
  A visitor hits GET /api/health and gets 200 OK { status: 'ok' }

#2 — Registration
  Given a visitor fills in username, email, and password
  When they submit the register form
  Then an account is created and they are redirected to the home feed as a logged-in user

#3 — Duplicate email rejected
  Given an email is already registered
  When a new visitor tries to register with the same email
  Then they see "Email already in use" and no account is created

#4 — Login with valid credentials
  Given a registered user enters correct email and password
  When they submit the login form
  Then they receive JWT tokens in httpOnly cookies and land on the home feed

#5 — Login with wrong password
  Given a registered user enters an incorrect password
  When they submit the login form
  Then they see "Invalid credentials" and remain on the login page

#6 — Token refresh
  Given a user's access token has expired
  When they make any authenticated request
  Then the client transparently calls /api/auth/refresh and retries without interruption

#7 — Refresh token expiry forces re-login
  Given both tokens have expired
  When the client attempts a refresh
  Then the refresh fails and the user is redirected to /login

#8 — Logout
  Given a logged-in user clicks Logout
  When the request completes
  Then both cookies are cleared, the refresh token is invalidated, and they land on /login
```

#### Communities (9–20)

```
#9 — Create a community
  Given a logged-in user fills in a community name, slug, and description
  When they submit the create form
  Then the community exists at /r/:slug and they are its owner

#10 — Duplicate slug rejected
  Given a community with slug "cooking" already exists
  When another user tries to create a community with slug "cooking"
  Then they see "Community name already taken"

#11 — Join a public community
  Given a logged-in user visits a community they are not a member of
  When they click Join
  Then they become a member and the button changes to Leave

#12 — Leave a community
  Given a logged-in user is a member of a community
  When they click Leave
  Then they are removed and the community no longer appears in their home feed

#13 — Owner cannot leave their own community
  Given a user is the owner of a community
  When they attempt to leave
  Then they see "Transfer ownership before leaving"

#14 — Private community requires approval
  Given a community is set to Private
  When a non-member visits /r/:slug
  Then they see only the name and a "Request to Join" button — no posts are visible

#15 — Restricted community: members can comment but only mods can post
  Given a community is set to Restricted
  When a regular member tries to submit a post
  Then they see "Only moderators can post in this community"

#16 — Community icon and banner upload
  Given an owner uploads an icon and banner image and saves settings
  Then the icon appears in the community header and left rail; the banner spans the page top

#17 — Community rules
  Given a moderator adds three rules with titles and descriptions
  When a user visits the community sidebar
  Then all three rules are listed in order

#18 — Member list
  Given a community has multiple members with different roles
  When a user visits /r/:slug/members
  Then all members are shown with role badges (Owner, Mod, Member)

#19 — Community member search
  Given a community has 50 members
  When a mod types a username into the member search box
  Then the list filters to matching members in real time

#20 — Delete a community
  Given an owner confirms deletion in community settings
  Then the community, all its posts, and all memberships are removed; /r/:slug returns 404
```

#### Posts (21–40)

```
#21 — Create a text post
  Given a member opens the post composer and selects "Text"
  When they fill in a title and body and submit
  Then the post appears at the top of /r/:slug with their username and a timestamp

#22 — Create a link post
  Given a member pastes a URL and submits with a title
  Then the post shows the URL as a clickable external link with a domain tag

#23 — Create an image post
  Given a member uploads a single image file and submits
  Then the image renders inline in the feed and on the post page

#24 — Create an image gallery post
  Given a member uploads three images in sequence and submits
  Then a carousel appears showing image 1 of 3 with left/right navigation arrows

#25 — Gallery navigation
  Given a post has an image gallery
  When a viewer clicks the right arrow
  Then image 2 of 3 is shown and the counter updates

#26 — Create a video post
  Given a member uploads a video file and submits
  Then the video renders with a play button inline in the feed

#27 — Create a poll post
  Given a member selects "Poll", adds two options, and sets a 3-day expiry
  Then the poll renders with radio buttons and a vote count of 0 for each option

#28 — Voting on a poll
  Given a logged-in user sees a poll post and selects an option
  Then their vote is recorded, the option shows a percentage bar, and they cannot vote again

#29 — Poll expiry
  Given a poll has passed its expiry date
  When any user views it
  Then the options are disabled and results are shown as final

#30 — Post with NSFW tag
  Given a member marks their post NSFW
  When another user sees it in the feed
  Then the thumbnail is blurred with an "NSFW" badge; clicking reveals the content

#31 — Post with spoiler tag
  Given a member marks their post as Spoiler
  When another user sees it in the feed
  Then the body is hidden with a "Spoiler — click to reveal" overlay

#32 — Post flair
  Given a community has flair options and a member selects "News" flair
  Then the flair tag appears next to the post title in the feed and on the post page

#33 — Crosspost
  Given a user clicks "Crosspost", selects a destination community, and submits
  Then a new post appears in the destination community with a "Crossposted from r/source" attribution link

#34 — Edit a post
  Given the author opens the edit menu and updates the body
  Then the post body reflects the change and shows an "edited" timestamp

#35 — Delete own post
  Given the author clicks Delete and confirms
  Then the post is removed from the feed and its page returns 404

#36 — Non-author cannot edit
  Given a logged-in user who did not author a post visits its page
  Then the edit option is not visible in the post menu

#37 — Post character limit
  Given a member types more than 40,000 characters in a text post body
  Then a live counter turns red and the Submit button is disabled

#38 — Post title required
  Given a member submits a post with an empty title
  Then they see "Title is required" and no post is created

#39 — Non-member cannot post
  Given a logged-in user is not a member of a community
  When they try to open the post composer
  Then they see "Join this community to post"

#40 — Banned user cannot post
  Given a user has been banned from a community
  When they attempt to create a post there
  Then they see "You are banned from r/:slug"
```

#### Voting (41–50)

```
#41 — Upvote a post
  Given a logged-in user clicks the upvote arrow
  Then the arrow turns orange, the score increments by 1, and the vote is persisted

#42 — Downvote a post
  Given a logged-in user clicks the downvote arrow
  Then the arrow turns blue and the score decrements by 1

#43 — Un-vote by clicking again
  Given a user has already upvoted a post and clicks the upvote arrow again
  Then the vote is removed and the score returns to its previous value

#44 — Switch vote direction
  Given a user has upvoted and clicks the downvote arrow
  Then the upvote is cancelled, the downvote is applied, and the score changes by -2

#45 — Vote is optimistic
  Given a user clicks upvote
  Then the UI updates immediately without waiting for the API response

#46 — Optimistic vote rolls back on error
  Given the vote API returns a 500 error after an upvote
  Then the score reverts and a toast shows "Vote failed, please try again"

#47 — Upvote a comment
  Given a logged-in user clicks upvote on a comment
  Then the comment score increments and the arrow turns orange

#48 — Score denormalization
  Given a post has 10 upvotes and 3 downvotes
  When fetched from the API
  Then posts.score is 7 — not computed on the fly from the votes table

#49 — Unauthenticated user cannot vote
  Given a visitor (not logged in) clicks a vote arrow
  Then they are prompted to log in rather than having a vote registered

#50 — Author can vote on own post
  Given a post author upvotes their own post
  Then the vote is accepted
```

#### Comments (51–68)

```
#51 — Post a top-level comment
  Given a logged-in member types a comment and clicks Comment
  Then it appears at the top of the thread with their username and a timestamp

#52 — Reply to a comment
  Given a user clicks "Reply" under an existing comment and submits
  Then it appears indented one level below the parent

#53 — Three-level nesting
  Given a comment has a reply which itself has a reply
  Then all three levels render with increasing left-side indentation

#54 — Collapse a comment thread
  Given a top-level comment has 5 replies and a user clicks the collapse icon
  Then the entire subtree is hidden and a "N replies hidden" pill appears

#55 — Expand a collapsed thread
  Given a thread is collapsed and the user clicks the pill
  Then all replies reappear

#56 — Edit own comment
  Given the author clicks Edit, changes the text, and saves
  Then the updated text is shown with an "edited" marker

#57 — Delete own comment
  Given the author confirms deletion
  Then the comment body becomes "[deleted]" and the author is hidden; the reply thread remains

#58 — Sort by Best (default)
  Given a post has multiple comments with different scores
  When the page loads
  Then the highest-scoring comment appears first

#59 — Sort by New
  Given a user selects "New" in the comment sort dropdown
  Then comments re-order with the most recently posted first

#60 — Sort by Top
  Given a user selects "Top"
  Then comments re-order by all-time score descending

#61 — Sort by Controversial
  Given a user selects "Controversial"
  Then comments with high numbers of both upvotes and downvotes appear first

#62 — Comment flair (mod-assigned)
  Given a moderator assigns flair "Helpful" to a comment
  Then a flair badge appears next to the comment author's name

#63 — Comment markdown rendering
  Given a user writes **bold**, _italic_, and `inline code` in a comment
  Then the rendered comment shows bold, italic, and monospace code span

#64 — Comment character limit
  Given a user types more than 10,000 characters
  Then the counter turns red and Submit is disabled

#65 — Comment permalink
  Given a user clicks "Share" on a comment
  Then the URL changes to /r/:slug/comments/:postId/comment/:commentId

#66 — Comment permalink deep link
  Given a user opens a comment permalink URL directly
  Then the post page loads with the linked comment highlighted and scrolled into view

#67 — Context thread view
  Given a user is viewing a deeply nested reply and clicks "View context"
  Then the thread re-renders showing the full ancestor chain up to the top-level comment

#68 — Load more comments
  Given a post has more than 200 top-level comments
  Then only the first 200 are shown with a "Load more comments" button
```

#### Feed & Sorting (69–80)

```
#69 — Home feed shows joined communities only
  Given a user has joined r/cooking and r/gaming but not r/finance
  When they visit the home feed
  Then only posts from r/cooking and r/gaming appear

#70 — Sort by Hot (default)
  Given the home feed is loaded
  Then posts are ordered by score + recency (hot algorithm)

#71 — Sort by New
  Given a user selects "New"
  Then posts are ordered by created_at descending regardless of score

#72 — Sort by Top: Today
  Given a user selects "Top → Today"
  Then only posts from the last 24 hours are ranked by score

#73 — Sort by Top: This Week
  Given a user selects "Top → This Week"
  Then posts from the last 7 days are ranked by score

#74 — Sort by Top: All Time
  Given a user selects "Top → All Time"
  Then all posts ever are ranked by score

#75 — Sort by Rising
  Given a user selects "Rising"
  Then posts with rapidly increasing score in the last few hours appear first

#76 — Popular feed
  Given a user visits /popular
  Then they see high-scoring posts from all public communities regardless of membership

#77 — All feed
  Given a user visits /all
  Then they see all recent posts from all public communities, sorted by Hot

#78 — Infinite scroll loads next page
  Given a user scrolls to the bottom of the feed
  Then new posts append below via TanStack Query useInfiniteQuery without a page reload

#79 — Sort + time filter persisted in URL
  Given a user selects "Top → This Month"
  Then the URL updates to ?sort=top&t=month

#80 — Empty feed for new user
  Given a brand-new user has not joined any communities
  Then they see a "Join some communities to get started" prompt with suggested popular communities
```

#### Search (81–88)

```
#81 — Search for posts by keyword
  Given a user types "sourdough" into the search bar and presses Enter
  Then the results page shows posts whose titles or bodies contain "sourdough"

#82 — Search for communities
  Given a user selects "Communities" on the results page
  Then communities whose name or description matches the query are shown

#83 — Search for users
  Given a user selects "People"
  Then user profiles whose username matches the query are listed

#84 — Search within a community
  Given a user visits r/cooking and searches for "pasta"
  Then only posts from r/cooking matching "pasta" are returned

#85 — Sort by Relevance (default)
  Given a search returns multiple results
  Then they are ordered by relevance score

#86 — Sort by New
  Given a user switches sort to "New"
  Then results re-order by created_at descending

#87 — Sort by Top
  Given a user switches sort to "Top"
  Then results re-order by score descending

#88 — Empty search state
  Given a search matches no results
  Then they see "No results for [query]" with suggestions to broaden the search
```

#### Moderation (89–108)

```
#89 — Assign a moderator
  Given an owner promotes a member to Moderator
  Then the member gets a "MOD" badge and access to mod tools

#90 — Remove a moderator
  Given an owner demotes a moderator back to Member
  Then the badge disappears and mod tools are removed

#91 — Report a post
  Given a user reports a post with reason "Spam"
  Then a report entry appears in the mod queue with reason "Spam"

#92 — Report a comment
  Given a user reports a comment with reason "Harassment"
  Then the report appears in the mod queue linked to that comment

#93 — Mod queue shows all pending reports
  Given a mod opens /r/:slug/mod/queue
  Then all reported posts and comments that have not been actioned are shown

#94 — Approve a reported post
  Given a mod clicks "Approve" on a post in the queue
  Then the post is marked approved, removed from the queue, and remains visible

#95 — Remove a reported post
  Given a mod clicks "Remove" on a post
  Then the post body becomes "[removed]" and the report is resolved

#96 — Remove with a reason
  Given a mod removes a post and selects reason "Rule 1: No spam"
  Then a mod-comment appears under the post quoting the removal reason

#97 — Lock a post
  Given a mod locks a post
  Then the comment composer is disabled for all non-mods and "Comments locked" is shown

#98 — Sticky a post
  Given a mod stickies a post
  Then it appears pinned at the top of the community feed regardless of sort

#99 — Unsticky a post
  Given a mod un-stickies a post
  Then it returns to its normal position in the feed

#100 — Ban a user
  Given a mod bans a user with reason "Repeated spam"
  Then any attempt to post or comment shows "You are banned from r/:slug"

#101 — Banned user can still view the community
  Given a user is banned from r/cooking
  Then they can read posts and comments but cannot interact

#102 — Unban a user
  Given a mod removes a ban
  Then the user can post and comment again normally

#103 — Mute a user
  Given a mod mutes a user for 7 days
  Then the user cannot send modmail or trigger mod notifications but can still post

#104 — Mod log
  Given a mod removes a post, bans a user, and stickies another post
  When they open the mod log
  Then all three actions appear in chronological order with the acting mod's username

#105 — Distinguish a mod comment
  Given a mod comments on a post and clicks "Distinguish as Moderator"
  Then the comment shows a green "MOD" tag to all users

#106 — Schedule a post
  Given a mod creates a post and sets a future publish datetime
  Then the post is not visible until that datetime, when it appears automatically

#107 — Automod: remove by keyword
  Given a community has an automod rule to remove posts containing "casino"
  When a member submits a post with "casino" in the title
  Then the post is immediately removed and a mod-log entry is created

#108 — Automod notify author
  Given automod removes a post
  Then the author is notified "Your post was removed automatically — Rule: No gambling content"
```

#### Wiki (109–116)

```
#109 — Create a wiki page
  Given a mod enters a slug and body at /r/:slug/wiki/new and saves
  Then the wiki page is accessible at /r/:slug/wiki/:page-slug

#110 — Edit a wiki page
  Given a mod edits and saves a wiki page
  Then the updated content is displayed and the old version is in revision history

#111 — Revision history
  Given a wiki page has been edited three times
  When a mod visits the history tab
  Then all three revisions are listed with editor username and timestamp

#112 — Revert to a previous revision
  Given a mod selects an older revision and clicks Revert
  Then the current page content is replaced with the selected revision

#113 — Wiki permissions: members only
  Given a mod sets permissions to "Members only"
  When a non-member visits the wiki
  Then they see "This wiki is restricted to community members"

#114 — Wiki permissions: mods only
  Given a mod sets permissions to "Mods only"
  Then regular members can read but not edit

#115 — Wiki markdown rendering
  Given a wiki page contains a markdown table and code block
  Then the table renders as HTML and the code block is syntax highlighted

#116 — Wiki index page
  Given a community has three wiki pages
  When a user visits /r/:slug/wiki
  Then an index lists all pages with slugs and last-edited timestamps
```

#### Saved Items & Collections (117–122)

```
#117 — Save a post
  Given a user clicks the Save bookmark icon on a post
  Then it is added to /u/:username/saved and a toast confirms "Post saved"

#118 — Unsave a post
  Given a user has saved a post and clicks the filled bookmark icon
  Then the post is removed from their saved list

#119 — Save a comment
  Given a user saves a comment
  Then it appears under a "Comments" tab on their /u/:username/saved page

#120 — Create a collection
  Given a user opens saved items and clicks "New Collection" named "Recipes to try"
  Then an empty collection appears in their saved sidebar

#121 — Add a saved post to a collection
  Given a user has a saved post and a collection
  When they move the post into the collection
  Then the post appears inside that collection

#122 — Delete a collection
  Given a user deletes a collection
  Then the collection disappears but the saved posts remain in the unsorted saved list
```

#### Notifications (123–132)

```
#123 — Comment reply triggers notification
  Given user A posted a post and user B replies to it
  Then user A receives "user B replied to your post: [title]"

#124 — Comment reply to comment triggers notification
  Given user A left a comment and user B replies to it
  Then user A is notified "user B replied to your comment"

#125 — Username mention triggers notification
  Given user B writes a comment containing "u/userA"
  Then user A receives a mention notification with a link to the comment

#126 — Notification badge
  Given a user has 3 unread notifications
  Then a badge showing "3" appears on the notification bell in the nav

#127 — Mark all as read
  Given a user has unread notifications and clicks "Mark all as read"
  Then all are marked read and the badge disappears

#128 — Disable comment reply notifications
  Given a user turns off "Comment reply notifications" in settings
  When another user replies to their comment
  Then no notification is generated

#129 — Mod removal notification
  Given a user's post is removed by a moderator
  Then they receive "Your post was removed from r/:slug"

#130 — Award notification
  Given a user's post receives an award
  Then they are notified "Your post received a Silver Award"

#131 — New post notification (opt-in)
  Given a user has enabled "New post" notifications for r/cooking
  When a new post is created there
  Then they receive a notification linking to it

#132 — Notifications page
  Given a user visits /notifications
  Then all notifications are listed in reverse chronological order with read/unread distinction
```

#### Reddit Chat (133–147)

```
#133 — Open a DM
  Given a user visits another user's profile and clicks "Chat"
  Then a DM conversation opens at /chat/:username with empty message history

#134 — Send a message
  Given user A types a message and presses Enter
  Then it appears with a sent timestamp

#135 — Receive a message via WebSocket
  Given user B sends a message to user A while user A's chat tab is open
  Then the message appears in real time without a page reload

#136 — Unread DM badge
  Given user A has an unread message
  Then a badge "1" appears on the chat icon in the nav

#137 — Read receipt
  Given user A sent a message and user B opens the conversation
  Then user A sees a "Seen" indicator beneath their message

#138 — Online presence indicator
  Given user B is currently active
  When user A opens a DM with user B
  Then a green dot appears in the chat header

#139 — Offline presence
  Given user B has been inactive for more than 5 minutes
  When user A views the chat header
  Then the green dot is absent

#140 — DM inbox
  Given a user has conversations with three different people
  When they visit /chat
  Then all three are listed with most-recent message preview and timestamp

#141 — Message ordering
  Given a conversation has 20 messages
  Then they are displayed in chronological order oldest at top

#142 — Chat message markdown
  Given a user sends a message with **bold** and a link
  Then the rendered message shows bold text and a clickable hyperlink

#143 — Block stops DMs
  Given user A has blocked user B
  When user B tries to send a DM to user A
  Then they see "You cannot message this user"

#144 — Muted conversation
  Given a user mutes a DM conversation
  Then new messages from it do not trigger notification badges

#145 — Delete a message
  Given a user deletes one of their own messages
  Then it shows "[message deleted]" in the conversation for both parties

#146 — Chat request for non-mutual users
  Given user A messages user B for the first time
  Then it appears as a "Chat Request" for user B, who can Accept or Decline

#147 — Accept chat request
  Given user B accepts a chat request from user A
  Then the conversation moves from "Requests" to their main chat inbox
```

#### Awards (148–155)

```
#148 — View available awards
  Given a user opens the award menu on a post
  Then they see award options (Silver, Gold, Platinum) with coin costs

#149 — Give an award
  Given a user has enough coins and selects Silver (100 coins)
  When they confirm
  Then the Silver icon appears on the post and their balance decreases by 100

#150 — Insufficient coins blocked
  Given a user has 50 coins and tries to give Gold (500 coins)
  Then they see "Not enough coins"

#151 — Multiple awards on one post
  Given three users each give different awards to the same post
  Then all three award icons appear grouped

#152 — Award counter
  Given a post has 2 Silver awards and a third Silver is given
  Then the Silver icon shows "×3"

#153 — Award notification to recipient
  Given a user's comment receives Gold
  Then they are notified "Someone gave your comment Gold!"

#154 — Award history on profile
  Given a user has received 5 awards
  When another user views their profile
  Then a trophy cabinet section lists received awards

#155 — Coins from Premium
  Given a user activates Reddit Premium
  Then they receive 700 coins shown in their coin balance
```

#### Reddit Premium (156–160)

```
#156 — Premium badge on profile
  Given a user has Premium active
  When another user views their profile
  Then a gold shield "Premium" badge appears next to their username

#157 — Premium badge in comments
  Given a Premium user posts a comment
  Then the gold shield appears next to their username in the thread

#158 — Ad-free flag
  Given a Premium user browses the feed
  Then no promoted/ad posts appear

#159 — Premium-only community: access denied
  Given a community is marked Premium-only
  When a non-Premium user tries to visit it
  Then they see "This community is for Reddit Premium members only"

#160 — Premium-only community: access granted
  Given a user activates Premium
  When they visit a Premium-only community
  Then they can browse and join it normally
```

#### Community Highlights (161–165)

```
#161 — Pin a post to highlights
  Given a mod clicks "Add to Community Highlights" on a post
  Then it appears in a highlighted card section at the top of the community page

#162 — Remove from highlights
  Given a mod removes a post from highlights
  Then it disappears from the section and returns to normal feed position

#163 — Maximum two highlighted posts
  Given a community already has two highlighted posts
  When a mod tries to highlight a third
  Then they see "Maximum 2 posts can be highlighted at once"

#164 — Community Awards section
  Given a community has awarded posts this week
  When a user views the sidebar
  Then a "Top Awarded" section lists the most-awarded posts

#165 — Scheduled post appears at correct time
  Given a mod schedules a post for 3 hours in the future
  When that time arrives
  Then the post becomes visible without manual action
```

#### Karma & Flair (166–171)

```
#166 — Post karma accumulates
  Given a user's post receives 10 upvotes and 2 downvotes
  When another user views their profile
  Then post karma shows an increase of 8

#167 — Comment karma accumulates
  Given a user's comment receives 5 upvotes
  Then their comment karma increases by 5

#168 — Karma breakdown on profile
  Given a user visits their own profile
  Then they see separate "Post Karma" and "Comment Karma" totals

#169 — User flair per community
  Given a member selects a flair for themselves in a community
  Then the flair text appears next to their name on all posts and comments in that community

#170 — Mod assigns flair to a user
  Given a mod assigns custom flair text to a specific user
  Then that user's flair updates immediately

#171 — Post flair filter
  Given a community has posts tagged with "News", "Discussion", and "Question"
  When a user clicks the "News" flair tag
  Then the feed filters to show only "News" posts
```

#### Settings (172–177)

```
#172 — Change display name
  Given a user enters a new display name and saves
  Then the new name appears on their profile and in comment author tags

#173 — Change password
  Given a user provides their current password and a new one twice and saves
  Then their password is updated

#174 — Hide NSFW in feed
  Given a user enables "Hide NSFW content" in settings
  When they browse any feed
  Then NSFW-tagged posts are completely hidden rather than blurred

#175 — Disable award notifications
  Given a user disables "Award notifications"
  When their post receives an award
  Then no notification is generated

#176 — Block a user globally
  Given a user blocks another user from settings
  Then the blocked user's posts, comments, and DMs are hidden everywhere

#177 — Deactivate account
  Given a user deactivates their account and confirms
  Then their profile shows "[deleted]", all posts/comments show "[deleted]" author, and login is rejected
```

#### Dark Mode, Shortcuts & Sharing (178–185)

```
#178 — Dark mode toggle
  Given a user clicks the dark/light mode toggle
  Then the UI switches theme and the preference persists to localStorage

#179 — System preference respected
  Given a new visitor has not set a theme preference
  Then the UI defaults to their OS color scheme

#180 — Keyboard shortcut: j/k navigation
  Given a user is browsing the feed
  When they press "j"
  Then focus moves to the next post; "k" moves back

#181 — Keyboard shortcut: open post
  Given a post is keyboard-focused
  When the user presses Enter or "o"
  Then the post page opens

#182 — Keyboard shortcut: vote
  Given a post is keyboard-focused
  When the user presses "a"
  Then an upvote is registered; "z" downvotes

#183 — Copy share link
  Given a user clicks "Share → Copy Link" on a post
  Then the post URL is copied to clipboard and a "Link copied" toast appears

#184 — OG preview card for link posts
  Given a member submits a link post with a URL that has Open Graph tags
  Then a preview card shows the OG title, description, and thumbnail below the post title

#185 — 404 page
  Given a user navigates to a non-existent URL
  Then a "Page not found" message is shown with a link back to the home feed
```

#### Reports (186–193)

```
#186 — Report reasons list
  Given a user opens the report dialog on a post
  Then they see: Spam, Misinformation, Harassment, Hate Speech, NSFW (not tagged), Other

#187 — Report with custom reason
  Given a user selects "Other" and types a custom reason
  Then the report appears in the mod queue with the custom reason text

#188 — Duplicate report blocked
  Given a user has already reported a post and tries again
  Then they see "You have already reported this post"

#189 — Report a community to site admins
  Given a user clicks "Report Community"
  Then the report is logged at admin level, outside community moderation

#190 — Report counter in mod queue
  Given a post has been reported by 3 different users
  When a mod views the queue
  Then the post shows a "3 reports" badge

#191 — Dismiss a report without action
  Given a mod finds a reported post does not violate rules and clicks "Dismiss"
  Then the report is resolved and removed from the queue; the post remains visible

#192 — Cannot report own content
  Given a user views their own post
  Then the "Report" option is not shown in the post menu

#193 — Report from comment context menu
  Given a user opens the "…" menu on a comment
  Then "Report" appears alongside Reply, Share, Save
```

#### Custom Feeds / Multireddits (194–201)

```
#194 — Create a custom feed
  Given a user creates a feed named "Morning News" with r/worldnews and r/science added
  Then the feed appears in their sidebar with posts from both communities

#195 — Add a community to an existing feed
  Given a user visits r/technology and clicks "Add to custom feed → Morning News"
  Then r/technology posts now appear in the Morning News feed

#196 — Remove a community from a feed
  Given a custom feed includes r/worldnews and the user removes it
  Then r/worldnews posts no longer appear in the feed

#197 — Rename a custom feed
  Given a user renames "Morning News" to "Daily Reads"
  Then the sidebar label and feed URL update accordingly

#198 — Delete a custom feed
  Given a user deletes a custom feed
  Then it disappears from the sidebar; no community memberships are affected

#199 — Custom feed URL
  Given a user has a feed named "daily-reads"
  Then it is accessible at /user/:username/m/daily-reads

#200 — Custom feed respects sort
  Given a user selects "Top → This Week" on a custom feed
  Then posts from all communities in the feed are ranked by score for that window

#201 — Public custom feed
  Given a user marks their custom feed as Public
  When another user visits the feed URL
  Then they can view it read-only even without an account
```

#### Content Filtering (202–207)

```
#202 — NSFW blur in feed
  Given a post is tagged NSFW and a user with default settings views the feed
  Then the thumbnail is blurred with an "NSFW" tag; clicking reveals the content

#203 — Spoiler overlay
  Given a post is tagged Spoiler
  Then the body is hidden with "Spoiler — click to reveal"; the title is visible

#204 — Hide a post
  Given a user clicks "Hide" on a post
  Then it disappears from their feed immediately and does not reappear on refresh

#205 — Unhide a post
  Given a user visits their hidden posts list and clicks "Unhide"
  Then the post can appear in their feed again

#206 — Blocked user content hidden globally
  Given user A has blocked user B
  When user A browses any feed or comment thread
  Then all posts and comments by user B are replaced with "[content from blocked user]" collapsed

#207 — Blocked user cannot see blocker's content
  Given user A has blocked user B
  When user B views user A's profile
  Then user B sees "This user's profile is private"
```

#### Reddit Talk (208–213)

```
#208 — Create an audio room
  Given a community mod starts a Talk with a title
  Then an audio room appears at the top of the community page with a live indicator

#209 — Join as listener
  Given a live Talk is active
  When a member clicks "Join Talk"
  Then they enter as a listener

#210 — Request to speak
  Given a listener clicks "Raise Hand"
  Then the host sees a raised-hand notification in the speaker panel

#211 — Approve a speaker request
  Given the host taps "Invite to Speak" for a listener
  Then the listener is promoted to speaker status

#212 — Remove a speaker
  Given the host taps "Remove" on an active speaker
  Then that speaker is demoted back to listener

#213 — End the Talk
  Given the host clicks "End Talk" and confirms
  Then all participants are removed and the live indicator disappears
```

#### Community Widgets (214–218)

```
#214 — Add a text widget
  Given a mod adds a Text widget with a title and body
  Then the widget appears in the community sidebar

#215 — Add a links widget
  Given a mod adds a Links widget with three labelled URLs
  Then a links widget shows all three as clickable links in the sidebar

#216 — Reorder widgets
  Given a mod drags the lower widget above the upper one and saves
  Then the order is reflected in the sidebar for all users

#217 — Delete a widget
  Given a mod deletes a text widget
  Then it immediately disappears from the sidebar

#218 — Rules widget auto-generated
  Given a community has three rules defined
  Then a "Community Rules" widget automatically appears in the sidebar listing all three
```

#### Edge Cases (219–265)

```
#219 — Rate limiting on post creation
  Given a user submits more than 10 posts within 60 seconds
  Then the API returns 429 and the frontend shows "Slow down — you're posting too fast"

#220 — Rate limiting on voting
  Given a user sends more than 100 vote requests per minute
  Then subsequent votes are rejected with 429

#221 — Simultaneous vote from two sessions
  Given a user upvotes the same post from two devices simultaneously
  Then only one vote is recorded (idempotent upsert) and the score increments by 1, not 2

#222 — Private community: non-member API returns 403
  Given a non-member requests GET /api/r/:slug/posts for a private community
  Then the API returns 403 Forbidden, not 200 with empty data

#223 — Banned user gets 403 on post creation API
  Given a banned user sends POST /api/posts directly
  Then the API returns 403 "You are banned from this community"

#224 — Deleted post 404
  Given a post has been deleted
  When a user navigates to its page
  Then the API returns 404 and the frontend shows "This post has been deleted"

#225 — Removed post shows [removed] not 404
  Given a mod has removed a post
  When a user visits the post page
  Then the title is visible but the body shows "[removed by moderator]"

#226 — Auth required for all mutations
  Given an unauthenticated request is made to POST /api/posts
  Then the API returns 401

#227 — CORS blocks cross-origin requests with credentials
  Given the API is configured to allow only the frontend origin
  When a request arrives from a different origin with credentials
  Then the browser blocks the request

#228 — Large file upload rejected
  Given a user uploads an image larger than 20 MB
  Then the API returns 413 and the frontend shows "File too large (max 20 MB)"

#229 — Invalid file type rejected
  Given a user tries to upload a .exe file as a post image
  Then the frontend validates the MIME type and shows "Only image files are allowed"

#230 — Markdown XSS prevention
  Given a user submits a post body containing <script>alert('xss')</script>
  When the post is rendered
  Then the script tag is escaped or stripped — no alert fires

#231 — Vote on deleted comment blocked
  Given a comment has been deleted
  When a user tries to upvote it
  Then the vote arrows are hidden and the API returns 404

#232 — Self-reply depth limit
  Given a thread is already 10 levels deep
  When a user tries to reply again
  Then the "Reply" button is hidden at maximum depth

#233 — Community name character validation
  Given a user tries to create a community named "my community!"
  Then the form shows "Community names can only contain letters, numbers, and underscores"

#234 — Slug uniqueness is case-insensitive
  Given "Cooking" community exists
  When a user tries to create "cooking" or "COOKING"
  Then they see "Community name already taken"

#235 — Concurrent comment submit
  Given two users submit a comment on the same post simultaneously
  Then both comments appear correctly with no data loss or duplicate

#236 — Session expires during form fill
  Given a user's access token expires while composing a long post
  When they submit
  Then the token is silently refreshed and the post is submitted without data loss

#237 — Empty comment body rejected
  Given a user clicks Comment with an empty body
  Then the Submit button is disabled and no API call is made

#238 — Award on own post allowed
  Given a user gives an award to their own post
  Then the award is accepted

#239 — No self-notification
  Given a user replies to their own comment
  Then no reply notification is generated for themselves

#240 — Premium badge removed on expiry
  Given a user's Premium subscription has lapsed
  When another user views their profile
  Then the gold shield badge is not shown

#241 — Mod cannot ban another mod
  Given two mods of equal rank, one tries to ban the other
  Then they see "You cannot ban another moderator — only the owner can do this"

#242 — Owner can ban a moderator
  Given the owner selects a moderator and chooses "Ban"
  Then the moderator is demoted and banned in one action

#243 — Permalink survives post edit
  Given a post is edited
  When the original permalink is accessed
  Then the post is still accessible at the same URL

#244 — Cursor pagination: no duplicates
  Given a feed returns posts 1–25 with cursor X
  When cursor X is used for the second request
  Then posts 26–50 are returned with no duplicates

#245 — Search is case-insensitive
  Given a post titled "Sourdough Bread Recipe" exists
  When a user searches "sourdough bread recipe" (lowercase)
  Then the post appears in results

#246 — Crosspost chain limit
  Given a post is already a crosspost of a crosspost
  When a user tries to crosspost it again
  Then they see "Crosspost chains are limited to 2 levels"

#247 — Dismissed report does not affect post
  Given a mod dismisses a report
  Then the post remains fully visible and its score is unaffected

#248 — Wiki revision conflict
  Given two mods edit the same wiki page simultaneously and the second save arrives
  Then the API returns 409 Conflict and the second editor sees "Page was updated — please review the latest version"

#249 — DM to self blocked
  Given a user visits their own profile
  Then the "Chat" button is not shown

#250 — Deleted user's content attribution
  Given a user deactivates their account
  When their posts and comments are viewed
  Then they show "[deleted]" as author — the content itself is NOT deleted unless explicitly chosen

#251 — Infinite scroll uses cache
  Given a user has scrolled through 3 pages and scrolls back to the top
  Then previously loaded posts are served from TanStack Query cache without a network request

#252 — Image aspect ratio preserved
  Given an image post is uploaded in 16:9 format
  Then it renders in the feed card at the card width with natural aspect ratio (no stretching)

#253 — Comment tree renders at 5 nesting levels
  Given a comment thread has 5 levels of nesting
  Then all 5 levels are visible with correct indentation and no layout overflow

#254 — Community description markdown
  Given a mod sets a community description with **bold** and a bullet list
  When any user views the sidebar
  Then the description renders formatted markdown

#255 — Modlog pagination
  Given a community has more than 100 mod log entries
  When a mod visits the mod log
  Then only the latest 50 are shown with a "Load more" button

#256 — Cake day indicator
  Given a user registered on a specific date
  When another user views their profile on that calendar day one year later
  Then a cake icon appears next to their username

#257 — Coin balance persists across sessions
  Given a user earned 100 coins and closes their browser
  When they log back in
  Then their coin balance is still 100

#258 — Community type change: public → private
  Given an owner changes a community from Public to Private
  Then non-members immediately lose the ability to view posts (API returns 403)

#259 — Spoiler post: title still visible
  Given a spoiler-tagged post is in the feed
  Then the title is fully visible — only the body/image is hidden

#260 — Hot sort uses time decay
  Given two posts both have score 50 but post A was created 1 hour ago and post B 24 hours ago
  When the feed is sorted by Hot
  Then post A ranks above post B

#261 — Rising sort shows only recent posts
  Given a post was created 3 days ago with slow score growth
  When sorted by Rising
  Then posts created in the last 6 hours with accelerating score rank above it

#262 — Collapsed comment count is accurate
  Given a comment has 3 direct replies and 5 nested beneath them
  When collapsed
  Then the pill shows "8 replies hidden" not "3"

#263 — Chat request expires after 30 days
  Given user A sent a chat request to user B 31 days ago and user B never accepted
  Then the request no longer appears in user B's request inbox

#264 — Link post URL validation
  Given a user enters "not-a-url" in the link post field
  Then validation shows "Please enter a valid URL" and the post cannot be submitted

#265 — Gallery post minimum images
  Given a user selects "Image Gallery" but uploads only one image
  Then they see "Gallery posts require at least 2 images"
```

---

## Error Handling Conventions

Same as `colloquium-chat`:

- API returns `{ error: string }` on all 4xx/5xx responses
- Frontend shows toast notifications for mutation errors
- 401 triggers silent token refresh via TanStack Query retry; if refresh fails, redirect to `/login`
- Optimistic vote updates roll back on API failure
- 429 responses show user-facing rate limit messages (not raw HTTP status)
- Form validation runs client-side before any API call (React Hook Form + Zod)

---

## Development Approach

This project is driven by the `colloquium:project` skill:

1. **Bootstrap phase** — generate `app_spec.txt` and `feature_list.json` (265 test entries in behavioral syntax) for `apps/reddit-clone`
2. **Develop phase** — implement tests one by one, session-by-session, tracking progress in `project-state.json`
3. Each session picks up from `currentTestIndex` and implements until the next test passes
4. All state lives under `.claude/projects/reddit-clone/`
