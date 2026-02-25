# UAT — channel-message-posted-event-emission (feat-004)

**Result:** PASS
**Date:** 2026-02-25
**Feature:** feat-004 — channel-message-posted-event-emission
**Slice:** SL-001

---

## Steps Executed

This feature is a stateless in-process ACL adapter with no HTTP endpoint or UI surface.
E2E/Playwright UAT is not applicable — the spec explicitly states: "E2E: Not applicable — in-process stub, no HTTP surface in SL-001. Covered transitively when the HTTP `POST /channels/:id/messages` endpoint is wired (future slice)."
The automated test suite constitutes the UAT evidence.

| Step | Action | Expected | Observed | Result |
| ---- | ------ | -------- | -------- | ------ |
| 1 | **Payload validation (6 cases)** — missing/blank `channelId` → `InvalidPayloadError`; missing/blank `authorId` → same; missing/blank `content` → same; all thrown before domain is loaded | `InvalidPayloadError` thrown in all 6 cases; no Channel loaded or mutated | 6/6 PASS (PostChannelMessageAcl.test.ts) | ✅ |
| 2 | **Channel-not-found (2 cases)** — `repo.findById` returns null → `ChannelNotFoundError` thrown; confirm `repo.save` not called | `ChannelNotFoundError` propagates; adapter does not create or mutate any Channel | 2/2 PASS — spy confirms `repo.save` never invoked | ✅ |
| 3 | **Domain failure propagation (6 cases)** — unauthorised `authorId` → `ChannelAccessDeniedError` with `{ channelId, authorId }`; whitespace-only content → `MessageValidationFailedError(EMPTY_CONTENT)`; 4001-char content → `MessageValidationFailedError(CONTENT_TOO_LONG)`; confirm no CT-003 payload returned on any domain rejection | Typed errors propagate correctly; `repo.save` not called on domain rejection | 6/6 PASS | ✅ |
| 4 | **CT-003 contract mapping (9 cases)** — valid payload → returned `ChannelMessagePostedV1` contains all 7 fields; `channelId`/`authorId`/`content` match input; `messageId` non-empty; `seq ≥ 1`; `postedAt` positive integer; `mentionedIds = []`; two successive calls → `seq₂ > seq₁` | All 7 CT-003 fields present and correct; monotonic `seq`; `mentionedIds` always `[]` | 9/9 PASS | ✅ |
| 5 | **CT-003 producer contract (3 cases)** — adapter does NOT return CT-003 payload on domain failure; no CT-003 emitted if `repo.save` not reached; adapter does NOT swallow domain errors | No payload leaks on failure paths | 3/3 PASS | ✅ |
| 6 | **Integration round-trip (2 cases)** — after `handlePostChannelMessage`, `repo.findById(channelId)` returns Channel whose event log includes `ChannelMessagePosted` with the returned `seq`; two successive calls produce distinct `messageId` values | Event persisted; `seq` in persisted event matches returned CT-003 payload; `messageId` values are distinct | 2/2 PASS (real in-memory ChannelRepository) | ✅ |

**Total: 31/31 PostChannelMessageAcl tests PASS (within 80/80 suite-wide PASS)**

---

## Screenshots

Not applicable — no browser surface. Pure in-process adapter.

---

## Deferred UAT Step (to be run at future HTTP endpoint feature C7)

When the HTTP `POST /channels/:id/messages` endpoint is wired (future SL-001 feature):

1. POST a message from an authorised member to a registered channel
2. Verify the response contains a `ChannelMessagePostedV1` payload with all 7 CT-003 fields: `channelId`, `messageId`, `authorId`, `content`, `seq`, `postedAt`, `mentionedIds`
3. Confirm `seq` is strictly greater than the `seq` of any previously emitted `ChannelMessagePostedV1` for the same `channelId`
4. Confirm `mentionedIds` is `[]` in SL-001

This step supersedes and closes the deferred step recorded in feat-001's uat.md.

---

## Regressions Checked

| Feature | Golden-path step re-run | Result |
| ------- | ----------------------- | ------ |
| feat-001 — channel-aggregate | Re-run 20 domain unit tests (Channel.test.ts) — suite-wide run: 80/80 | ✅ 20/20 PASS |
| feat-002 — channel-created-acl-wiring | Re-run 11 adapter tests (ChannelCreatedAcl.test.ts) — suite-wide run: 80/80 | ✅ 11/11 PASS |
| feat-003 — member-added-to-channel-acl-wiring | Re-run 13 adapter tests (MemberAddedToChannelAcl.test.ts) — suite-wide run: 80/80 | ✅ 13/13 PASS |

---

## Known Issues

None.
