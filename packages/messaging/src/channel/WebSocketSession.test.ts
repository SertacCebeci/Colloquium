import { describe, test, expect, vi } from "vitest";
import { WebSocketSession } from "./WebSocketSession";
import { InvalidPayloadError, ChannelNotFoundError } from "./errors";
import { ChannelRepository, InMemoryChannelEventStore } from "./ChannelRepository";
import { Channel } from "./Channel";
import { handlePostChannelMessage } from "./PostChannelMessageAcl";
import type { ChannelMessagePostedV1 } from "./PostChannelMessageAcl";

// ── Test helpers ──────────────────────────────────────────────────────────────

function makeRepo(channelId = "ch-1", memberId = "user-42"): ChannelRepository {
  const store = new InMemoryChannelEventStore();
  const repo = new ChannelRepository(store);
  const ch = new Channel(channelId);
  repo.save(ch, ch.registerChannel("ws-1"));
  const ch2 = repo.findById(channelId)!;
  repo.save(ch2, ch2.grantChannelMembership(memberId));
  return repo;
}

function makeRepoWithMessages(
  channelId: string,
  memberId: string,
  count: number
): ChannelRepository {
  const repo = makeRepo(channelId, memberId);
  for (let i = 1; i <= count; i++) {
    handlePostChannelMessage({ channelId, authorId: memberId, content: `msg ${i}` }, repo);
  }
  return repo;
}

function openSession(connectionId = "conn-1", memberId = "user-42"): WebSocketSession {
  const session = new WebSocketSession(connectionId);
  session.registerSession(memberId);
  return session;
}

// ── registerSession ───────────────────────────────────────────────────────────

describe("WebSocketSession — registerSession", () => {
  test("calling registerSession on an already-Open session is a no-op (no event emitted)", () => {
    const session = new WebSocketSession("conn-1");
    session.registerSession("user-42");
    const events = session.registerSession("user-99"); // second call — different member
    expect(events).toHaveLength(0);
  });

  test("returns WebSocketSessionOpened event with correct fields", () => {
    const session = new WebSocketSession("conn-1");
    const events = session.registerSession("user-42");
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("WebSocketSessionOpened");
    expect(events[0].connectionId).toBe("conn-1");
    expect(events[0].memberId).toBe("user-42");
    expect(typeof events[0].openedAt).toBe("number");
  });

  test("session is Open after registerSession", () => {
    const session = new WebSocketSession("conn-1");
    session.registerSession("user-42");
    // deliverMessage should work (Open state) — we verify by confirming sendFn IS called
    const sendFn = vi.fn();
    const repo = makeRepoWithMessages("ch-1", "user-42", 1);
    session.subscribeToChannel("ch-1", 0, repo, sendFn);
    session.deliverMessage(
      {
        type: "ChannelMessagePosted",
        channelId: "ch-1",
        messageId: "m-1",
        authorId: "user-42",
        content: "hi",
        seq: 2,
        postedAt: Date.now(),
        mentionedIds: [],
      },
      sendFn
    );
    // sendFn called at least once during subscribeToChannel (catch-up) — session is Open
    expect(sendFn).toHaveBeenCalled();
  });
});

// ── subscribeToChannel — payload validation ───────────────────────────────────

