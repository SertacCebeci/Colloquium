import { describe, test, expect } from "vitest";
import jwt from "jsonwebtoken";
import { ChannelRepository, InMemoryChannelEventStore, Channel } from "@colloquium/messaging";
import type { ChannelFeedPageV1, ChannelMessagePosted } from "@colloquium/messaging";
import { createDb } from "./db/index.js";
import { createApp } from "./app.js";

const TEST_SECRET = "test-secret";
process.env.JWT_SECRET = TEST_SECRET;

type ErrorBody = { error: string };

function makeToken(userId: string) {
  return jwt.sign({ sub: userId }, TEST_SECRET);
}

function makeRepoWithMember(channelId = "ch-test", memberId = "user-1") {
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

function makeRepoWithMessages(count: number, channelId = "ch-test", memberId = "user-1") {
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

function makeApp(repo?: ChannelRepository) {
  const db = createDb(":memory:");
  return createApp(db, repo);
}

// ── CT-004 HTTP contract ──────────────────────────────────────────────────────

describe("GET /channels/:channelId/messages — CT-004 HTTP contract", () => {
  test("returns 401 when Authorization header is absent", async () => {
    const app = makeApp();
    const res = await app.request("/channels/ch-test/messages");
    expect(res.status).toBe(401);
    const body = (await res.json()) as ErrorBody;
    expect(typeof body.error).toBe("string");
  });

  test("returns 401 when Bearer token is malformed", async () => {
    const app = makeApp();
    const res = await app.request("/channels/ch-test/messages", {
      headers: { Authorization: "Bearer not.a.valid.jwt" },
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as ErrorBody;
    expect(typeof body.error).toBe("string");
  });

  test("returns 401 when JWT is valid but sub claim is missing", async () => {
    const app = makeApp();
    // Sign a token without a sub claim — valid JWT, invalid identity
    const tokenWithoutSub = jwt.sign({ role: "user" }, TEST_SECRET);
    const res = await app.request("/channels/ch-test/messages", {
      headers: { Authorization: `Bearer ${tokenWithoutSub}` },
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as ErrorBody;
    expect(typeof body.error).toBe("string");
  });

  test("returns 404 when channel does not exist", async () => {
    const app = makeApp(makeRepoWithMember());
    const res = await app.request("/channels/ghost-channel/messages", {
      headers: { Authorization: `Bearer ${makeToken("user-1")}` },
    });
    expect(res.status).toBe(404);
    const body = (await res.json()) as ErrorBody;
    expect(typeof body.error).toBe("string");
  });

  test("returns 403 when authenticated user is not a channel member", async () => {
    const app = makeApp(makeRepoWithMember("ch-test", "user-1"));
    const res = await app.request("/channels/ch-test/messages", {
      headers: { Authorization: `Bearer ${makeToken("stranger")}` },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as ErrorBody;
    expect(typeof body.error).toBe("string");
  });

  test("returns 200 with valid ChannelFeedPage shape on success", async () => {
    const app = makeApp(makeRepoWithMessages(3));
    const res = await app.request("/channels/ch-test/messages", {
      headers: { Authorization: `Bearer ${makeToken("user-1")}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as ChannelFeedPageV1;
    expect(Array.isArray(body.messages)).toBe(true);
    expect("nextCursor" in body).toBe(true);
  });

  test("messages are returned newest-first (descending sequenceNumber)", async () => {
    const app = makeApp(makeRepoWithMessages(3));
    const res = await app.request("/channels/ch-test/messages", {
      headers: { Authorization: `Bearer ${makeToken("user-1")}` },
    });
    const body = (await res.json()) as ChannelFeedPageV1;
    const seqs = body.messages.map((m) => m.sequenceNumber);
    expect(seqs).toEqual([3, 2, 1]);
  });

  test("nextCursor is null when all messages fit in the page", async () => {
    const app = makeApp(makeRepoWithMessages(3));
    const res = await app.request("/channels/ch-test/messages?limit=50", {
      headers: { Authorization: `Bearer ${makeToken("user-1")}` },
    });
    const body = (await res.json()) as ChannelFeedPageV1;
    expect(body.nextCursor).toBeNull();
  });

  test("returns 400 when limit exceeds 50", async () => {
    const app = makeApp(makeRepoWithMember());
    const res = await app.request("/channels/ch-test/messages?limit=999", {
      headers: { Authorization: `Bearer ${makeToken("user-1")}` },
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as ErrorBody;
    expect(typeof body.error).toBe("string");
  });

  test("returns 400 when limit is not a valid number", async () => {
    const app = makeApp(makeRepoWithMember());
    const res = await app.request("/channels/ch-test/messages?limit=abc", {
      headers: { Authorization: `Bearer ${makeToken("user-1")}` },
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as ErrorBody;
    expect(typeof body.error).toBe("string");
  });

  test("returns 400 when before cursor is not a valid number", async () => {
    const app = makeApp(makeRepoWithMember());
    const res = await app.request("/channels/ch-test/messages?before=abc", {
      headers: { Authorization: `Bearer ${makeToken("user-1")}` },
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as ErrorBody;
    expect(typeof body.error).toBe("string");
  });
});

// ── CT-005 HTTP contract ──────────────────────────────────────────────────────

type PostChannelMessageResponse = {
  messageId: string;
  channelId: string;
  authorId: string;
  content: string;
  sequenceNumber: number;
  postedAt: string;
};

describe("POST /channels/:channelId/messages — CT-005 HTTP contract", () => {
  test("returns 401 when Authorization header is absent", async () => {
    const app = makeApp(makeRepoWithMember());
    const res = await app.request("/channels/ch-test/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "hello" }),
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as ErrorBody;
    expect(typeof body.error).toBe("string");
  });

  test("returns 401 when Bearer token is malformed", async () => {
    const app = makeApp(makeRepoWithMember());
    const res = await app.request("/channels/ch-test/messages", {
      method: "POST",
      headers: { Authorization: "Bearer not.a.valid.jwt", "Content-Type": "application/json" },
      body: JSON.stringify({ content: "hello" }),
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as ErrorBody;
    expect(typeof body.error).toBe("string");
  });

  test("returns 401 when JWT is valid but sub claim is missing", async () => {
    const app = makeApp(makeRepoWithMember());
    const tokenWithoutSub = jwt.sign({ role: "user" }, TEST_SECRET);
    const res = await app.request("/channels/ch-test/messages", {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenWithoutSub}`, "Content-Type": "application/json" },
      body: JSON.stringify({ content: "hello" }),
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as ErrorBody;
    expect(typeof body.error).toBe("string");
  });

  test("returns 400 when request body is missing the content field", async () => {
    const app = makeApp(makeRepoWithMember());
    const res = await app.request("/channels/ch-test/messages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${makeToken("user-1")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as ErrorBody;
    expect(typeof body.error).toBe("string");
  });

  test("returns 404 when channel does not exist", async () => {
    const app = makeApp(makeRepoWithMember());
    const res = await app.request("/channels/ghost-channel/messages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${makeToken("user-1")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content: "hello" }),
    });
    expect(res.status).toBe(404);
    const body = (await res.json()) as ErrorBody;
    expect(typeof body.error).toBe("string");
  });

  test("returns 403 when authenticated user is not a channel member", async () => {
    const app = makeApp(makeRepoWithMember("ch-test", "user-1"));
    const res = await app.request("/channels/ch-test/messages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${makeToken("stranger")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content: "hello" }),
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as ErrorBody;
    expect(typeof body.error).toBe("string");
  });

  test("returns 422 when content is whitespace-only", async () => {
    const app = makeApp(makeRepoWithMember());
    const res = await app.request("/channels/ch-test/messages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${makeToken("user-1")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content: "   " }),
    });
    expect(res.status).toBe(422);
    const body = (await res.json()) as ErrorBody;
    expect(typeof body.error).toBe("string");
  });

  test("returns 422 when content exceeds 4000 characters", async () => {
    const app = makeApp(makeRepoWithMember());
    const res = await app.request("/channels/ch-test/messages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${makeToken("user-1")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content: "a".repeat(4001) }),
    });
    expect(res.status).toBe(422);
    const body = (await res.json()) as ErrorBody;
    expect(typeof body.error).toBe("string");
  });

  test("returns 201 with all six CT-005 response fields on a valid post", async () => {
    const app = makeApp(makeRepoWithMember());
    const res = await app.request("/channels/ch-test/messages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${makeToken("user-1")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content: "Hello, world!" }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as PostChannelMessageResponse;
    expect(typeof body.messageId).toBe("string");
    expect(body.channelId).toBe("ch-test");
    expect(typeof body.authorId).toBe("string");
    expect(body.content).toBe("Hello, world!");
    expect(Number.isInteger(body.sequenceNumber)).toBe(true);
    expect(body.sequenceNumber).toBeGreaterThanOrEqual(1);
    expect(typeof body.postedAt).toBe("string");
  });

  test("authorId in 201 response matches JWT sub — not overridable by request body", async () => {
    const app = makeApp(makeRepoWithMember("ch-test", "user-1"));
    const res = await app.request("/channels/ch-test/messages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${makeToken("user-1")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content: "authored message" }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as PostChannelMessageResponse;
    expect(body.authorId).toBe("user-1");
  });

  test("postedAt in 201 response is a valid ISO 8601 UTC string (not a Unix timestamp)", async () => {
    const app = makeApp(makeRepoWithMember());
    const res = await app.request("/channels/ch-test/messages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${makeToken("user-1")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content: "timestamp test" }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as PostChannelMessageResponse;
    // ISO 8601 string — must parse to a valid date, must NOT be a number
    expect(typeof body.postedAt).toBe("string");
    expect(Number.isNaN(Date.parse(body.postedAt))).toBe(false);
    // Not a Unix timestamp (which would be a large integer as string, e.g. "1700000000000")
    expect(body.postedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test("sequenceNumber in 201 response is a number (not string) — CT-005 field rename from domain seq", async () => {
    const app = makeApp(makeRepoWithMember());
    const res = await app.request("/channels/ch-test/messages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${makeToken("user-1")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content: "seq rename test" }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as Record<string, unknown>;
    // CT-005 requires 'sequenceNumber' — the domain uses 'seq' internally
    expect("sequenceNumber" in body).toBe(true);
    expect("seq" in body).toBe(false);
    expect(typeof body.sequenceNumber).toBe("number");
  });
});

// ── CT-005 integration: POST then GET round-trip ──────────────────────────────

describe("POST /channels/:channelId/messages — integration round-trip", () => {
  test("posted message appears at top of GET feed (sequenceNumber is greatest in channel)", async () => {
    const repo = makeRepoWithMessages(3);
    const app = makeApp(repo);

    const postRes = await app.request("/channels/ch-test/messages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${makeToken("user-1")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content: "new message" }),
    });
    expect(postRes.status).toBe(201);
    const posted = (await postRes.json()) as PostChannelMessageResponse;
    expect(posted.sequenceNumber).toBe(4); // 3 seeded + 1 new

    const getRes = await app.request("/channels/ch-test/messages", {
      headers: { Authorization: `Bearer ${makeToken("user-1")}` },
    });
    const feed = (await getRes.json()) as ChannelFeedPageV1;
    expect(feed.messages[0].sequenceNumber).toBe(4);
    expect(feed.messages[0].content).toBe("new message");
  });
});

// ── Integration: initial + paginated load ─────────────────────────────────────

describe("GET /channels/:channelId/messages — pagination integration", () => {
  test("initial fetch returns 50 most-recent messages with non-null nextCursor when 75 exist", async () => {
    const app = makeApp(makeRepoWithMessages(75));
    const res = await app.request("/channels/ch-test/messages", {
      headers: { Authorization: `Bearer ${makeToken("user-1")}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as ChannelFeedPageV1;
    expect(body.messages).toHaveLength(50);
    expect(body.nextCursor).not.toBeNull();
    // Newest message is seq 75, oldest in first page is seq 26
    expect(body.messages[0].sequenceNumber).toBe(75);
    expect(body.messages[49].sequenceNumber).toBe(26);
  });

  test("second fetch with before cursor returns remaining 25 with nextCursor null", async () => {
    const app = makeApp(makeRepoWithMessages(75));
    // Page 1
    const res1 = await app.request("/channels/ch-test/messages", {
      headers: { Authorization: `Bearer ${makeToken("user-1")}` },
    });
    const page1 = (await res1.json()) as ChannelFeedPageV1;
    const cursor = page1.nextCursor;

    // Page 2
    const res2 = await app.request(`/channels/ch-test/messages?before=${cursor}`, {
      headers: { Authorization: `Bearer ${makeToken("user-1")}` },
    });
    expect(res2.status).toBe(200);
    const page2 = (await res2.json()) as ChannelFeedPageV1;
    expect(page2.messages).toHaveLength(25);
    expect(page2.nextCursor).toBeNull();
    expect(page2.messages[0].sequenceNumber).toBe(25);
    expect(page2.messages[24].sequenceNumber).toBe(1);
  });
});
