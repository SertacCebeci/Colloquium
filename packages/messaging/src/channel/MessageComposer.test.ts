import { describe, test, expect } from "vitest";
import { MessageComposer } from "./MessageComposer";
import type { MessageItem } from "./GetChannelMessagesAcl";

// ── helpers ───────────────────────────────────────────────────────────────────

function idleComposer(): MessageComposer {
  return new MessageComposer("ch-1");
}

function typingComposer(content = "Hello"): MessageComposer {
  const c = new MessageComposer("ch-1");
  c.typeContent(content);
  return c;
}

function submittingComposer(content = "Hello"): MessageComposer {
  const c = typingComposer(content);
  c.submitMessage(content);
  return c;
}

function errorComposer(): MessageComposer {
  const c = submittingComposer();
  c.messageFailed(500, "Server error");
  return c;
}

function makeMessage(overrides: Partial<MessageItem> = {}): MessageItem {
  return {
    messageId: "msg-1",
    authorId: "user-1",
    content: "Hello",
    sequenceNumber: 1,
    postedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ── typeContent ───────────────────────────────────────────────────────────────

describe("typeContent", () => {
  test("transitions Idle → Typing when content is non-empty", () => {
    const c = idleComposer();
    c.typeContent("Hello");
    expect(c.state).toBe("Typing");
  });

  test("keeps state Idle when content is empty string", () => {
    const c = idleComposer();
    c.typeContent("");
    expect(c.state).toBe("Idle");
  });

  test("keeps state Typing → Typing as user continues typing", () => {
    const c = typingComposer("Hello");
    c.typeContent("Hello world");
    expect(c.state).toBe("Typing");
  });

  test("transitions Typing → Idle when user clears content", () => {
    const c = typingComposer("Hello");
    c.typeContent("");
    expect(c.state).toBe("Idle");
  });
});

// ── ValidateMessage ───────────────────────────────────────────────────────────

describe("ValidateMessage", () => {
  test("emits EmptyMessageRejected(empty) when content is empty string", () => {
    const c = idleComposer();
    const events = c.validateMessage("");
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "EmptyMessageRejected",
      reason: "empty",
      inputValue: "",
    });
  });

  test("emits EmptyMessageRejected(empty) when content is whitespace only", () => {
    const c = typingComposer("   ");
    const events = c.validateMessage("   ");
    expect(events[0]).toMatchObject({ type: "EmptyMessageRejected", reason: "empty" });
  });

  test("emits EmptyMessageRejected(too-long) when content exceeds 4000 characters", () => {
    const c = typingComposer("a".repeat(4001));
    const events = c.validateMessage("a".repeat(4001));
    expect(events[0]).toMatchObject({ type: "EmptyMessageRejected", reason: "too-long" });
  });

  test("does NOT change aggregate state (stays Idle)", () => {
    const c = idleComposer();
    c.validateMessage("");
    expect(c.state).toBe("Idle");
  });

  test("does NOT change aggregate state (stays Typing)", () => {
    const c = typingComposer("Hello");
    c.validateMessage("a".repeat(4001));
    expect(c.state).toBe("Typing");
  });

  test("does NOT mutate isSubmitting regardless of input", () => {
    const c = idleComposer();
    c.validateMessage("");
    expect(c.isSubmitting).toBe(false);
  });

  test("sets validationError to 'empty' on empty content", () => {
    const c = idleComposer();
    c.validateMessage("");
    expect(c.validationError).toBe("empty");
  });

  test("sets validationError to 'too-long' on oversized content", () => {
    const c = typingComposer("a");
    c.validateMessage("a".repeat(4001));
    expect(c.validationError).toBe("too-long");
  });

  test("clears validationError when content is valid", () => {
    const c = typingComposer("Hello");
    c.validateMessage("a".repeat(4001)); // set error
    c.validateMessage("Hello"); // clear it
    expect(c.validationError).toBeNull();
  });
});

// ── SubmitMessage ─────────────────────────────────────────────────────────────

