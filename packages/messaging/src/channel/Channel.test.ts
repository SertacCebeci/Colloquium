import { describe, test, expect } from "vitest";
import { Channel } from "./Channel";
import type { ChannelEvent } from "./Channel";

// ── helpers ──────────────────────────────────────────────────────────────────

function activeChannel(): Channel {
  const ch = new Channel("ch-1");
  ch.registerChannel("ws-1");
  return ch;
}

function activeChannelWithMember(memberId: string): Channel {
  const ch = activeChannel();
  ch.grantChannelMembership(memberId);
  return ch;
}

function archivedChannel(): Channel {
  const ch = new Channel("ch-1");
  // Archived state is future — reached only via event sourcing replay.
  // Apply directly to set up the precondition.
  ch.apply({ type: "ChannelRegistered", channelId: "ch-1", workspaceId: "ws-1", registeredAt: 1000 });
  ch.apply({ type: "ChannelArchived", channelId: "ch-1", archivedAt: 2000 });
  return ch;
}

// ── RegisterChannel ───────────────────────────────────────────────────────────

describe("RegisterChannel", () => {
  test("transitions Unregistered → Active and emits ChannelRegistered", () => {
    const channel = new Channel("ch-1");
    const events = channel.registerChannel("ws-1");
    expect(channel.state).toBe("Active");
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "ChannelRegistered",
      channelId: "ch-1",
      workspaceId: "ws-1",
    });
    expect(typeof (events[0] as { registeredAt: number }).registeredAt).toBe("number");
  });

  test("is idempotent when called again with the same workspaceId", () => {
    const channel = new Channel("ch-1");
    channel.registerChannel("ws-1");
    const events = channel.registerChannel("ws-1");
    expect(events).toHaveLength(0);
    expect(channel.state).toBe("Active");
  });

  test("throws when same channelId is re-registered with a different workspaceId", () => {
    const channel = new Channel("ch-1");
    channel.registerChannel("ws-1");
    expect(() => channel.registerChannel("ws-2")).toThrow();
  });

  test("throws when channel is Archived", () => {
    expect(() => archivedChannel().registerChannel("ws-1")).toThrow();
  });
});

// ── GrantChannelMembership ────────────────────────────────────────────────────

describe("GrantChannelMembership", () => {
  test("adds member to allowedPosters and emits ChannelMembershipGranted", () => {
    const channel = activeChannel();
    const events = channel.grantChannelMembership("user-1");
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "ChannelMembershipGranted",
      channelId: "ch-1",
      memberId: "user-1",
    });
    expect(typeof (events[0] as { grantedAt: number }).grantedAt).toBe("number");
  });

  test("is idempotent when member is already in allowedPosters", () => {
    const channel = activeChannelWithMember("user-1");
    const events = channel.grantChannelMembership("user-1");
    expect(events).toHaveLength(0);
  });

  test("throws when channel is Archived", () => {
    expect(() => archivedChannel().grantChannelMembership("user-1")).toThrow();
  });
});

// ── PostChannelMessage ────────────────────────────────────────────────────────

