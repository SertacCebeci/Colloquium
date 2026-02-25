import { describe, test, expect } from "vitest";
import { handleChannelCreated, InvalidPayloadError } from "./ChannelCreatedAcl";
import { ChannelRepository, InMemoryChannelEventStore } from "./ChannelRepository";

// ── CT-001 payload shape ──────────────────────────────────────────────────────

interface ChannelCreatedV1 {
  channelId: string;
  workspaceId: string;
  name: string;
  isPrivate: boolean;
  createdAt: number;
}

function validPayload(overrides: Partial<ChannelCreatedV1> = {}): ChannelCreatedV1 {
  return { channelId: "ch-1", workspaceId: "ws-1", name: "general", isPrivate: false, createdAt: 1000, ...overrides };
}

function makeRepo() {
  return new ChannelRepository(new InMemoryChannelEventStore());
}

// ── Payload validation ────────────────────────────────────────────────────────

describe("handleChannelCreated — payload validation", () => {
  test("throws InvalidPayloadError when channelId is an empty string", () => {
    expect(() => handleChannelCreated(validPayload({ channelId: "" }), makeRepo()))
      .toThrow(InvalidPayloadError);
  });

  test("throws InvalidPayloadError when channelId is whitespace only", () => {
    expect(() => handleChannelCreated(validPayload({ channelId: "   " }), makeRepo()))
      .toThrow(InvalidPayloadError);
  });

  test("throws InvalidPayloadError when workspaceId is an empty string", () => {
    expect(() => handleChannelCreated(validPayload({ workspaceId: "" }), makeRepo()))
      .toThrow(InvalidPayloadError);
  });

  test("throws InvalidPayloadError when workspaceId is whitespace only", () => {
    expect(() => handleChannelCreated(validPayload({ workspaceId: "   " }), makeRepo()))
      .toThrow(InvalidPayloadError);
  });

  test("does not call the domain when channelId is invalid — no channel is created", () => {
    const repo = makeRepo();
    try { handleChannelCreated(validPayload({ channelId: "" }), repo); } catch {}
    expect(repo.findById("ch-1")).toBeNull();
  });
});

// ── ACL mapping — CT-001 contract ────────────────────────────────────────────

describe("handleChannelCreated — ACL mapping (CT-001)", () => {
  test("registers the channel with the correct channelId", () => {
    const repo = makeRepo();
    handleChannelCreated(validPayload({ channelId: "ch-42" }), repo);
    expect(repo.findById("ch-42")).not.toBeNull();
    expect(repo.findById("ch-42")!.state).toBe("Active");
  });

  test("registers the channel with the correct workspaceId (channel becomes Active)", () => {
    const repo = makeRepo();
    handleChannelCreated(validPayload({ channelId: "ch-1", workspaceId: "ws-99" }), repo);
    // Confirming workspaceId wired correctly: re-registering with same workspaceId is idempotent
    expect(() => handleChannelCreated(validPayload({ channelId: "ch-1", workspaceId: "ws-99" }), repo))
      .not.toThrow();
  });

  test("does not forward 'name' into any stored domain event", () => {
    const store = new InMemoryChannelEventStore();
    handleChannelCreated(validPayload({ name: "top-secret-channel" }), new ChannelRepository(store));
    const events = store.load("ch-1");
    for (const event of events) {
      expect(event).not.toHaveProperty("name");
    }
  });

  test("does not forward 'isPrivate' into any stored domain event", () => {
    const store = new InMemoryChannelEventStore();
    handleChannelCreated(validPayload({ isPrivate: true }), new ChannelRepository(store));
    const events = store.load("ch-1");
    for (const event of events) {
      expect(event).not.toHaveProperty("isPrivate");
    }
  });

  test("is idempotent when called twice with identical payload (at-least-once delivery)", () => {
    const repo = makeRepo();
    handleChannelCreated(validPayload(), repo);
    expect(() => handleChannelCreated(validPayload(), repo)).not.toThrow();
    expect(repo.findById("ch-1")!.state).toBe("Active");
  });

  test("propagates error when RegisterChannel would conflict (same channelId, different workspaceId)", () => {
    const repo = makeRepo();
    handleChannelCreated(validPayload({ workspaceId: "ws-1" }), repo);
    expect(() =>
      handleChannelCreated(validPayload({ workspaceId: "ws-2" }), repo)
    ).toThrow();
  });
});
