import { describe, test, expect, vi } from "vitest";
import { FanoutCoordinator } from "./FanoutCoordinator";
import type { MessageFanoutCompleted, SessionDeliveryFailed } from "./FanoutCoordinator";
import { DuplicateConnectionError, SessionNotFoundError } from "./errors";
import { ChannelRepository, InMemoryChannelEventStore } from "./ChannelRepository";
import { Channel } from "./Channel";
import { handlePostChannelMessage } from "./PostChannelMessageAcl";
import type { ChannelMessagePostedV1 } from "./PostChannelMessageAcl";

// ── Test helpers ───────────────────────────────────────────────────────────────

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

function makeLiveEvent(channelId = "ch-1"): ChannelMessagePostedV1 {
  return {
    type: "ChannelMessagePosted",
    channelId,
    messageId: `m-${Date.now()}`,
    authorId: "user-42",
    content: "live message",
    seq: 99,
    postedAt: Date.now(),
    mentionedIds: [],
  };
}

// ── openSession ────────────────────────────────────────────────────────────────

describe("FanoutCoordinator — openSession", () => {
  test("creates session in registry and returns WebSocketSessionOpened event", () => {
    const fc = new FanoutCoordinator();
    const events = fc.openSession("conn-1", "user-42", vi.fn());
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("WebSocketSessionOpened");
    expect(events[0].connectionId).toBe("conn-1");
    expect(events[0].memberId).toBe("user-42");
  });

  test("throws DuplicateConnectionError on duplicate connectionId without mutating existing session", () => {
    const fc = new FanoutCoordinator();
    const sendFn1 = vi.fn();
    fc.openSession("conn-1", "user-42", sendFn1);
    expect(() => fc.openSession("conn-1", "user-99", vi.fn())).toThrow(DuplicateConnectionError);

    // Existing session must remain usable (untouched) — subscribe still works
    const repo = makeRepo();
    expect(() => fc.subscribeToChannel("conn-1", "ch-1", 0, repo)).not.toThrow();
  });
});

// ── subscribeToChannel ────────────────────────────────────────────────────────

describe("FanoutCoordinator — subscribeToChannel", () => {
  test("delegates to session, adds to channel index, returns ChannelSubscriptionRegistered", () => {
    const fc = new FanoutCoordinator();
    fc.openSession("conn-1", "user-42", vi.fn());
    const repo = makeRepo();
    const events = fc.subscribeToChannel("conn-1", "ch-1", 0, repo);
    expect(events.map((e) => e.type)).toContain("ChannelSubscriptionRegistered");
    expect(fc.getSessionsForChannel("ch-1")).toContain("conn-1");
  });

  test("catch-up gap: stored sendFn is called for missed messages; MissedMessagesDelivered returned", () => {
    const fc = new FanoutCoordinator();
    const sendFn = vi.fn();
    fc.openSession("conn-1", "user-42", sendFn);
    const repo = makeRepoWithMessages("ch-1", "user-42", 5);

    const events = fc.subscribeToChannel("conn-1", "ch-1", 2, repo);

    expect(sendFn).toHaveBeenCalledTimes(3);
    const delivered = events.find((e) => e.type === "MissedMessagesDelivered");
    expect(delivered).toBeDefined();
    expect(delivered!.fromSeq).toBe(2);
    expect(delivered!.toSeq).toBe(5);
    expect(delivered!.messageCount).toBe(3);
  });

  test("throws SessionNotFoundError for unknown connectionId", () => {
    const fc = new FanoutCoordinator();
    const repo = makeRepo();
    expect(() => fc.subscribeToChannel("conn-unknown", "ch-1", 0, repo)).toThrow(
      SessionNotFoundError
    );
  });

  test("InvalidPayloadError: channel index is not updated", () => {
    const fc = new FanoutCoordinator();
    fc.openSession("conn-1", "user-42", vi.fn());
    const repo = makeRepo();
    expect(() => fc.subscribeToChannel("conn-1", "", 0, repo)).toThrow();
    expect(fc.getSessionsForChannel("")).toHaveLength(0);
    expect(fc.getSessionsForChannel("ch-1")).not.toContain("conn-1");
  });

  test("ChannelNotFoundError: channel index is not updated", () => {
    const fc = new FanoutCoordinator();
    fc.openSession("conn-1", "user-42", vi.fn());
    const repo = makeRepo(); // contains "ch-1", not "ch-unknown"
    expect(() => fc.subscribeToChannel("conn-1", "ch-unknown", 0, repo)).toThrow();
    expect(fc.getSessionsForChannel("ch-unknown")).toHaveLength(0);
  });
});

