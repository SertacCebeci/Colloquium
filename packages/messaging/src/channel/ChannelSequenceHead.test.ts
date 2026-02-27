import { describe, test, expect } from "vitest";
import { queryChannelSequenceHead } from "./ChannelSequenceHead";
import type { ChannelSequenceHeadPayload } from "./ChannelSequenceHead";
import { InvalidPayloadError, ChannelNotFoundError } from "./errors";
import { handlePostChannelMessage } from "./PostChannelMessageAcl";
import { ChannelRepository, InMemoryChannelEventStore } from "./ChannelRepository";
import { Channel } from "./Channel";

// ── Test helpers ──────────────────────────────────────────────────────────────

function validPayload(overrides: Partial<ChannelSequenceHeadPayload> = {}): ChannelSequenceHeadPayload {
  return { channelId: "ch-1", ...overrides };
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
    repo.save(ch, events);
  }
  return repo;
}

// ── Payload validation ────────────────────────────────────────────────────────

describe("queryChannelSequenceHead — payload validation", () => {
  test("throws InvalidPayloadError when channelId is empty string", () => {
    expect(() => queryChannelSequenceHead(validPayload({ channelId: "" }), makeRepoWithChannel()))
      .toThrow(InvalidPayloadError);
  });

  test("throws InvalidPayloadError when channelId is whitespace only", () => {
    expect(() => queryChannelSequenceHead(validPayload({ channelId: "   " }), makeRepoWithChannel()))
      .toThrow(InvalidPayloadError);
  });

  test("does not call repo when channelId is invalid — no channel is loaded", () => {
    const emptyRepo = new ChannelRepository(new InMemoryChannelEventStore());
    try { queryChannelSequenceHead(validPayload({ channelId: "" }), emptyRepo); } catch {}
    expect(emptyRepo.findById("ch-1")).toBeNull();
  });
});

// ── Channel not found ─────────────────────────────────────────────────────────

describe("queryChannelSequenceHead — channel not found", () => {
  test("throws ChannelNotFoundError when channel is not in the repository", () => {
    const emptyRepo = new ChannelRepository(new InMemoryChannelEventStore());
    expect(() => queryChannelSequenceHead(validPayload(), emptyRepo))
      .toThrow(ChannelNotFoundError);
  });
});

// ── Domain unit ───────────────────────────────────────────────────────────────

describe("queryChannelSequenceHead — domain unit", () => {
  test("returns 0 when channel exists but has no posted messages", () => {
    const repo = makeRepoWithChannel("ch-1");
    expect(queryChannelSequenceHead(validPayload(), repo)).toBe(0);
  });

  test("returns 1 when exactly one message has been posted", () => {
    const repo = makeRepoWithMessages("ch-1", "user-42", 1);
    expect(queryChannelSequenceHead(validPayload(), repo)).toBe(1);
  });

  test("returns 5 when five messages have been posted", () => {
    const repo = makeRepoWithMessages("ch-1", "user-42", 5);
    expect(queryChannelSequenceHead(validPayload(), repo)).toBe(5);
  });

  test("returns monotonically increasing head as more messages are posted", () => {
    const repo = makeRepoWithMessages("ch-1", "user-42", 3);
    expect(queryChannelSequenceHead(validPayload(), repo)).toBe(3);

    // Post two more messages directly through the aggregate
    for (let i = 4; i <= 5; i++) {
      const ch = repo.findById("ch-1")!;
      const events = ch.postChannelMessage("user-42", `extra message ${i}`);
      repo.save(ch, events);
    }

    expect(queryChannelSequenceHead(validPayload(), repo)).toBe(5);
  });
});

// ── Integration ───────────────────────────────────────────────────────────────

describe("queryChannelSequenceHead — integration", () => {
  test("returns 4 after four messages posted via handlePostChannelMessage", () => {
    const repo = makeRepoWithChannel("ch-1", "user-42");
    for (let i = 1; i <= 4; i++) {
      handlePostChannelMessage({ channelId: "ch-1", authorId: "user-42", content: `msg ${i}` }, repo);
    }
    expect(queryChannelSequenceHead(validPayload(), repo)).toBe(4);
  });

  test("returns 0 after channel is registered but no messages posted", () => {
    const repo = makeRepoWithChannel("ch-1", "user-42");
    expect(queryChannelSequenceHead(validPayload(), repo)).toBe(0);
  });
});