describe("SubmitMessage", () => {
  test("transitions Typing → Submitting with valid content", () => {
    const c = typingComposer("Hello");
    c.submitMessage("Hello");
    expect(c.state).toBe("Submitting");
  });

  test("emits PostMessageAPICallMade with channelId and content", () => {
    const c = typingComposer("Hello");
    const events = c.submitMessage("Hello");
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "PostMessageAPICallMade",
      channelId: "ch-1",
      content: "Hello",
    });
  });

  test("rejects empty content — emits EmptyMessageRejected and stays in Typing", () => {
    const c = typingComposer("Hello");
    const events = c.submitMessage("");
    expect(events[0]).toMatchObject({ type: "EmptyMessageRejected", reason: "empty" });
    expect(c.state).toBe("Typing");
  });

  test("rejects whitespace-only content — emits EmptyMessageRejected(empty)", () => {
    const c = typingComposer("   ");
    const events = c.submitMessage("   ");
    expect(events[0]).toMatchObject({ type: "EmptyMessageRejected", reason: "empty" });
  });

  test("rejects content exceeding 4000 characters — emits EmptyMessageRejected(too-long)", () => {
    const longContent = "a".repeat(4001);
    const c = typingComposer(longContent);
    const events = c.submitMessage(longContent);
    expect(events[0]).toMatchObject({ type: "EmptyMessageRejected", reason: "too-long" });
    expect(c.state).toBe("Typing");
  });

  test("accepts content of exactly 4000 characters", () => {
    const content = "a".repeat(4000);
    const c = typingComposer(content);
    const events = c.submitMessage(content);
    expect(events[0]).toMatchObject({ type: "PostMessageAPICallMade" });
    expect(c.state).toBe("Submitting");
  });

  test("is a no-op when already Submitting (double-submit guard)", () => {
    const c = submittingComposer();
    const events = c.submitMessage("Hello");
    expect(events).toHaveLength(0);
    expect(c.state).toBe("Submitting");
  });

  test("transitions Error → Submitting on retry", () => {
    const c = errorComposer();
    const events = c.submitMessage("Hello");
    expect(events[0]).toMatchObject({ type: "PostMessageAPICallMade" });
    expect(c.state).toBe("Submitting");
  });
});

// ── messagePosted (success path: Submitting → Idle) ──────────────────────────

describe("messagePosted", () => {
  test("transitions Submitting → Idle", () => {
    const c = submittingComposer();
    c.messagePosted(makeMessage());
    expect(c.state).toBe("Idle");
  });

  test("emits MessageAppendedOptimistically with the received message", () => {
    const c = submittingComposer();
    const msg = makeMessage({ messageId: "msg-42", sequenceNumber: 42 });
    const events = c.messagePosted(msg);
    expect(events).toContainEqual({
      type: "MessageAppendedOptimistically",
      message: msg,
    });
  });

  test("emits MessageInputCleared on success path", () => {
    const c = submittingComposer();
    const events = c.messagePosted(makeMessage());
    expect(events).toContainEqual({ type: "MessageInputCleared" });
  });

  test("sets inputValue to empty string on success path", () => {
    const c = submittingComposer("Hello");
    c.messagePosted(makeMessage());
    expect(c.inputValue).toBe("");
  });

  test("sets isSubmitting to false on success path", () => {
    const c = submittingComposer();
    c.messagePosted(makeMessage());
    expect(c.isSubmitting).toBe(false);
  });
});

// ── messageFailed (error path: Submitting → Error) ───────────────────────────

describe("messageFailed", () => {
  test("transitions Submitting → Error", () => {
    const c = submittingComposer();
    c.messageFailed(500, "Server error");
    expect(c.state).toBe("Error");
  });

  test("emits APIErrorOccurred with source message-post and status code", () => {
    const c = submittingComposer();
    const events = c.messageFailed(429, "Rate limited");
    expect(events[0]).toMatchObject({
      type: "APIErrorOccurred",
      source: "message-post",
      statusCode: 429,
      message: "Rate limited",
    });
  });

  test("sets errorMessage to the provided message string", () => {
    const c = submittingComposer();
    c.messageFailed(401, "Session expired");
    expect(c.errorMessage).toBe("Session expired");
  });

  test("Error state errorMessage is non-null and non-empty", () => {
    const c = submittingComposer();
    c.messageFailed(403, "Not a member");
    expect(c.errorMessage).toBeTruthy();
    expect(c.errorMessage!.length).toBeGreaterThan(0);
  });
});

// ── Invariants ────────────────────────────────────────────────────────────────

describe("Invariants", () => {
  test("Invariant 1: Submitting requires inputValue.trim().length > 0", () => {
    // A blank submit must never reach Submitting state
    const c = typingComposer("   ");
    c.submitMessage("   ");
    expect(c.state).not.toBe("Submitting");
  });

  test("Invariant 2: Submitting → Idle atomically clears inputValue and isSubmitting", () => {
    const c = submittingComposer("My message");
    c.messagePosted(makeMessage());
    expect(c.state).toBe("Idle");
    expect(c.inputValue).toBe("");
    expect(c.isSubmitting).toBe(false);
  });

  test("Invariant 3: Error state carries a non-null non-empty errorMessage", () => {
    const c = errorComposer();
    expect(c.state).toBe("Error");
    expect(c.errorMessage).not.toBeNull();
    expect(c.errorMessage).not.toBe("");
  });

  test("Invariant 4: inputValue > 4000 chars blocks Submitting transition", () => {
    const c = typingComposer("a".repeat(4001));
    c.submitMessage("a".repeat(4001));
    expect(c.state).not.toBe("Submitting");
  });

  test("Invariant 5: ValidateMessage never mutates isSubmitting", () => {
    // From Idle: isSubmitting stays false
    const idle = idleComposer();
    idle.validateMessage("");
    expect(idle.isSubmitting).toBe(false);

    // From Typing: isSubmitting stays false
    const typing = typingComposer();
    typing.validateMessage("a".repeat(4001));
    expect(typing.isSubmitting).toBe(false);
  });
});
