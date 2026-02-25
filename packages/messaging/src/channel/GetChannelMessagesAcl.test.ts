import { describe, test, expect } from "vitest";
import { Channel } from "./Channel";
import type { ChannelMessagePosted } from "./Channel";
import { ChannelRepository, InMemoryChannelEventStore } from "./ChannelRepository";
import { handleGetChannelMessages, type GetChannelMessagesPayload } from "./GetChannelMessagesAcl";
import { InvalidPayloadError, ChannelNotFoundError, ChannelAccessDeniedError } from "./errors";

// ── Helpers ───────────────────────────────────────────────────────────────────

function validPayload(
  overrides: Partial<GetChannelMessagesPayload> = {}
): GetChannelMessagesPayload {
  return { channelId: "ch-1", requesterId: "user-42", ...overrides };
}

function makeRepoWithMember(channelId = "ch-1", memberId = "user-42") {
  const store = new InMemoryChannelEventStore();
  const repo = new ChannelRepository(store);
  const ch = new Channel(channelId);
  const [registered] = ch.registerChannel("ws-1");
  repo.save(ch, [registered]);
  const ch2 = repo.findById(channelId)!;
  const [membership] = ch2.grantChannelMembership(memberId);
  repo.save(ch2, [membership]);
  return repo;
}

function makeRepoWithMessages(count: number, channelId = "ch-1", memberId = "user-42") {
  const repo = makeRepoWithMember(channelId, memberId);
  for (let i = 0; i < count; i++) {
    const ch = repo.findById(channelId)!;
    const events = ch.postChannelMessage(memberId, `message ${i + 1}`);
    const posted = events.find(
      (e): e is ChannelMessagePosted => e.type === "ChannelMessagePosted"
    )!;
    repo.save(ch, [posted]);
  }
  return repo;
}

// ── Payload validation ────────────────────────────────────────────────────────

describe("handleGetChannelMessages — payload validation", () => {
  test("throws InvalidPayloadError when channelId is empty string", () => {
    const repo = makeRepoWithMember();
    expect(() => handleGetChannelMessages(validPayload({ channelId: "" }), repo)).toThrow(
      InvalidPayloadError
    );
  });

  test("throws InvalidPayloadError when requesterId is empty string", () => {
    const repo = makeRepoWithMember();
    expect(() => handleGetChannelMessages(validPayload({ requesterId: "" }), repo)).toThrow(
      InvalidPayloadError
    );
  });

  test("throws InvalidPayloadError when limit is 0", () => {
    const repo = makeRepoWithMember();
    expect(() => handleGetChannelMessages(validPayload({ limit: 0 }), repo)).toThrow(
      InvalidPayloadError
    );
  });

  test("throws InvalidPayloadError when limit exceeds 50", () => {
    const repo = makeRepoWithMember();
    expect(() => handleGetChannelMessages(validPayload({ limit: 51 }), repo)).toThrow(
      InvalidPayloadError
    );
  });

  test("throws InvalidPayloadError when before is 0 (must be positive integer)", () => {
    const repo = makeRepoWithMember();
    expect(() => handleGetChannelMessages(validPayload({ before: 0 }), repo)).toThrow(
      InvalidPayloadError
    );
  });
});

// ── Channel not found ─────────────────────────────────────────────────────────

describe("handleGetChannelMessages — channel not found", () => {
  test("throws ChannelNotFoundError when channel does not exist", () => {
    const store = new InMemoryChannelEventStore();
    const repo = new ChannelRepository(store);
    expect(() => handleGetChannelMessages(validPayload({ channelId: "ghost" }), repo)).toThrow(
      ChannelNotFoundError
    );
  });
});

// ── Membership enforcement ────────────────────────────────────────────────────

describe("handleGetChannelMessages — membership enforcement", () => {
  test("throws ChannelAccessDeniedError when requester is not a channel member", () => {
    const repo = makeRepoWithMember("ch-1", "user-42");
    expect(() => handleGetChannelMessages(validPayload({ requesterId: "stranger" }), repo)).toThrow(
      ChannelAccessDeniedError
    );
  });

  test("does not throw when requester is a channel member", () => {
    const repo = makeRepoWithMember("ch-1", "user-42");
    expect(() =>
      handleGetChannelMessages(validPayload({ requesterId: "user-42" }), repo)
    ).not.toThrow();
  });
});

// ── Response shape ────────────────────────────────────────────────────────────