// ── unsubscribeFromChannel ────────────────────────────────────────────────────

describe("FanoutCoordinator — unsubscribeFromChannel", () => {
  test("removes from channel index and returns ChannelSubscriptionRemoved", () => {
    const fc = new FanoutCoordinator();
    fc.openSession("conn-1", "user-42", vi.fn());
    const repo = makeRepo();
    fc.subscribeToChannel("conn-1", "ch-1", 0, repo);

    const events = fc.unsubscribeFromChannel("conn-1", "ch-1");
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("ChannelSubscriptionRemoved");
    expect(fc.getSessionsForChannel("ch-1")).not.toContain("conn-1");
  });

  test("no-op for non-subscribed channel: no event emitted, no error thrown", () => {
    const fc = new FanoutCoordinator();
    fc.openSession("conn-1", "user-42", vi.fn());
    expect(() => {
      const events = fc.unsubscribeFromChannel("conn-1", "ch-not-subscribed");
      expect(events).toHaveLength(0);
    }).not.toThrow();
  });

  test("throws SessionNotFoundError for unknown connectionId", () => {
    const fc = new FanoutCoordinator();
    expect(() => fc.unsubscribeFromChannel("conn-unknown", "ch-1")).toThrow(SessionNotFoundError);
  });
});

// ── closeSession ──────────────────────────────────────────────────────────────

describe("FanoutCoordinator — closeSession", () => {
  test("removes session from registry, clears all channel index entries, returns WebSocketSessionClosed", () => {
    const fc = new FanoutCoordinator();
    fc.openSession("conn-1", "user-42", vi.fn());
    const repo = makeRepo();
    fc.subscribeToChannel("conn-1", "ch-1", 0, repo);

    const events = fc.closeSession("conn-1");
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("WebSocketSessionClosed");
    expect(events[0].connectionId).toBe("conn-1");
    expect(fc.getSessionsForChannel("ch-1")).not.toContain("conn-1");
  });

  test("closeSession clears entries from ALL subscribed channels, not just one", () => {
    const fc = new FanoutCoordinator();
    fc.openSession("conn-1", "user-42", vi.fn());

    const repo1 = makeRepo("ch-1");
    const repo2 = makeRepo("ch-2");
    const repo3 = makeRepo("ch-3");
    fc.subscribeToChannel("conn-1", "ch-1", 0, repo1);
    fc.subscribeToChannel("conn-1", "ch-2", 0, repo2);
    fc.subscribeToChannel("conn-1", "ch-3", 0, repo3);

    fc.closeSession("conn-1");

    expect(fc.getSessionsForChannel("ch-1")).not.toContain("conn-1");
    expect(fc.getSessionsForChannel("ch-2")).not.toContain("conn-1");
    expect(fc.getSessionsForChannel("ch-3")).not.toContain("conn-1");
  });

  test("throws SessionNotFoundError for unknown connectionId", () => {
    const fc = new FanoutCoordinator();
    expect(() => fc.closeSession("conn-unknown")).toThrow(SessionNotFoundError);
  });
});

// ── fanout ────────────────────────────────────────────────────────────────────