describe("WebSocketSession — subscribeToChannel payload validation", () => {
  test("throws InvalidPayloadError when channelId is empty string", () => {
    const session = openSession();
    const repo = makeRepo();
    expect(() => session.subscribeToChannel("", 0, repo, vi.fn())).toThrow(InvalidPayloadError);
  });

  test("throws InvalidPayloadError when channelId is whitespace only", () => {
    const session = openSession();
    const repo = makeRepo();
    expect(() => session.subscribeToChannel("   ", 0, repo, vi.fn())).toThrow(InvalidPayloadError);
  });

  test("throws InvalidPayloadError when lastKnownSeq is negative", () => {
    const session = openSession();
    const repo = makeRepo();
    expect(() => session.subscribeToChannel("ch-1", -1, repo, vi.fn())).toThrow(
      InvalidPayloadError
    );
  });

  test("throws ChannelNotFoundError when channel is not in repo", () => {
    const session = openSession();
    const emptyRepo = new ChannelRepository(new InMemoryChannelEventStore());
    expect(() => session.subscribeToChannel("ch-missing", 0, emptyRepo, vi.fn())).toThrow(
      ChannelNotFoundError
    );
  });

  test("does not add channel to subscriptions when payload is invalid", () => {
    const session = openSession();
    const repo = makeRepo();
    try {
      session.subscribeToChannel("", 0, repo, vi.fn());
    } catch {
      /* expected */
    }
    // After invalid subscribe, unsubscribeFromChannel should be no-op (nothing was added)
    const events = session.unsubscribeFromChannel("ch-1");
    expect(events).toHaveLength(0);
  });

  test("does not add channel to subscriptions when ChannelNotFoundError is thrown", () => {
    const session = openSession();
    const emptyRepo = new ChannelRepository(new InMemoryChannelEventStore());
    try {
      session.subscribeToChannel("ch-missing", 0, emptyRepo, vi.fn());
    } catch {
      /* expected */
    }
    const events = session.unsubscribeFromChannel("ch-missing");
    expect(events).toHaveLength(0);
  });

  test("returns empty array without calling sendFn when session is Closed", () => {
    const session = openSession();
    session.terminateSession();
    const repo = makeRepo();
    const sendFn = vi.fn();
    const events = session.subscribeToChannel("ch-1", 0, repo, sendFn);
    expect(events).toHaveLength(0);
    expect(sendFn).not.toHaveBeenCalled();
  });
});

// ── subscribeToChannel — no gap (fully caught up) ────────────────────────────

describe("WebSocketSession — subscribeToChannel (no gap)", () => {
  test("emits ChannelSubscriptionRegistered when fully caught up", () => {
    const session = openSession();
    const repo = makeRepoWithMessages("ch-1", "user-42", 3);
    const events = session.subscribeToChannel("ch-1", 3, repo, vi.fn());
    expect(events.map((e) => e.type)).toContain("ChannelSubscriptionRegistered");
  });

  test("does NOT emit MissedMessagesDelivered when fully caught up", () => {
    const session = openSession();
    const repo = makeRepoWithMessages("ch-1", "user-42", 3);
    const events = session.subscribeToChannel("ch-1", 3, repo, vi.fn());
    expect(events.map((e) => e.type)).not.toContain("MissedMessagesDelivered");
  });

  test("does NOT call sendFn when fully caught up", () => {
    const session = openSession();
    const repo = makeRepoWithMessages("ch-1", "user-42", 3);
    const sendFn = vi.fn();
    session.subscribeToChannel("ch-1", 3, repo, sendFn);
    expect(sendFn).not.toHaveBeenCalled();
  });

  test("does NOT call sendFn when channel has no messages and lastKnownSeq is 0", () => {
    const session = openSession();
    const repo = makeRepo(); // channel registered, no messages
    const sendFn = vi.fn();
    session.subscribeToChannel("ch-1", 0, repo, sendFn);
    expect(sendFn).not.toHaveBeenCalled();
  });
});

// ── subscribeToChannel — gap (catch-up delivery) ─────────────────────────────

describe("WebSocketSession — subscribeToChannel (catch-up)", () => {
  test("calls sendFn for each missed message in ascending seq order", () => {
    const session = openSession();
    const repo = makeRepoWithMessages("ch-1", "user-42", 5);
    const received: number[] = [];
    session.subscribeToChannel("ch-1", 2, repo, (msg) => {
      received.push((msg as ChannelMessagePostedV1).seq);
    });
    expect(received).toEqual([3, 4, 5]);
  });

  test("emits MissedMessagesDelivered with correct fromSeq, toSeq, messageCount", () => {
    const session = openSession();
    const repo = makeRepoWithMessages("ch-1", "user-42", 5);
    const events = session.subscribeToChannel("ch-1", 2, repo, vi.fn());
    const delivered = events.find((e) => e.type === "MissedMessagesDelivered");
    expect(delivered).toBeDefined();
    expect(delivered!.fromSeq).toBe(2);
    expect(delivered!.toSeq).toBe(5);
    expect(delivered!.messageCount).toBe(3);
  });

  test("emits ChannelSubscriptionRegistered alongside MissedMessagesDelivered", () => {
    const session = openSession();
    const repo = makeRepoWithMessages("ch-1", "user-42", 3);
    const events = session.subscribeToChannel("ch-1", 0, repo, vi.fn());
    const types = events.map((e) => e.type);
    expect(types).toContain("ChannelSubscriptionRegistered");
    expect(types).toContain("MissedMessagesDelivered");
  });

  test("MissedMessagesDelivered is emitted AFTER all sendFn calls", () => {
    const session = openSession();
    const repo = makeRepoWithMessages("ch-1", "user-42", 3);
    const callOrder: string[] = [];
    const events = session.subscribeToChannel("ch-1", 0, repo, () => {
      callOrder.push("send");
    });
    // MissedMessagesDelivered should come at the end of the returned events array
    const lastEventType = events[events.length - 1].type;
    expect(lastEventType).toBe("MissedMessagesDelivered");
    // sendFn was called before the event
    expect(callOrder).toHaveLength(3);
  });

  test("ChannelSubscriptionRegistered is the first event in the returned array (before MissedMessagesDelivered)", () => {
    const session = openSession();
    const repo = makeRepoWithMessages("ch-1", "user-42", 2);
    const events = session.subscribeToChannel("ch-1", 0, repo, vi.fn());
    expect(events[0].type).toBe("ChannelSubscriptionRegistered");
  });

  test("subscribeToChannel fromSeq=0 returns all messages when channel has 3 messages", () => {
    const session = openSession();
    const repo = makeRepoWithMessages("ch-1", "user-42", 3);
    const received: number[] = [];
    session.subscribeToChannel("ch-1", 0, repo, (msg) => {
      received.push((msg as ChannelMessagePostedV1).seq);
    });
    expect(received).toEqual([1, 2, 3]);
  });
});

