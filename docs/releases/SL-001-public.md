# SL-001 Release Note

**Released:** 2026-02-25
**Slice:** channel-message-delivery

## What Ships

The Messaging BC's core channel-message delivery infrastructure is complete. A workspace member can post a message to a channel, the message is persisted with a monotonic sequence number, and the full fanout pipeline routes it to all connected WebSocket sessions in real time. Members who briefly disconnect reconnect with a `lastKnownSeq` value; the server detects the sequence-number gap and delivers any missed messages as a catch-up batch before resuming the live feed — guaranteeing zero message loss across reconnect cycles. This slice delivers the full in-process domain model and coordinator; real WebSocket wire framing (HTTP upgrade, frame encoding) will be wired in a subsequent transport slice.

## Features

- feat-001: channel-aggregate ✅
- feat-002: channel-created-acl-wiring ✅
- feat-003: member-added-to-channel-acl-wiring ✅
- feat-004: channel-message-posted-event-emission ✅
- feat-005: channel-feed-view ✅
- feat-006: channel-sequence-head ✅
- feat-007: messages-since-seq ✅
- feat-008: websocket-session-aggregate ✅
- feat-009: active-sessions-for-channel (FanoutCoordinator) ✅

## Flags Promoted

No feature flags.

## Known Issues

- Real WebSocket transport (HTTP upgrade handler, wire framing) is not wired in SL-001. The end-to-end reconnect + catch-up + live fanout journey is exercised entirely via in-process integration tests. The full Playwright E2E step documented in each feature's uat.md is deferred to the transport-layer slice.
- `@colloquium/reddit-clone-api` reports "No test files found" in the monorepo-wide test run. Pre-existing condition unrelated to this slice.

## Cleanup Tasks

None.