describe("FanoutCoordinator — fanout", () => {
  test("3 subscribed sessions all receive the message; MessageFanoutCompleted { sessionCount: 3 }", () => {
    const fc = new FanoutCoordinator();
    const sendFn1 = vi.fn();
    const sendFn2 = vi.fn();
    const sendFn3 = vi.fn();
    fc.openSession("conn-1", "user-1", sendFn1);
    fc.openSession("conn-2", "user-2", sendFn2);
    fc.openSession("conn-3", "user-3", sendFn3);
    const repo = makeRepo();
    fc.subscribeToChannel("conn-1", "ch-1", 0, repo);
    fc.subscribeToChannel("conn-2", "ch-1", 0, repo);
    fc.subscribeToChannel("conn-3", "ch-1", 0, repo);

    const event = makeLiveEvent("ch-1");
    const results = fc.fanout(event);

    expect(sendFn1).toHaveBeenCalledWith(event);
    expect(sendFn2).toHaveBeenCalledWith(event);
    expect(sendFn3).toHaveBeenCalledWith(event);
    const completed = results.find(
      (r): r is MessageFanoutCompleted => r.type === "MessageFanoutCompleted"
    );
    expect(completed?.sessionCount).toBe(3);
    expect(completed?.channelId).toBe("ch-1");
    expect(completed?.messageId).toBe(event.messageId);
  });

  test("1 sendFn throws: SessionDeliveryFailed for that session; other 2 still receive; sessionCount: 2", () => {
    const fc = new FanoutCoordinator();
    const failingSendFn = vi.fn().mockImplementation(() => {
      throw new Error("transport error");
    });
    const goodSendFn1 = vi.fn();
    const goodSendFn2 = vi.fn();
    fc.openSession("conn-fail", "user-1", failingSendFn);
    fc.openSession("conn-ok-1", "user-2", goodSendFn1);
    fc.openSession("conn-ok-2", "user-3", goodSendFn2);
    const repo = makeRepo();
    fc.subscribeToChannel("conn-fail", "ch-1", 0, repo);
    fc.subscribeToChannel("conn-ok-1", "ch-1", 0, repo);
    fc.subscribeToChannel("conn-ok-2", "ch-1", 0, repo);

    const event = makeLiveEvent("ch-1");
    const results = fc.fanout(event);

    const failures = results.filter(
      (r): r is SessionDeliveryFailed => r.type === "SessionDeliveryFailed"
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].connectionId).toBe("conn-fail");
    expect(failures[0].reason).toBe("transport error");
    expect(goodSendFn1).toHaveBeenCalledWith(event);
    expect(goodSendFn2).toHaveBeenCalledWith(event);
    const completed = results.find(
      (r): r is MessageFanoutCompleted => r.type === "MessageFanoutCompleted"
    );
    expect(completed?.sessionCount).toBe(2);
  });

  test("fanout never throws even when sendFn throws", () => {
    const fc = new FanoutCoordinator();
    const throwingSendFn = vi.fn().mockImplementation(() => {
      throw new Error("network gone");
    });
    fc.openSession("conn-1", "user-1", throwingSendFn);
    const repo = makeRepo();
    fc.subscribeToChannel("conn-1", "ch-1", 0, repo);
    expect(() => fc.fanout(makeLiveEvent("ch-1"))).not.toThrow();
  });

  test("no subscribers: MessageFanoutCompleted { sessionCount: 0 }; no errors", () => {
    const fc = new FanoutCoordinator();
    const results = fc.fanout(makeLiveEvent("ch-1"));
    expect(results).toHaveLength(1);
    const completed = results[0] as MessageFanoutCompleted;
    expect(completed.type).toBe("MessageFanoutCompleted");
    expect(completed.sessionCount).toBe(0);
  });

  test("race — session absent from registry: silently skipped; sessionCount: 0; no SessionDeliveryFailed", () => {
    const fc = new FanoutCoordinator();
    fc.openSession("conn-1", "user-42", vi.fn());
    const repo = makeRepo();
    fc.subscribeToChannel("conn-1", "ch-1", 0, repo);

    // Simulate race: forcibly remove session from registry while it remains in the channel index.
    // In production this can occur when closeSession races an in-flight fanout; here we use
    // white-box manipulation because the race cannot be reproduced in synchronous single-threaded JS.
    (fc as unknown as { sessions: Map<string, unknown> }).sessions.delete("conn-1");

    const results = fc.fanout(makeLiveEvent("ch-1"));
    const failures = results.filter((r) => r.type === "SessionDeliveryFailed");
    const completed = results.find(
      (r): r is MessageFanoutCompleted => r.type === "MessageFanoutCompleted"
    );
    expect(failures).toHaveLength(0);
    expect(completed?.sessionCount).toBe(0);
  });
});

// ── getSessionsForChannel ─────────────────────────────────────────────────────

