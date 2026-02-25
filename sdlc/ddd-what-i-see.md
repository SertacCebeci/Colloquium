You’d see a **stream of artifacts + decisions + demos** moving through the DDD state machines. Concretely: you don’t “see work”; you see **evidence** that gates are being satisfied.

Below is what you would actually observe from an employee following the event-bounded DDD SDLC—what shows up in your inbox/PRs/demos, in what order, and what questions they’ll ask you.

---

## 1) First things you see (very early)

### A) A 1–2 page “Intent + Constraints” write-up

You receive:

- `intent.md` with:
  - mission (“enable creators to publish videos; enable viewers to discover/watch”)
  - non-goals (e.g., “no ad marketplace, no live streaming, no multi-region”)
  - success metrics + guardrails
  - top risks/unknowns (copyright, storage costs, video processing)

**What you see as the manager:** a crisp scope boundary that prevents “YouTube means everything.”

### B) A domain glossary (Ubiquitous Language seed)

You see a short list of terms and definitions:

- Video, Upload, Publish, Playback Session, Channel, Comment Thread, Moderation Action, Visibility, etc.

**Manager benefit:** everyone uses the same words.

---

## 2) Next, you see Strategic DDD outputs (boundaries)

### C) Subdomains + bounded contexts + context map (draft)

You receive a doc set like:

- `subdomains.md`: core vs supporting vs generic
- `bounded-contexts.md`: proposed contexts (examples)
  - **Publishing** (upload → process → publish)
  - **Playback** (watch sessions, stream access)
  - **Engagement** (likes, comments, subscriptions)
  - **Trust & Safety** (reporting, moderation, policy enforcement)
  - **Identity & Access** (accounts, authz)

- `context-map.md`: how they integrate (events/APIs), where ACLs apply

**What you see:** a boundary proposal + integration plan, not a giant architecture diagram.

**What you might need to answer:** “Do we treat moderation as its own capability or as part of engagement for MVP1?”

---

## 3) Then you see the first “Capability Slice” selection (the real start)

### D) Slice SL-001 proposed: “Upload → Publish → Watch”

You’ll get:

- a one-page slice narrative:
  - user journey in plain language
  - non-goals
  - success/failure/guardrail metrics

- clear list of contexts involved (likely Publishing + Playback + Identity)

**You see a decision:** _this is MVP1, not ‘all of YouTube’._

---

## 4) You see Event Storming output (how it behaves)

### E) Event storm doc with commands/events/policies

Example sections you’ll see:

**Commands**

- `UploadVideo`
- `StartProcessing`
- `PublishVideo`
- `StartPlaybackSession`

**Domain events**

- `VideoUploadRequested`
- `VideoUploaded`
- `VideoProcessingStarted`
- `VideoProcessingSucceeded` / `VideoProcessingFailed`
- `VideoPublished`
- `PlaybackSessionStarted`

**Policies**

- “When `VideoUploaded` then enqueue processing”
- “When processing succeeded, allow publish”

**What you see:** the business flow as an event chain with explicit decisions.

---

## 5) You see the model commitment (aggregates + invariants)

### F) Aggregate definitions + state machines

You’ll see something like:

**Aggregate: Video (Publishing context)**

- States: Draft → Uploaded → Processing → Published → Failed
- Invariants:
  - only owner can publish/delete
  - cannot publish unless processing succeeded
  - cannot watch unless published + visibility permits

**Aggregate: PlaybackSession (Playback context)**

- Invariants:
  - playback requires published video and a valid access decision

**What you see:** stability: “this won’t become spaghetti because invariants are written and tested.”

---

## 6) You see contracts (integration rules you can hold them to)

### G) Contracts for cross-context integration

You’ll see contract files like:

- `VideoPublished.v1` event schema + semantics
- `GetVideoPlaybackUrl` API contract (if used)
- versioning rules (“backward compatible fields only”)

**Manager benefit:** you can say “don’t break this contract” and it means something.

---

## 7) During implementation you see PRs that look like “domain first”

### H) PR pattern you’ll repeatedly see

Each meaningful PR includes:

- domain model changes + domain tests
- contract or integration tests
- flag added (if non-trivial)
- telemetry added (success/failure/guardrail)
- docs updated (feature pack/policy/contract)

**What you see as signals:**

- tests are not an afterthought
- shipping is incremental, behind flags
- docs aren’t essays—they’re gates

---

## 8) You see policy docs for cross-cutting behavior (later slices)

When they get to engagement/moderation, you’ll see:

- `policies/PL-xxx-lock-comments-on-threshold.md`
  - trigger event
  - condition
  - command issued
  - idempotency + retries
  - test strategy

**You see cross-cutting complexity being handled explicitly** instead of hidden “if” conditions scattered everywhere.

---

## 9) You see “promotion requests” instead of “it’s done”

### I) Flag promotion proposals (evidence-based)

They’ll come to you with:

- “Feature flag `video_publish` is ready to move Internal → Beta”
- evidence:
  - UAT checklist passed
  - failure metric below threshold
  - guardrail metrics stable

**You see:** operational maturity, like big companies.

---

## 10) What you see at slice completion (the deliverable)

For each slice (like SL-001), you get:

- a demo (end-to-end behind flag)
- UAT sheet with results
- release note (internal/public)
- known issues + cleanup list (flags to remove, debt to pay)

**This repeats slice by slice** until “YouTube-like” coverage is achieved.

---

# The “dashboard” you’d naturally have as a manager

If you had to summarize what you see week-to-week (even though it’s not timeboxed), it’s:

1. **Current slice state**: B0/B1/B2/B3/B4/B5
2. **Active work item**: C0→C7 status (only one at a time)
3. **Flags**: internal/beta/on + promotion criteria
4. **Metrics**: success/failure/guardrails
5. **UAT**: latest pass/fail + regressions

---

# What you should NOT see (red flags)

If they’re following the process, you should not see:

- giant PRs that “implement everything”
- no state machines / no invariants
- contracts changing casually
- shipping without flags and without telemetry
- a backlog of “we’ll test later”

---

## If you want, I can give you a “manager view template”

A one-page status template your employee fills out after every transition event (e.g., “B2 passed”, “B3 passed”, “flag promoted”) so you can track it without micromanaging.