describe("handleGetChannelMessages — response shape", () => {
  test("returns an object with messages array and nextCursor field", () => {
    const repo = makeRepoWithMember();
    const result = handleGetChannelMessages(validPayload(), repo);
    expect(result).toHaveProperty("messages");
    expect(result).toHaveProperty("nextCursor");
    expect(Array.isArray(result.messages)).toBe(true);
  });

  test("each message item has CT-004 fields: messageId, authorId, content, sequenceNumber, postedAt", () => {
    const repo = makeRepoWithMessages(1);
    const result = handleGetChannelMessages(validPayload(), repo);
    expect(result.messages).toHaveLength(1);
    const msg = result.messages[0];
    expect(msg).toMatchObject({
      messageId: expect.any(String),
      authorId: "user-42",
      content: "message 1",
      sequenceNumber: 1,
    });
    expect(typeof msg.postedAt).toBe("string");
  });

  test("postedAt is a valid ISO 8601 UTC string", () => {
    const repo = makeRepoWithMessages(1);
    const result = handleGetChannelMessages(validPayload(), repo);
    const msg = result.messages[0];
    expect(new Date(msg.postedAt).toISOString()).toBe(msg.postedAt);
  });

  test("messages are returned in descending sequenceNumber order (newest first, CT-004)", () => {
    const repo = makeRepoWithMessages(3);
    const result = handleGetChannelMessages(validPayload(), repo);
    const seqs = result.messages.map((m) => m.sequenceNumber);
    expect(seqs).toEqual([3, 2, 1]);
  });
});

// ── Pagination ────────────────────────────────────────────────────────────────

describe("handleGetChannelMessages — pagination", () => {
  test("returns empty messages array and null nextCursor when channel has no messages", () => {
    const repo = makeRepoWithMember();
    const result = handleGetChannelMessages(validPayload(), repo);
    expect(result.messages).toStrictEqual([]);
    expect(result.nextCursor).toBeNull();
  });

  test("nextCursor is null when returned message count is less than limit", () => {
    const repo = makeRepoWithMessages(3);
    const result = handleGetChannelMessages(validPayload({ limit: 50 }), repo);
    expect(result.messages).toHaveLength(3);
    expect(result.nextCursor).toBeNull();
  });

  test("nextCursor is a non-null string when returned message count equals limit", () => {
    const repo = makeRepoWithMessages(5);
    const result = handleGetChannelMessages(validPayload({ limit: 3 }), repo);
    expect(result.messages).toHaveLength(3);
    expect(typeof result.nextCursor).toBe("string");
  });

  test("nextCursor equals the sequenceNumber of the oldest message in the page (as a string)", () => {
    const repo = makeRepoWithMessages(5);
    // limit=3 → page is [seq5, seq4, seq3] (newest-first); oldest in page = seq 3
    const result = handleGetChannelMessages(validPayload({ limit: 3 }), repo);
    expect(result.messages[0].sequenceNumber).toBe(5); // newest first
    expect(result.messages[2].sequenceNumber).toBe(3); // oldest last
    expect(result.nextCursor).toBe("3");
  });

  test("fetching with before cursor returns the correct older page", () => {
    const repo = makeRepoWithMessages(5);
    // Page 1: limit=3, no cursor → [seq5, seq4, seq3] (newest-first); nextCursor="3"
    const page1 = handleGetChannelMessages(validPayload({ limit: 3 }), repo);
    const cursor = Number(page1.nextCursor!);
    // Page 2: before=3 → [seq2, seq1] (newest-first); count < limit → nextCursor=null
    const page2 = handleGetChannelMessages(validPayload({ limit: 3, before: cursor }), repo);
    expect(page2.messages).toHaveLength(2);
    expect(page2.messages.map((m) => m.sequenceNumber)).toEqual([2, 1]);
    expect(page2.nextCursor).toBeNull();
  });
});

// ── CT-004 contract ───────────────────────────────────────────────────────────

describe("handleGetChannelMessages — CT-004 contract", () => {
  test("message items contain exactly the CT-004 fields and no domain-internal fields", () => {
    const repo = makeRepoWithMessages(2);
    // limit=1 so nextCursor is non-null (exercises both branches of the contract)
    const result = handleGetChannelMessages(validPayload({ limit: 1 }), repo);
    const msg = result.messages[0];

    // Required fields present with correct types
    expect(typeof msg.messageId).toBe("string");
    expect(typeof msg.authorId).toBe("string");
    expect(typeof msg.content).toBe("string");
    expect(typeof msg.sequenceNumber).toBe("number");
    expect(typeof msg.postedAt).toBe("string");
    // postedAt must round-trip through Date.toISOString()
    expect(new Date(msg.postedAt).toISOString()).toBe(msg.postedAt);

    // Domain-internal fields must NOT be present
    expect(msg).not.toHaveProperty("seq");
    expect(msg).not.toHaveProperty("channelId");
    expect(msg).not.toHaveProperty("mentionedIds");
    expect(msg).not.toHaveProperty("type");

    // nextCursor is a string when count === limit
    expect(typeof result.nextCursor).toBe("string");
  });
});