describe("FanoutCoordinator — getSessionsForChannel", () => {
  test("reflects subscribe, unsubscribe, and closeSession mutations immediately", () => {
    const fc = new FanoutCoordinator();
    fc.openSession("conn-1", "user-42", vi.fn());
    fc.openSession("conn-2", "user-99", vi.fn());
    const repo = makeRepo();

    fc.subscribeToChannel("conn-1", "ch-1", 0, repo);
    fc.subscribeToChannel("conn-2", "ch-1", 0, repo);
    expect(fc.getSessionsForChannel("ch-1")).toHaveLength(2);

    fc.unsubscribeFromChannel("conn-1", "ch-1");
    expect(fc.getSessionsForChannel("ch-1")).toEqual(["conn-2"]);

    fc.closeSession("conn-2");
    expect(fc.getSessionsForChannel("ch-1")).toHaveLength(0);
  });

  test("returns empty array for a channel with no subscribers", () => {
    const fc = new FanoutCoordinator();
    expect(fc.getSessionsForChannel("ch-never-subscribed")).toEqual([]);
  });
});

// ── Integration: FanoutCoordinator + ChannelRepository + handlePostChannelMessage ──

describe("FanoutCoordinator — integration", () => {
  test("subscribe with lastKnownSeq=2 on a 5-message channel: catch-up delivers seq 3,4,5 via stored sendFn; MissedMessagesDelivered returned", () => {
    const repo = makeRepoWithMessages("ch-1", "user-42", 5);
    const fc = new FanoutCoordinator();
    const received: number[] = [];
    const sendFn = vi.fn().mockImplementation((msg: ChannelMessagePostedV1) => {
      received.push(msg.seq);
    });
    fc.openSession("conn-1", "user-42", sendFn);

    const events = fc.subscribeToChannel("conn-1", "ch-1", 2, repo);
    expect(received).toEqual([3, 4, 5]);
    const delivered = events.find((e) => e.type === "MissedMessagesDelivered");
    expect(delivered!.fromSeq).toBe(2);
    expect(delivered!.toSeq).toBe(5);
    expect(delivered!.messageCount).toBe(3);
  });

  test("two sessions subscribe to same channel; fanout delivers to both; sessionCount: 2", () => {
    const repo = makeRepo();
    const fc = new FanoutCoordinator();
    const sendFn1 = vi.fn();
    const sendFn2 = vi.fn();
    fc.openSession("conn-1", "user-42", sendFn1);
    fc.openSession("conn-2", "user-99", sendFn2);
    fc.subscribeToChannel("conn-1", "ch-1", 0, repo);
    fc.subscribeToChannel("conn-2", "ch-1", 0, repo);

    const event = handlePostChannelMessage(
      { channelId: "ch-1", authorId: "user-42", content: "hello" },
      repo
    );
    const results = fc.fanout(event);

    expect(sendFn1).toHaveBeenCalledWith(event);
    expect(sendFn2).toHaveBeenCalledWith(event);
    const completed = results.find(
      (r): r is MessageFanoutCompleted => r.type === "MessageFanoutCompleted"
    );
    expect(completed?.sessionCount).toBe(2);
  });

  test("session closed before fanout: MessageFanoutCompleted { sessionCount: 0 } — closed session drops silently", () => {
    const repo = makeRepo();
    const fc = new FanoutCoordinator();
    fc.openSession("conn-1", "user-42", vi.fn());
    fc.subscribeToChannel("conn-1", "ch-1", 0, repo);
    fc.closeSession("conn-1");

    const event = makeLiveEvent("ch-1");
    const results = fc.fanout(event);
    const completed = results.find(
      (r): r is MessageFanoutCompleted => r.type === "MessageFanoutCompleted"
    );
    expect(completed?.sessionCount).toBe(0);
  });

  test("closeSession clears all 3 channel index entries: getSessionsForChannel returns empty for each", () => {
    const repo1 = makeRepo("ch-1");
    const repo2 = makeRepo("ch-2");
    const repo3 = makeRepo("ch-3");
    const fc = new FanoutCoordinator();
    fc.openSession("conn-1", "user-42", vi.fn());
    fc.subscribeToChannel("conn-1", "ch-1", 0, repo1);
    fc.subscribeToChannel("conn-1", "ch-2", 0, repo2);
    fc.subscribeToChannel("conn-1", "ch-3", 0, repo3);

    fc.closeSession("conn-1");

    expect(fc.getSessionsForChannel("ch-1")).toHaveLength(0);
    expect(fc.getSessionsForChannel("ch-2")).toHaveLength(0);
    expect(fc.getSessionsForChannel("ch-3")).toHaveLength(0);
  });
});
