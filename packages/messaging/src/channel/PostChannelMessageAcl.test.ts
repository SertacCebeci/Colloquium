import { describe, test, expect } from "vitest";
import { handlePostChannelMessage } from "./PostChannelMessageAcl";
import type { PostChannelMessagePayload } from "./PostChannelMessageAcl";
import { InvalidPayloadError, ChannelNotFoundError, ChannelAccessDeniedError, MessageValidationFailedError } from "./errors";
import { ChannelRepository, InMemoryChannelEventStore } from "./ChannelRepository";
import { Channel } from "./Channel";

// ── Test helpers ──────────────────────────────────────────────────────────────

function validPayload(overrides: Partial<PostChannelMessagePayload> = {}): PostChannelMessagePayload {
  return { channelId: "ch-1", authorId: "user-42", content: "Hello, world!", ...overrides };
}

/** Repo with a registered channel only — no members. */
function makeRepoWithChannel(channelId = "ch-1") {
  const store = new InMemoryChannelEventStore();
  const repo = new ChannelRepository(store);
  const ch = new Channel(channelId);
  repo.save(ch, ch.registerChannel("ws-1"));
  return repo;
}

/** Repo with a registered channel AND a member who can post. */
function makeRepoWithMember(channelId = "ch-1", memberId = "user-42") {
  const store = new InMemoryChannelEventStore();
  const repo = new ChannelRepository(store);
  const ch = new Channel(channelId);
  repo.save(ch, ch.registerChannel("ws-1"));
  const ch2 = repo.findById(channelId)!;
  repo.save(ch2, ch2.grantChannelMembership(memberId));
  return repo;
}

// ── Payload validation ────────────────────────────────────────────────────────

describe("handlePostChannelMessage — payload validation", () => {
  test("throws InvalidPayloadError when channelId is empty string", () => {
    expect(() => handlePostChannelMessage(validPayload({ channelId: "" }), makeRepoWithMember()))
      .toThrow(InvalidPayloadError);
  });

  test("throws InvalidPayloadError when channelId is whitespace only", () => {
    expect(() => handlePostChannelMessage(validPayload({ channelId: "   " }), makeRepoWithMember()))
      .toThrow(InvalidPayloadError);
  });

  test("throws InvalidPayloadError when authorId is empty string", () => {
    expect(() => handlePostChannelMessage(validPayload({ authorId: "" }), makeRepoWithMember()))
      .toThrow(InvalidPayloadError);
  });

  test("throws InvalidPayloadError when authorId is whitespace only", () => {
    expect(() => handlePostChannelMessage(validPayload({ authorId: "   " }), makeRepoWithMember()))
      .toThrow(InvalidPayloadError);
  });

  test("throws InvalidPayloadError when content is empty string", () => {
    expect(() => handlePostChannelMessage(validPayload({ content: "" }), makeRepoWithMember()))
      .toThrow(InvalidPayloadError);
  });

  test("throws InvalidPayloadError when content is null", () => {
    expect(() => handlePostChannelMessage(validPayload({ content: null as any }), makeRepoWithMember()))
      .toThrow(InvalidPayloadError);
  });

  test("does not throw InvalidPayloadError for whitespace-only content — passes to domain", () => {
    const repo = makeRepoWithMember();
    // "   " is NOT an invalid payload — the adapter lets it through.
    // The domain rejects it with EMPTY_CONTENT, so adapter throws MessageValidationFailedError.
    expect(() => handlePostChannelMessage(validPayload({ content: "   " }), repo))
      .toThrow(MessageValidationFailedError);
  });

  test("does not call repo when channelId is invalid — no channel is loaded or modified", () => {
    const repo = makeRepoWithMember();
    try { handlePostChannelMessage(validPayload({ channelId: "" }), repo); } catch {}
    // user-42 was already a member; a valid post should still succeed afterward
    const result = handlePostChannelMessage(validPayload(), repo);
    expect(result.type).toBe("ChannelMessagePosted");
  });
});

// ── Channel not found ─────────────────────────────────────────────────────────

describe("handlePostChannelMessage — channel not found", () => {
  test("throws ChannelNotFoundError when channel is not in the repository", () => {
    const emptyRepo = new ChannelRepository(new InMemoryChannelEventStore());
    expect(() => handlePostChannelMessage(validPayload(), emptyRepo))
      .toThrow(ChannelNotFoundError);
  });

  test("does not create a new Channel when channel is not found", () => {
    const emptyRepo = new ChannelRepository(new InMemoryChannelEventStore());
    try { handlePostChannelMessage(validPayload({ channelId: "ch-ghost" }), emptyRepo); } catch {}
    expect(emptyRepo.findById("ch-ghost")).toBeNull();
  });
});

// ── Domain failure propagation ────────────────────────────────────────────────

