import { describe, test, expect } from "vitest";
import { handleMemberAddedToChannel } from "./MemberAddedToChannelAcl";
import type { MemberAddedToChannelV1 } from "./MemberAddedToChannelAcl";
import { InvalidPayloadError, ChannelNotFoundError } from "./errors";
import { ChannelRepository, InMemoryChannelEventStore } from "./ChannelRepository";
import { Channel } from "./Channel";

function validPayload(overrides: Partial<MemberAddedToChannelV1> = {}): MemberAddedToChannelV1 {
  return { channelId: "ch-1", memberId: "user-42", grantedAt: 1000, ...overrides };
}

function makeRepo() {
  return new ChannelRepository(new InMemoryChannelEventStore());
}

/** Register a channel so the repo has it in Active state before granting membership */
function makeRepoWithChannel(channelId = "ch-1") {
  const store = new InMemoryChannelEventStore();
  const repo = new ChannelRepository(store);
  const channel = new Channel(channelId);
  const events = channel.registerChannel("ws-1");
  repo.save(channel, events);
  return repo;
}

// ── Payload validation ────────────────────────────────────────────────────────

describe("handleMemberAddedToChannel — payload validation", () => {
  test("throws InvalidPayloadError when channelId is an empty string", () => {
    expect(() => handleMemberAddedToChannel(validPayload({ channelId: "" }), makeRepoWithChannel()))
      .toThrow(InvalidPayloadError);
  });

  test("throws InvalidPayloadError when channelId is whitespace only", () => {
    expect(() => handleMemberAddedToChannel(validPayload({ channelId: "   " }), makeRepoWithChannel()))
      .toThrow(InvalidPayloadError);
  });

  test("throws InvalidPayloadError when memberId is an empty string", () => {
    expect(() => handleMemberAddedToChannel(validPayload({ memberId: "" }), makeRepoWithChannel()))
      .toThrow(InvalidPayloadError);
  });

  test("throws InvalidPayloadError when memberId is whitespace only", () => {
    expect(() => handleMemberAddedToChannel(validPayload({ memberId: "   " }), makeRepoWithChannel()))
      .toThrow(InvalidPayloadError);
  });

  test("does not call the domain when channelId is invalid — channel is not modified", () => {
    const repo = makeRepoWithChannel();
    try { handleMemberAddedToChannel(validPayload({ channelId: "" }), repo); } catch {}
    // Payload validation throws before repo.findById is called — no GrantChannelMembership is applied.
    // Verify via observable behaviour: user-42 still cannot post (membership was never granted).
    const loaded = repo.findById("ch-1")!;
    const result = loaded.postChannelMessage("user-42", "hello");
    expect(result[0].type).toBe("ChannelAccessDenied");
  });
});

// ── Channel not found ─────────────────────────────────────────────────────────

describe("handleMemberAddedToChannel — channel not found", () => {
  test("throws ChannelNotFoundError when channel is not in the repository", () => {
    const emptyRepo = makeRepo(); // no channels registered
    expect(() => handleMemberAddedToChannel(validPayload(), emptyRepo))
      .toThrow(ChannelNotFoundError);
  });

  test("does NOT create a new Channel when channel is not found", () => {
    const emptyRepo = makeRepo();
    try { handleMemberAddedToChannel(validPayload({ channelId: "ch-ghost" }), emptyRepo); } catch {}
    expect(emptyRepo.findById("ch-ghost")).toBeNull();
  });
});

// ── ACL mapping — CT-002 contract ────────────────────────────────────────────

describe("handleMemberAddedToChannel — ACL mapping (CT-002)", () => {
  test("grants membership so the member can post to the channel", () => {
    const repo = makeRepoWithChannel();
    handleMemberAddedToChannel(validPayload({ channelId: "ch-1", memberId: "user-42" }), repo);
    const channel = repo.findById("ch-1")!;
    const result = channel.postChannelMessage("user-42", "hello");
    expect(result[0].type).toBe("ChannelMessagePosted");
  });

  test("does not forward payload 'grantedAt' value into the domain command", () => {
    // The domain's ChannelMembershipGranted event has its own grantedAt (Date.now()).
    // This test verifies the adapter does NOT echo the payload's grantedAt value through.
    const SENTINEL = 99999; // far in the past — domain's Date.now() will never produce this
    const store = new InMemoryChannelEventStore();
    const repo = new ChannelRepository(store);
    const ch = new Channel("ch-1");
    repo.save(ch, ch.registerChannel("ws-1"));

    handleMemberAddedToChannel(validPayload({ grantedAt: SENTINEL }), repo);

    const events = store.load("ch-1");
    const membershipEvent = events.find(e => e.type === "ChannelMembershipGranted");
    // Domain generates its own timestamp via Date.now() — must not equal the payload sentinel
    expect((membershipEvent as any).grantedAt).not.toBe(SENTINEL);
  });

  test("is idempotent when called twice with identical payload (at-least-once delivery)", () => {
    const repo = makeRepoWithChannel();
    handleMemberAddedToChannel(validPayload(), repo);
    expect(() => handleMemberAddedToChannel(validPayload(), repo)).not.toThrow();
    // Member should still have access after duplicate delivery
    const channel = repo.findById("ch-1")!;
    const result = channel.postChannelMessage("user-42", "hello");
    expect(result[0].type).toBe("ChannelMessagePosted");
  });

  test("propagates error from grantChannelMembership for unexpected domain failures", () => {
    // Simulate an Archived channel by directly applying events to a channel, then trying to grant membership.
    // This is an indirect test: we verify the adapter does NOT swallow domain errors.
    // We use a channel in Unregistered state (no registerChannel called) to trigger the domain's own guard.
    const store = new InMemoryChannelEventStore();
    const repo = new ChannelRepository(store);
    const ch = new Channel("ch-unregistered");
    repo.save(ch, []); // save without registering — channel stays Unregistered
    expect(() =>
      handleMemberAddedToChannel(validPayload({ channelId: "ch-unregistered" }), repo)
    ).toThrow();
  });
});

// ── Integration: full repo round-trip ────────────────────────────────────────

describe("handleMemberAddedToChannel — integration", () => {
  test("member has posting rights after handler runs, verified on fresh load from repo", () => {
    const store = new InMemoryChannelEventStore();
    const repo = new ChannelRepository(store);
    // Register channel
    const ch = new Channel("ch-1");
    repo.save(ch, ch.registerChannel("ws-1"));
    // Grant membership via ACL adapter
    handleMemberAddedToChannel(validPayload({ channelId: "ch-1", memberId: "user-42" }), repo);
    // Load fresh from store (simulates a new request loading from persisted events)
    const loaded = repo.findById("ch-1")!;
    const result = loaded.postChannelMessage("user-42", "hello from integration");
    expect(result[0].type).toBe("ChannelMessagePosted");
  });

  test("idempotent second grant does not duplicate membership events in store", () => {
    const store = new InMemoryChannelEventStore();
    const repo = new ChannelRepository(store);
    const ch = new Channel("ch-1");
    repo.save(ch, ch.registerChannel("ws-1"));

    handleMemberAddedToChannel(validPayload({ channelId: "ch-1", memberId: "user-42" }), repo);
    handleMemberAddedToChannel(validPayload({ channelId: "ch-1", memberId: "user-42" }), repo);

    const events = store.load("ch-1");
    const membershipEvents = events.filter(e => e.type === "ChannelMembershipGranted");
    // Idempotent — only one ChannelMembershipGranted event should exist
    expect(membershipEvents).toHaveLength(1);
  });
});
