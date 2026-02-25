# UAT — member-added-to-channel-acl-wiring (feat-003)

**Result:** PASS
**Date:** 2026-02-25
**Feature:** feat-003 — member-added-to-channel-acl-wiring
**Slice:** SL-001

---

## Steps Executed

This feature is a stateless in-process ACL adapter with no HTTP endpoint or UI surface.
E2E/Playwright UAT is not applicable — the automated test suite constitutes the UAT evidence.
Full bus-wiring UAT is deferred to the slice's future message-bus feature (per spec).

| Step | Action | Expected | Observed | Result |
| ---- | ------ | -------- | -------- | ------ |
| 1 | **Payload validation** — missing / blank `channelId` → `InvalidPayloadError` thrown before domain call; missing / blank `memberId` → same | Validation errors thrown; no Channel is loaded or modified | MemberAddedToChannelAcl.test.ts validation cases: 4/4 PASS | ✅ |
| 2 | **Channel-not-found guard** — `repo.findById` returns null → `ChannelNotFoundError` thrown; adapter does NOT create a new Channel | `ChannelNotFoundError` propagates; no new Channel instantiated | 1/1 PASS — confirmed via mock spy that `repo.save` was never called | ✅ |
| 3 | **CT-002 contract mapping** — `channelId` and `memberId` forwarded to `GrantChannelMembership`; `grantedAt` NOT forwarded (discarded) | Command issued with only `channelId` + `memberId`; no `grantedAt` field in domain call | 3/3 PASS — spy confirms args; `grantedAt` absent from domain interaction | ✅ |
| 4 | **Idempotency** — duplicate `MemberAddedToChannel` for same `(channelId, memberId)` → `grantChannelMembership` returns `[]`; adapter returns normally; no second event persisted | No error; `allowedPosters` unchanged after second call | 2/2 PASS — idempotent return confirmed; save called once only | ✅ |
| 5 | **Integration round-trip** — call `handleMemberAddedToChannel` with valid payload; `repo.findById(channelId)` returns channel whose `allowedPosters` includes `memberId` | Member persisted via `ChannelRepository` | 3/3 PASS — integration tests using real in-memory repository | ✅ |

**Total: 13/13 MemberAddedToChannelAcl tests PASS (within 49/49 suite-wide PASS)**

---

## Screenshots

Not applicable — no browser surface. Pure in-process adapter.

---

## Deferred UAT Step (to be run at bus-wiring feature C7)

When a real message-bus consumer is wired:

1. Publish a `MemberAddedToChannel` event to the bus for a registered channel
2. Verify that `repo.findById(channelId)` returns a Channel whose `allowedPosters` includes `memberId`
3. Verify that a subsequent `PostChannelMessage` from that member succeeds (no access-denied error)

This step must pass before the bus-wiring feature is marked C7.

---

## Regressions Checked

| Feature | Golden-path step re-run | Result |
| ------- | ----------------------- | ------ |
| feat-001 — channel-aggregate | Re-run 20 domain unit tests (Channel.test.ts) — suite-wide run: 49/49 | ✅ 20/20 PASS |
| feat-002 — channel-created-acl-wiring | Re-run 11 adapter tests (ChannelCreatedAcl.test.ts) — suite-wide run: 49/49 | ✅ 11/11 PASS |

---

## Known Issues

None.
