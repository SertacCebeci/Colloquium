import { describe, test, expect } from "vitest";
import { queryMessagesSinceSeq } from "./ChannelMessagesSinceSeq";
import type { MessagesSinceSeqPayload } from "./ChannelMessagesSinceSeq";
import { InvalidPayloadError, ChannelNotFoundError } from "./errors";
import { handlePostChannelMessage } from "./PostChannelMessageAcl";
import { ChannelRepository, InMemoryChannelEventStore } from "./ChannelRepository";
import { Channel } from "./Channel";

// ── Test helpers ──────────────────────────────────────────────────────────────

function validPayload(overrides: Partial<MessagesSinceSeqPayload> = {}): MessagesSinceSeqPayload {
  return { channelId: "ch-1", fromSeq: 0, ...overrides };
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
function makeRepoWithMessages(
  channelId: string,
  memberId: string,
  count: number
): ChannelRepository {
  const repo = makeRepoWithChannel(channelId, memberId);
  for (let i = 1; i <= count; i++) {
    const ch = repo.findById(channelId)!;
    const events = ch.postChannelMessage(memberId, `message ${i}`);
    repo.save(ch, events);
  }
  return repo;
}

// ── Payload validation ────────────────────────────────────────────────────────

describe("queryMessagesSinceSeq — payload validation", () => {
  test("throws InvalidPayloadError when channelId is empty string", () => {
    expect(() =>
      queryMessagesSinceSeq(validPayload({ channelId: "" }), makeRepoWithChannel())
    ).toThrow(InvalidPayloadError);
  });

  test("throws InvalidPayloadError when channelId is whitespace only", () => {
    expect(() =>
      queryMessagesSinceSeq(validPayload({ channelId: "   " }), makeRepoWithChannel())
    ).toThrow(InvalidPayloadError);
  });

  test("throws InvalidPayloadError when fromSeq is negative", () => {
    expect(() =>
      queryMessagesSinceSeq(validPayload({ fromSeq: -1 }), makeRepoWithChannel())
    ).toThrow(InvalidPayloadError);
  });

  test("throws InvalidPayloadError when fromSeq is missing (undefined)", () => {
    const badPayload = { channelId: "ch-1", fromSeq: undefined as unknown as number };
    expect(() => queryMessagesSinceSeq(badPayload, makeRepoWithChannel())).toThrow(
      InvalidPayloadError
    );
  });

  test("does not call repo when payload is invalid — no channel is loaded", () => {
    const emptyRepo = new ChannelRepository(new InMemoryChannelEventStore());
    try {
      queryMessagesSinceSeq(validPayload({ channelId: "" }), emptyRepo);
    } catch {
      /* expected */
    }
    expect(emptyRepo.findById("ch-1")).toBeNull();
  });
});

// ── Channel not found ─────────────────────────────────────────────────────────

describe("queryMessagesSinceSeq — channel not found", () => {
  test("throws ChannelNotFoundError when channel is not in the repository", () => {
    const emptyRepo = new ChannelRepository(new InMemoryChannelEventStore());
    expect(() => queryMessagesSinceSeq(validPayload(), emptyRepo)).toThrow(ChannelNotFoundError);
  });
});

// ── Domain unit ───────────────────────────────────────────────────────────────

describe("queryMessagesSinceSeq — domain unit", () => {
  test("returns all messages when fromSeq is 0 and channel has 3 messages", () => {
    const repo = makeRepoWithMessages("ch-1", "user-42", 3);
    const result = queryMessagesSinceSeq(validPayload({ fromSeq: 0 }), repo);
    expect(result.map((m) => m.seq)).toEqual([1, 2, 3]);
  });

  test("returns only messages with seq > fromSeq when fromSeq is 2 and channel has 5 messages", () => {
    const repo = makeRepoWithMessages("ch-1", "user-42", 5);
    const result = queryMessagesSinceSeq(validPayload({ fromSeq: 2 }), repo);
    expect(result.map((m) => m.seq)).toEqual([3, 4, 5]);
  });

  test("returns empty array when fromSeq equals the number of messages (all caught up)", () => {
    const repo = makeRepoWithMessages("ch-1", "user-42", 5);
    const result = queryMessagesSinceSeq(validPayload({ fromSeq: 5 }), repo);
    expect(result).toEqual([]);
  });

  test("returns empty array when channel has no posted messages", () => {
    const repo = makeRepoWithChannel("ch-1");
    const result = queryMessagesSinceSeq(validPayload({ fromSeq: 0 }), repo);
    expect(result).toEqual([]);
  });

  test("every returned item contains all 7 canonical fields and mentionedIds is []", () => {
    const repo = makeRepoWithMessages("ch-1", "user-42", 2);
    const result = queryMessagesSinceSeq(validPayload({ fromSeq: 0 }), repo);
    expect(result).toHaveLength(2);
    for (const item of result) {
      expect(item).toHaveProperty("channelId");
      expect(item).toHaveProperty("messageId");
      expect(item).toHaveProperty("authorId");
      expect(item).toHaveProperty("content");
      expect(item).toHaveProperty("seq");
      expect(item).toHaveProperty("postedAt");
      expect(item).toHaveProperty("mentionedIds");
      expect(item.mentionedIds).toEqual([]);
    }
  });

  test("returned items are in strictly ascending seq order", () => {
    const repo = makeRepoWithMessages("ch-1", "user-42", 4);
    const result = queryMessagesSinceSeq(validPayload({ fromSeq: 1 }), repo);
    expect(result.map((m) => m.seq)).toEqual([2, 3, 4]);
    for (let i = 1; i < result.length; i++) {
      expect(result[i].seq).toBeGreaterThan(result[i - 1].seq);
    }
  });
});

// ── No-repo-side-effect ───────────────────────────────────────────────────────

describe("queryMessagesSinceSeq — no side effects", () => {
  test("does not mutate the channel aggregate — repo state is unchanged after query", () => {
    const repo = makeRepoWithMessages("ch-1", "user-42", 3);
    const before = repo.findSequenceHead("ch-1");
    queryMessagesSinceSeq(validPayload({ fromSeq: 1 }), repo);
    const after = repo.findSequenceHead("ch-1");
    expect(after).toBe(before);
  });
});

// ── Integration ───────────────────────────────────────────────────────────────

describe("queryMessagesSinceSeq — integration", () => {
  test("returns messages with seq 4, 5, 6 after posting 6 messages with fromSeq = 3", () => {
    const repo = makeRepoWithChannel("ch-1", "user-42");
    for (let i = 1; i <= 6; i++) {
      handlePostChannelMessage(
        { channelId: "ch-1", authorId: "user-42", content: `msg ${i}` },
        repo
      );
    }
    const result = queryMessagesSinceSeq({ channelId: "ch-1", fromSeq: 3 }, repo);
    expect(result.map((m) => m.seq)).toEqual([4, 5, 6]);
  });

  test("returns all 3 messages when fromSeq = 0 after posting 3 messages", () => {
    const repo = makeRepoWithChannel("ch-1", "user-42");
    for (let i = 1; i <= 3; i++) {
      handlePostChannelMessage(
        { channelId: "ch-1", authorId: "user-42", content: `msg ${i}` },
        repo
      );
    }
    const result = queryMessagesSinceSeq({ channelId: "ch-1", fromSeq: 0 }, repo);
    expect(result.map((m) => m.seq)).toEqual([1, 2, 3]);
  });
});