// ── subscribeToChannel — idempotency ─────────────────────────────────────────

describe("WebSocketSession — subscribeToChannel idempotency", () => {
  test("re-subscribing with same lastKnownSeq after head advances delivers new catch-up batch", () => {
    const session = openSession();
    const repo = makeRepoWithMessages("ch-1", "user-42", 3);
    session.subscribeToChannel("ch-1", 3, repo, vi.fn()); // fully caught up

    // New messages arrive
    handlePostChannelMessage({ channelId: "ch-1", authorId: "user-42", content: "msg 4" }, repo);
    handlePostChannelMessage({ channelId: "ch-1", authorId: "user-42", content: "msg 5" }, repo);

    const received: number[] = [];
    session.subscribeToChannel("ch-1", 3, repo, (msg) => {
      received.push((msg as ChannelMessagePostedV1).seq);
    });
    expect(received).toEqual([4, 5]);
  });
});

// ── unsubscribeFromChannel ────────────────────────────────────────────────────

describe("WebSocketSession — unsubscribeFromChannel", () => {
  test("emits ChannelSubscriptionRemoved after a successful subscribe", () => {
    const session = openSession();
    const repo = makeRepo();
    session.subscribeToChannel("ch-1", 0, repo, vi.fn());
    const events = session.unsubscribeFromChannel("ch-1");
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("ChannelSubscriptionRemoved");
    expect(events[0].channelId).toBe("ch-1");
  });

  test("returns empty array (no event) when channel was not subscribed", () => {
    const session = openSession();
    const events = session.unsubscribeFromChannel("ch-not-subscribed");
    expect(events).toHaveLength(0);
  });

  test("after unsubscribe, deliverMessage does NOT call sendFn for that channel", () => {
    const session = openSession();
    const repo = makeRepo();
    session.subscribeToChannel("ch-1", 0, repo, vi.fn());
    session.unsubscribeFromChannel("ch-1");
    const sendFn = vi.fn();
    session.deliverMessage(
      {
        type: "ChannelMessagePosted",
        channelId: "ch-1",
        messageId: "m-1",
        authorId: "user-42",
        content: "hi",
        seq: 1,
        postedAt: Date.now(),
        mentionedIds: [],
      },
      sendFn
    );
    expect(sendFn).not.toHaveBeenCalled();
  });
});

// ── terminateSession ──────────────────────────────────────────────────────────

describe("WebSocketSession — terminateSession", () => {
  test("returns WebSocketSessionClosed event", () => {
    const session = openSession("conn-1", "user-42");
    const events = session.terminateSession();
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("WebSocketSessionClosed");
    expect(events[0].connectionId).toBe("conn-1");
    expect(events[0].memberId).toBe("user-42");
    expect(typeof events[0].closedAt).toBe("number");
  });

  test("terminateSession on already-Closed session is a no-op (no event)", () => {
    const session = openSession();
    session.terminateSession();
    const events = session.terminateSession();
    expect(events).toHaveLength(0);
  });

  test("subscribedChannels are cleared after terminateSession", () => {
    const session = openSession();
    const repo = makeRepo();
    session.subscribeToChannel("ch-1", 0, repo, vi.fn());
    session.terminateSession();
    // After termination, deliverMessage should be a silent drop
    const sendFn = vi.fn();
    session.deliverMessage(
      {
        type: "ChannelMessagePosted",
        channelId: "ch-1",
        messageId: "m-1",
        authorId: "user-42",
        content: "hi",
        seq: 1,
        postedAt: Date.now(),
        mentionedIds: [],
      },
      sendFn
    );
    expect(sendFn).not.toHaveBeenCalled();
  });
});

