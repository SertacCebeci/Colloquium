/**
 * CT-005 consumer contract tests for feat-007: channel-message-form-state
 * Verifies that postChannelMessage correctly implements the CT-005 API contract:
 *   POST /channels/:channelId/messages
 * No React, no TanStack Query — tests the HTTP adapter function directly.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { postChannelMessage } from "./useMessageComposer";

const CHANNEL_ID = "ch-abc123";
const TOKEN = "test-token-xyz";
const CONTENT = "Hello, channel!";

const VALID_201_RESPONSE = {
  messageId: "msg-uuid-001",
  channelId: CHANNEL_ID,
  authorId: "user-uuid-001",
  content: CONTENT,
  sequenceNumber: 42,
  postedAt: "2026-02-26T18:00:00.000Z",
};

describe("CT-005: PostChannelMessage — consumer contract", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Request shape ───────────────────────────────────────────────────────────

  it("sends POST to /channels/:channelId/messages", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(VALID_201_RESPONSE), { status: 201 })
    );
    await postChannelMessage(CHANNEL_ID, CONTENT, TOKEN);
    expect(fetch).toHaveBeenCalledWith(
      `/channels/${CHANNEL_ID}/messages`,
      expect.objectContaining({ method: "POST" })
    );
  });

  it("includes Authorization header with Bearer token", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(VALID_201_RESPONSE), { status: 201 })
    );
    await postChannelMessage(CHANNEL_ID, CONTENT, TOKEN);
    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer ${TOKEN}`,
        }),
      })
    );
  });

  it("sends Content-Type: application/json header", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(VALID_201_RESPONSE), { status: 201 })
    );
    await postChannelMessage(CHANNEL_ID, CONTENT, TOKEN);
    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
      })
    );
  });

  it("sends request body with content field only (not authorId)", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(VALID_201_RESPONSE), { status: 201 })
    );
    await postChannelMessage(CHANNEL_ID, CONTENT, TOKEN);
    const call = vi.mocked(fetch).mock.calls[0]!;
    const body = JSON.parse(call[1]!.body as string) as Record<string, unknown>;
    expect(body).toEqual({ content: CONTENT });
    expect(body).not.toHaveProperty("authorId"); // authorId comes from JWT, not request body
  });

  // ── 201 success response ────────────────────────────────────────────────────

  it("returns all six fields from a 201 response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(VALID_201_RESPONSE), { status: 201 })
    );
    const result = await postChannelMessage(CHANNEL_ID, CONTENT, TOKEN);
    expect(result.messageId).toBe(VALID_201_RESPONSE.messageId);
    expect(result.channelId).toBe(VALID_201_RESPONSE.channelId);
    expect(result.authorId).toBe(VALID_201_RESPONSE.authorId);
    expect(result.content).toBe(VALID_201_RESPONSE.content);
    expect(result.sequenceNumber).toBe(VALID_201_RESPONSE.sequenceNumber);
    expect(result.postedAt).toBe(VALID_201_RESPONSE.postedAt);
  });

  it("response fields are MessageItem-compatible (no transformation needed for cache append)", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(VALID_201_RESPONSE), { status: 201 })
    );
    const result = await postChannelMessage(CHANNEL_ID, CONTENT, TOKEN);
    // CT-005 guarantees these fields match MessageItem shape from CT-004
    expect(typeof result.messageId).toBe("string");
    expect(typeof result.authorId).toBe("string");
    expect(typeof result.content).toBe("string");
    expect(typeof result.sequenceNumber).toBe("number");
    expect(typeof result.postedAt).toBe("string");
  });

  // ── Error responses ─────────────────────────────────────────────────────────

  it("throws with server error message on 401", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    );
    await expect(postChannelMessage(CHANNEL_ID, CONTENT, TOKEN)).rejects.toThrow("Unauthorized");
  });

  it("throws with server error message on 403", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "You are not a member of this channel" }), {
        status: 403,
      })
    );
    await expect(postChannelMessage(CHANNEL_ID, CONTENT, TOKEN)).rejects.toThrow(
      "You are not a member of this channel"
    );
  });

  it("throws with server error message on 422 (validation failure)", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "content too long" }), { status: 422 })
    );
    await expect(postChannelMessage(CHANNEL_ID, CONTENT, TOKEN)).rejects.toThrow(
      "content too long"
    );
  });

  it("throws with server error message on 404 (channel not found)", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Channel not found" }), { status: 404 })
    );
    await expect(postChannelMessage(CHANNEL_ID, CONTENT, TOKEN)).rejects.toThrow(
      "Channel not found"
    );
  });

  it("falls back to HTTP status text when error response body has no error field", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({}), { status: 500, statusText: "Internal Server Error" })
    );
    await expect(postChannelMessage(CHANNEL_ID, CONTENT, TOKEN)).rejects.toThrow(
      "Internal Server Error"
    );
  });
});