describe("handlePostChannelMessage — domain failure propagation", () => {
  test("throws ChannelAccessDeniedError when authorId is not in allowedPosters", () => {
    // Channel exists but user-99 was never granted membership
    const repo = makeRepoWithChannel();
    expect(() => handlePostChannelMessage(validPayload({ authorId: "user-99" }), repo))
      .toThrow(ChannelAccessDeniedError);
  });

  test("ChannelAccessDeniedError carries the channelId and authorId from the domain event", () => {
    const repo = makeRepoWithChannel();
    let caught: ChannelAccessDeniedError | undefined;
    try {
      handlePostChannelMessage(validPayload({ channelId: "ch-1", authorId: "user-99" }), repo);
    } catch (e) {
      if (e instanceof ChannelAccessDeniedError) caught = e;
    }
    expect(caught).toBeDefined();
    expect(caught!.channelId).toBe("ch-1");
    expect(caught!.authorId).toBe("user-99");
  });

  test("does not persist events to the repository when access is denied", () => {
    const store = new InMemoryChannelEventStore();
    const repo = new ChannelRepository(store);
    const ch = new Channel("ch-1");
    repo.save(ch, ch.registerChannel("ws-1"));
    const eventsBefore = store.load("ch-1").length;

    try { handlePostChannelMessage(validPayload({ authorId: "user-99" }), repo); } catch {}

    expect(store.load("ch-1").length).toBe(eventsBefore);
  });

  test("throws MessageValidationFailedError with EMPTY_CONTENT for whitespace-only content", () => {
    const repo = makeRepoWithMember();
    let caught: MessageValidationFailedError | undefined;
    try {
      handlePostChannelMessage(validPayload({ content: "   " }), repo);
    } catch (e) {
      if (e instanceof MessageValidationFailedError) caught = e;
    }
    expect(caught).toBeDefined();
    expect(caught!.reason).toBe("EMPTY_CONTENT");
  });

  test("throws MessageValidationFailedError with CONTENT_TOO_LONG when content exceeds 4000 chars", () => {
    const repo = makeRepoWithMember();
    const longContent = "a".repeat(4001);
    let caught: MessageValidationFailedError | undefined;
    try {
      handlePostChannelMessage(validPayload({ content: longContent }), repo);
    } catch (e) {
      if (e instanceof MessageValidationFailedError) caught = e;
    }
    expect(caught).toBeDefined();
    expect(caught!.reason).toBe("CONTENT_TOO_LONG");
  });

  test("does not persist events when content validation fails", () => {
    const store = new InMemoryChannelEventStore();
    const repo = new ChannelRepository(store);
    const ch = new Channel("ch-1");
    repo.save(ch, ch.registerChannel("ws-1"));
    const ch2 = repo.findById("ch-1")!;
    repo.save(ch2, ch2.grantChannelMembership("user-42"));
    const eventsBefore = store.load("ch-1").length;

    try { handlePostChannelMessage(validPayload({ content: "   " }), repo); } catch {}

    expect(store.load("ch-1").length).toBe(eventsBefore);
  });
});

// ── CT-003 contract mapping ───────────────────────────────────────────────────

describe("handlePostChannelMessage — CT-003 contract mapping", () => {
  test("returned value has type field set to 'ChannelMessagePosted'", () => {
    const result = handlePostChannelMessage(validPayload(), makeRepoWithMember());
    expect(result.type).toBe("ChannelMessagePosted");
  });

  test("all seven CT-003 fields are present and non-null in the returned payload", () => {
    const result = handlePostChannelMessage(validPayload(), makeRepoWithMember());
    expect(result.channelId).toBeDefined();
    expect(result.messageId).toBeDefined();
    expect(result.authorId).toBeDefined();
    expect(result.content).toBeDefined();
    expect(result.seq).toBeDefined();
    expect(result.postedAt).toBeDefined();
    expect(result.mentionedIds).toBeDefined();
  });

  test("channelId in returned payload matches the input channelId", () => {
    const result = handlePostChannelMessage(validPayload({ channelId: "ch-1" }), makeRepoWithMember("ch-1"));
    expect(result.channelId).toBe("ch-1");
  });

  test("authorId in returned payload matches the input authorId", () => {
    const result = handlePostChannelMessage(validPayload({ authorId: "user-42" }), makeRepoWithMember("ch-1", "user-42"));
    expect(result.authorId).toBe("user-42");
  });

  test("content in returned payload matches the input content exactly", () => {
    const content = "This is a precise message body.";
    const result = handlePostChannelMessage(validPayload({ content }), makeRepoWithMember());
    expect(result.content).toBe(content);
  });

  test("messageId in returned payload is a non-empty string", () => {
    const result = handlePostChannelMessage(validPayload(), makeRepoWithMember());
    expect(typeof result.messageId).toBe("string");
    expect(result.messageId.length).toBeGreaterThan(0);
  });

  test("seq in returned payload is a positive integer", () => {
    const result = handlePostChannelMessage(validPayload(), makeRepoWithMember());
    expect(Number.isInteger(result.seq)).toBe(true);
    expect(result.seq).toBeGreaterThanOrEqual(1);
  });

  test("postedAt in returned payload is a positive Unix ms timestamp", () => {
    const result = handlePostChannelMessage(validPayload(), makeRepoWithMember());
    expect(Number.isInteger(result.postedAt)).toBe(true);
    expect(result.postedAt).toBeGreaterThan(0);
  });

  test("mentionedIds in returned payload is an empty array (SL-001 invariant)", () => {
    const result = handlePostChannelMessage(validPayload(), makeRepoWithMember());
    expect(Array.isArray(result.mentionedIds)).toBe(true);
    expect(result.mentionedIds).toHaveLength(0);
  });

  test("seq values are strictly increasing across successive calls to the same channel", () => {
    const repo = makeRepoWithMember();
    const first = handlePostChannelMessage(validPayload({ content: "first" }), repo);
    const second = handlePostChannelMessage(validPayload({ content: "second" }), repo);
    expect(second.seq).toBeGreaterThan(first.seq);
  });
});

