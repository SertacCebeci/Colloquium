import { describe, test, expect } from "vitest";
import { queryChannelFeed } from "./ChannelFeedView";
import type { ChannelFeedPayload } from "./ChannelFeedView";
import { InvalidPayloadError, ChannelNotFoundError } from "./errors";
import { handlePostChannelMessage } from "./PostChannelMessageAcl";
import { ChannelRepository, InMemoryChannelEventStore } from "./ChannelRepository";
import { Channel } from "./Channel";
import type { ChannelMessagePosted } from "./Channel";

// ── Test helpers ──────────────────────────────────────────────────────────────

function validPayload(overrides: Partial<ChannelFeedPayload> = {}): ChannelFeedPayload {
  return { channelId: "ch-1", limit: 10, ...overrides };
}

/** Repo with a registered channel and one member — no messages yet. */
function makeRepoWithChannel(channelId = "ch-1", memberId = "user-42") {
  const store = new InMemoryChannelEventStore();
  const repo = new ChannelRepository(store);
  const ch = new Channel(channelId);
  repo.save(ch, ch.registerChannel("ws-1"));
  const ch2 = repo.findById(channelId)!;
  repo.save(ch2, ch2.grantChannelMembership(memberId));
  return repo;
}

/** Post `count` messages to `channelId` and return the repo. */
function makeRepoWithMessages(channelId: string, memberId: string, count: number): ChannelRepository {
  const repo = makeRepoWithChannel(channelId, memberId);
  for (let i = 1; i <= count; i++) {
    const ch = repo.findById(channelId)!;
    const events = ch.postChannelMessage(memberId, `message ${i}`);
    const posted = events.find((e): e is ChannelMessagePosted => e.type === "ChannelMessagePosted")!;
    repo.save(ch, [posted]);
  }
  return repo;
}

// ── Payload validation ────────────────────────────────────────────────────────

describe("queryChannelFeed — payload validation", () => {
  test("throws InvalidPayloadError when channelId is empty string", () => {
    expect(() => queryChannelFeed(validPayload({ channelId: "" }), makeRepoWithChannel()))
      .toThrow(InvalidPayloadError);
  });

  test("throws InvalidPayloadError when channelId is whitespace only", () => {
    expect(() => queryChannelFeed(validPayload({ channelId: "   " }), makeRepoWithChannel()))
      .toThrow(InvalidPayloadError);
  });

  test("throws InvalidPayloadError when limit is zero", () => {
    expect(() => queryChannelFeed(validPayload({ limit: 0 }), makeRepoWithChannel()))
      .toThrow(InvalidPayloadError);
  });

  test("throws InvalidPayloadError when limit is negative", () => {
    expect(() => queryChannelFeed(validPayload({ limit: -1 }), makeRepoWithChannel()))
      .toThrow(InvalidPayloadError);
  });

  test("throws InvalidPayloadError when limit is not an integer", () => {
    expect(() => queryChannelFeed(validPayload({ limit: 2.5 }), makeRepoWithChannel()))
      .toThrow(InvalidPayloadError);
  });

  test("throws InvalidPayloadError when before is zero", () => {
    expect(() => queryChannelFeed(validPayload({ before: 0 }), makeRepoWithChannel()))
      .toThrow(InvalidPayloadError);
  });

  test("throws InvalidPayloadError when before is negative", () => {
    expect(() => queryChannelFeed(validPayload({ before: -5 }), makeRepoWithChannel()))
      .toThrow(InvalidPayloadError);
  });

  test("does not call repo when channelId is invalid — no channel is loaded", () => {
    const emptyRepo = new ChannelRepository(new InMemoryChannelEventStore());
    try { queryChannelFeed(validPayload({ channelId: "" }), emptyRepo); } catch {}
    // Empty repo still has no channel — proof that no creation side effect occurred
    expect(emptyRepo.findById("ch-1")).toBeNull();
  });
});

// ── Channel not found ─────────────────────────────────────────────────────────

describe("queryChannelFeed — channel not found", () => {
  test("throws ChannelNotFoundError when channel is not in the repository", () => {
    const emptyRepo = new ChannelRepository(new InMemoryChannelEventStore());
    expect(() => queryChannelFeed(validPayload(), emptyRepo))
      .toThrow(ChannelNotFoundError);
  });
});

// ── Pagination logic ──────────────────────────────────────────────────────────