describe("PostChannelMessage", () => {
  test("emits ChannelMessagePosted for an authorised poster with valid content", () => {
    const channel = activeChannelWithMember("user-1");
    const events = channel.postChannelMessage("user-1", "Hello");
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "ChannelMessagePosted",
      channelId: "ch-1",
      authorId: "user-1",
      content: "Hello",
      seq: 1,
      mentionedIds: [],
    });
    expect(typeof (events[0] as { messageId: string }).messageId).toBe("string");
    expect(typeof (events[0] as { postedAt: number }).postedAt).toBe("number");
  });

  test("seq increments strictly for successive posts in the same channel", () => {
    const channel = activeChannelWithMember("user-1");
    const [first] = channel.postChannelMessage("user-1", "Hello");
    const [second] = channel.postChannelMessage("user-1", "World");
    expect((first as { seq: number }).seq).toBe(1);
    expect((second as { seq: number }).seq).toBe(2);
  });

  test("emits ChannelAccessDenied when authorId is not in allowedPosters", () => {
    const channel = activeChannel(); // no members granted
    const events = channel.postChannelMessage("unknown-user", "Hello");
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "ChannelAccessDenied",
      channelId: "ch-1",
      authorId: "unknown-user",
    });
  });

  test("does not increment seq when access is denied", () => {
    const channel = activeChannelWithMember("user-1");
    channel.postChannelMessage("unknown-user", "Hello"); // denied
    const [event] = channel.postChannelMessage("user-1", "World"); // succeeds
    expect((event as { seq: number }).seq).toBe(1); // seq was NOT advanced by the denied attempt
  });

  test("emits MessageValidationFailed(EMPTY_CONTENT) when content is whitespace only", () => {
    const channel = activeChannelWithMember("user-1");
    const events = channel.postChannelMessage("user-1", "   ");
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "MessageValidationFailed",
      channelId: "ch-1",
      authorId: "user-1",
      reason: "EMPTY_CONTENT",
    });
  });

  test("emits MessageValidationFailed(EMPTY_CONTENT) when content is an empty string", () => {
    const channel = activeChannelWithMember("user-1");
    const events = channel.postChannelMessage("user-1", "");
    expect(events[0]).toMatchObject({ type: "MessageValidationFailed", reason: "EMPTY_CONTENT" });
  });

  test("accepts a message of exactly 4000 characters", () => {
    const channel = activeChannelWithMember("user-1");
    const events = channel.postChannelMessage("user-1", "a".repeat(4000));
    expect(events[0]).toMatchObject({ type: "ChannelMessagePosted" });
  });

  test("emits MessageValidationFailed(CONTENT_TOO_LONG) when content is 4001 characters", () => {
    const channel = activeChannelWithMember("user-1");
    const events = channel.postChannelMessage("user-1", "a".repeat(4001));
    expect(events[0]).toMatchObject({ type: "MessageValidationFailed", reason: "CONTENT_TOO_LONG" });
  });

  test("throws when channel is Archived", () => {
    expect(() => archivedChannel().postChannelMessage("user-1", "Hello")).toThrow();
  });

  test("throws when channel is Unregistered", () => {
    const channel = new Channel("ch-1");
    expect(() => channel.postChannelMessage("user-1", "Hello")).toThrow();
  });
});

// ── Event sourcing: hydration from event stream ───────────────────────────────

describe("Event sourcing: hydration from event stream", () => {
  test("reconstructs Active state from ChannelRegistered", () => {
    const channel = new Channel("ch-1");
    channel.apply({ type: "ChannelRegistered", channelId: "ch-1", workspaceId: "ws-1", registeredAt: 1000 });
    expect(channel.state).toBe("Active");
  });

  test("reconstructs member access rights from ChannelMembershipGranted", () => {
    const channel = new Channel("ch-1");
    channel.apply({ type: "ChannelRegistered", channelId: "ch-1", workspaceId: "ws-1", registeredAt: 1000 });
    channel.apply({ type: "ChannelMembershipGranted", channelId: "ch-1", memberId: "user-1", grantedAt: 2000 });
    // member access is correct if posting succeeds
    const [event] = channel.postChannelMessage("user-1", "hello");
    expect(event).toMatchObject({ type: "ChannelMessagePosted" });
  });

  test("reconstructs seq counter from prior ChannelMessagePosted events", () => {
    const channel = new Channel("ch-1");
    channel.apply({ type: "ChannelRegistered", channelId: "ch-1", workspaceId: "ws-1", registeredAt: 1000 });
    channel.apply({ type: "ChannelMembershipGranted", channelId: "ch-1", memberId: "user-1", grantedAt: 2000 });
    channel.apply({
      type: "ChannelMessagePosted",
      channelId: "ch-1",
      messageId: "msg-1",
      authorId: "user-1",
      content: "hi",
      seq: 5,
      postedAt: 3000,
      mentionedIds: [],
    });
    const [event] = channel.postChannelMessage("user-1", "world");
    expect((event as { seq: number }).seq).toBe(6);
  });
});