// ── deliverMessage ────────────────────────────────────────────────────────────

describe("WebSocketSession — deliverMessage", () => {
  const liveMsg: ChannelMessagePostedV1 = {
    type: "ChannelMessagePosted",
    channelId: "ch-1",
    messageId: "m-live",
    authorId: "user-42",
    content: "live message",
    seq: 99,
    postedAt: Date.now(),
    mentionedIds: [],
  };

  test("calls sendFn when session is Open and subscribed to the channel", () => {
    const session = openSession();
    const repo = makeRepo();
    session.subscribeToChannel("ch-1", 0, repo, vi.fn());
    const sendFn = vi.fn();
    session.deliverMessage(liveMsg, sendFn);
    expect(sendFn).toHaveBeenCalledWith(liveMsg);
  });

  test("does NOT call sendFn when session is Closed", () => {
    const session = openSession();
    const repo = makeRepo();
    session.subscribeToChannel("ch-1", 0, repo, vi.fn());
    session.terminateSession();
    const sendFn = vi.fn();
    session.deliverMessage(liveMsg, sendFn);
    expect(sendFn).not.toHaveBeenCalled();
  });

  test("does NOT call sendFn when session is Open but NOT subscribed to the channel", () => {
    const session = openSession();
    const sendFn = vi.fn();
    session.deliverMessage(liveMsg, sendFn);
    expect(sendFn).not.toHaveBeenCalled();
  });

  test("does NOT throw when session is Closed (silent drop)", () => {
    const session = openSession();
    session.terminateSession();
    expect(() => session.deliverMessage(liveMsg, vi.fn())).not.toThrow();
  });
});

// ── Integration: full catch-up wiring ────────────────────────────────────────

describe("WebSocketSession — integration", () => {
  test("post 5 messages, subscribe with lastKnownSeq=2 — receives seq 3,4,5 and correct MissedMessagesDelivered", () => {
    const repo = makeRepo("ch-1", "user-42");
    for (let i = 1; i <= 5; i++) {
      handlePostChannelMessage(
        { channelId: "ch-1", authorId: "user-42", content: `msg ${i}` },
        repo
      );
    }
    const session = new WebSocketSession("conn-1");
    session.registerSession("user-42");
    const received: number[] = [];
    const events = session.subscribeToChannel("ch-1", 2, repo, (msg) => {
      received.push((msg as ChannelMessagePostedV1).seq);
    });
    expect(received).toEqual([3, 4, 5]);
    const delivered = events.find((e) => e.type === "MissedMessagesDelivered");
    expect(delivered!.fromSeq).toBe(2);
    expect(delivered!.toSeq).toBe(5);
    expect(delivered!.messageCount).toBe(3);
  });

  test("post 3 messages, subscribe with lastKnownSeq=0 — receives all 3 in order", () => {
    const repo = makeRepo("ch-1", "user-42");
    for (let i = 1; i <= 3; i++) {
      handlePostChannelMessage(
        { channelId: "ch-1", authorId: "user-42", content: `msg ${i}` },
        repo
      );
    }
    const session = new WebSocketSession("conn-1");
    session.registerSession("user-42");
    const received: number[] = [];
    session.subscribeToChannel("ch-1", 0, repo, (msg) => {
      received.push((msg as ChannelMessagePostedV1).seq);
    });
    expect(received).toEqual([1, 2, 3]);
  });

  test("subscribe with lastKnownSeq=head — no catch-up, no MissedMessagesDelivered", () => {
    const repo = makeRepoWithMessages("ch-1", "user-42", 4);
    const session = new WebSocketSession("conn-1");
    session.registerSession("user-42");
    const sendFn = vi.fn();
    const events = session.subscribeToChannel("ch-1", 4, repo, sendFn);
    expect(sendFn).not.toHaveBeenCalled();
    expect(events.map((e) => e.type)).not.toContain("MissedMessagesDelivered");
  });
});