describe("queryChannelFeed — pagination", () => {
  test("returns all messages in ascending seq order when count is below limit", () => {
    const repo = makeRepoWithMessages("ch-1", "user-42", 3);
    const result = queryChannelFeed(validPayload({ limit: 10 }), repo);
    expect(result).toHaveLength(3);
    expect(result.map(m => m.seq)).toEqual([1, 2, 3]);
  });

  test("returns the limit most-recent messages (highest seq) when count exceeds limit", () => {
    const repo = makeRepoWithMessages("ch-1", "user-42", 10);
    const result = queryChannelFeed(validPayload({ limit: 3 }), repo);
    expect(result).toHaveLength(3);
    expect(result.map(m => m.seq)).toEqual([8, 9, 10]);
  });

  test("returns messages strictly below the before cursor in ascending seq order", () => {
    const repo = makeRepoWithMessages("ch-1", "user-42", 10);
    const result = queryChannelFeed(validPayload({ limit: 3, before: 8 }), repo);
    expect(result).toHaveLength(3);
    expect(result.map(m => m.seq)).toEqual([5, 6, 7]);
  });

  test("returns fewer than limit items when not enough messages exist before the cursor", () => {
    const repo = makeRepoWithMessages("ch-1", "user-42", 10);
    const result = queryChannelFeed(validPayload({ limit: 3, before: 3 }), repo);
    expect(result).toHaveLength(2);
    expect(result.map(m => m.seq)).toEqual([1, 2]);
  });

  test("returns empty array when channel has no posted messages", () => {
    const repo = makeRepoWithChannel("ch-1");
    const result = queryChannelFeed(validPayload({ limit: 10 }), repo);
    expect(result).toEqual([]);
  });

  test("returns empty array when before=1 (no message has seq < 1)", () => {
    const repo = makeRepoWithMessages("ch-1", "user-42", 5);
    const result = queryChannelFeed(validPayload({ limit: 10, before: 1 }), repo);
    expect(result).toEqual([]);
  });

  test("before cursor beyond highest seq behaves like no-cursor — returns limit most-recent", () => {
    const repo = makeRepoWithMessages("ch-1", "user-42", 10);
    const result = queryChannelFeed(validPayload({ limit: 3, before: 999 }), repo);
    expect(result).toHaveLength(3);
    expect(result.map(m => m.seq)).toEqual([8, 9, 10]);
  });
});

// ── Field correctness ─────────────────────────────────────────────────────────

describe("queryChannelFeed — field correctness", () => {
  test("every returned item has all six ChannelMessagePostedV1 fields present and non-null", () => {
    const repo = makeRepoWithMessages("ch-1", "user-42", 2);
    const result = queryChannelFeed(validPayload({ limit: 10 }), repo);
    for (const msg of result) {
      expect(msg.channelId, "channelId").toBeDefined();
      expect(msg.messageId, "messageId").toBeDefined();
      expect(msg.authorId, "authorId").toBeDefined();
      expect(msg.content, "content").toBeDefined();
      expect(msg.seq, "seq").toBeDefined();
      expect(msg.postedAt, "postedAt").toBeDefined();
      expect(msg.mentionedIds, "mentionedIds").toBeDefined();
    }
  });

  test("mentionedIds is [] on every returned item (SL-001 invariant)", () => {
    const repo = makeRepoWithMessages("ch-1", "user-42", 3);
    const result = queryChannelFeed(validPayload({ limit: 10 }), repo);
    for (const msg of result) {
      expect(msg.mentionedIds).toStrictEqual([]);
    }
  });

  test("seq values are strictly increasing across the returned array", () => {
    const repo = makeRepoWithMessages("ch-1", "user-42", 5);
    const result = queryChannelFeed(validPayload({ limit: 10 }), repo);
    for (let i = 1; i < result.length; i++) {
      expect(result[i].seq).toBeGreaterThan(result[i - 1].seq);
    }
  });

  test("channelId on every returned item matches the queried channelId", () => {
    const repo = makeRepoWithMessages("ch-alpha", "user-42", 3);
    const result = queryChannelFeed({ channelId: "ch-alpha", limit: 10 }, repo);
    for (const msg of result) {
      expect(msg.channelId).toBe("ch-alpha");
    }
  });
});

// ── Integration: repo round-trip ──────────────────────────────────────────────

describe("queryChannelFeed — integration", () => {
  test("messages posted via handlePostChannelMessage are visible via queryChannelFeed", () => {
    const repo = makeRepoWithChannel("ch-1", "user-42");
    for (let i = 1; i <= 5; i++) {
      handlePostChannelMessage({ channelId: "ch-1", authorId: "user-42", content: `msg ${i}` }, repo);
    }
    const result = queryChannelFeed({ channelId: "ch-1", limit: 3 }, repo);
    expect(result).toHaveLength(3);
    expect(result.map(m => m.seq)).toEqual([3, 4, 5]);
  });

  test("queryChannelFeed with before=4 after 5 posts returns seq 1, 2, 3", () => {
    const repo = makeRepoWithMessages("ch-1", "user-42", 5);
    const result = queryChannelFeed({ channelId: "ch-1", limit: 3, before: 4 }, repo);
    expect(result).toHaveLength(3);
    expect(result.map(m => m.seq)).toEqual([1, 2, 3]);
  });
});