// ── CT-003 contract schema (producer-side contract test) ─────────────────────

describe("handlePostChannelMessage — CT-003 producer contract", () => {
  test("produced payload satisfies the full CT-003 v1 schema — all fields present with correct types", () => {
    const result = handlePostChannelMessage(
      validPayload({ channelId: "ch-contract", authorId: "user-ct", content: "contract test message" }),
      makeRepoWithMember("ch-contract", "user-ct")
    );
    // All seven required CT-003 fields must be present
    const CT003_FIELDS: Array<keyof typeof result> = [
      "channelId", "messageId", "authorId", "content", "seq", "postedAt", "mentionedIds",
    ];
    for (const field of CT003_FIELDS) {
      expect(result[field], `CT-003 field '${field}' must be present`).toBeDefined();
    }
    // Type assertions matching the CT-003 schema specification
    expect(typeof result.channelId).toBe("string");
    expect(typeof result.messageId).toBe("string");
    expect(typeof result.authorId).toBe("string");
    expect(typeof result.content).toBe("string");
    expect(typeof result.seq).toBe("number");
    expect(Number.isInteger(result.seq) && result.seq > 0).toBe(true);
    expect(typeof result.postedAt).toBe("number");
    expect(Number.isInteger(result.postedAt) && result.postedAt > 0).toBe(true);
    expect(Array.isArray(result.mentionedIds)).toBe(true);
    // content has already passed Channel aggregate invariants (non-empty, ≤ 4000)
    expect(result.content.trim().length).toBeGreaterThan(0);
    expect(result.content.length).toBeLessThanOrEqual(4000);
  });

  test("seq is strictly greater than previous message seq for the same channel (monotonic ordering guarantee)", () => {
    const repo = makeRepoWithMember("ch-mono", "user-ct");
    const msg1 = handlePostChannelMessage(
      validPayload({ channelId: "ch-mono", authorId: "user-ct", content: "first" }),
      repo
    );
    const msg2 = handlePostChannelMessage(
      validPayload({ channelId: "ch-mono", authorId: "user-ct", content: "second" }),
      repo
    );
    const msg3 = handlePostChannelMessage(
      validPayload({ channelId: "ch-mono", authorId: "user-ct", content: "third" }),
      repo
    );
    expect(msg2.seq).toBeGreaterThan(msg1.seq);
    expect(msg3.seq).toBeGreaterThan(msg2.seq);
  });

  test("mentionedIds is always an empty array in SL-001 (field present but never populated)", () => {
    const result = handlePostChannelMessage(validPayload(), makeRepoWithMember());
    expect(result.mentionedIds).toStrictEqual([]);
  });
});

// ── Integration: repo round-trip ──────────────────────────────────────────────

describe("handlePostChannelMessage — integration", () => {
  test("ChannelMessagePosted event is persisted in the repository after a successful call", () => {
    const store = new InMemoryChannelEventStore();
    const repo = new ChannelRepository(store);
    const ch = new Channel("ch-1");
    repo.save(ch, ch.registerChannel("ws-1"));
    const ch2 = repo.findById("ch-1")!;
    repo.save(ch2, ch2.grantChannelMembership("user-42"));

    const result = handlePostChannelMessage(validPayload(), repo);

    const events = store.load("ch-1");
    const persisted = events.find(e => e.type === "ChannelMessagePosted");
    expect(persisted).toBeDefined();
    expect((persisted as any).messageId).toBe(result.messageId);
  });

  test("two successive calls produce distinct messageId values", () => {
    const repo = makeRepoWithMember();
    const first = handlePostChannelMessage(validPayload({ content: "first" }), repo);
    const second = handlePostChannelMessage(validPayload({ content: "second" }), repo);
    expect(first.messageId).not.toBe(second.messageId);
  });
});
