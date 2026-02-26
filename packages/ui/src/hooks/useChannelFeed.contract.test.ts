/**
 * Consumer contract tests for CT-004: GetChannelMessages
 * Verifies the fetchChannelPage adapter correctly:
 *   - Builds the URL and Authorization header
 *   - Appends `before` cursor on second-page fetches
 *   - Maps success response to ChannelFeedPageV1
 *   - Maps error responses to the correct error messages per spec Failure Modes
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchChannelPage } from "./useChannelFeed";
import type { ChannelFeedPageV1 } from "@colloquium/messaging";

// ── Helpers ────────────────────────────────────────────────────────────────

function mockFetch(status: number, body: unknown) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    })
  );
}

const FIXTURE_PAGE: ChannelFeedPageV1 = {
  messages: [
    {
      messageId: "msg-50",
      authorId: "user-1",
      content: "Hello",
      sequenceNumber: 50,
      postedAt: "2026-02-26T10:00:00.000Z",
    },
    {
      messageId: "msg-49",
      authorId: "user-2",
      content: "World",
      sequenceNumber: 49,
      postedAt: "2026-02-26T09:59:00.000Z",
    },
  ],
  nextCursor: "49",
};

beforeEach(() => {
  vi.restoreAllMocks();
});

// ── URL + Header construction ──────────────────────────────────────────────

describe("fetchChannelPage — request construction", () => {
  it("calls GET /channels/:channelId/messages on initial load (no cursor)", async () => {
    const spy = mockFetch(200, FIXTURE_PAGE);
    await fetchChannelPage("ch-1", "tok-abc");
    const [url, init] = spy.mock.calls[0];
    expect(url).toContain("/channels/ch-1/messages");
    expect(url).not.toContain("before=");
    expect((init as RequestInit).method ?? "GET").toBe("GET");
  });

  it("includes Authorization: Bearer <token> header on every request", async () => {
    const spy = mockFetch(200, FIXTURE_PAGE);
    await fetchChannelPage("ch-1", "my-token");
    const [, init] = spy.mock.calls[0];
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: "Bearer my-token",
    });
  });

  it("appends ?before=<cursor> on second-page fetches", async () => {
    const spy = mockFetch(200, FIXTURE_PAGE);
    await fetchChannelPage("ch-1", "tok-abc", "49");
    const [url] = spy.mock.calls[0];
    expect(url).toContain("before=49");
  });

  it("does not append before param when cursor is undefined", async () => {
    const spy = mockFetch(200, FIXTURE_PAGE);
    await fetchChannelPage("ch-1", "tok-abc", undefined);
    const [url] = spy.mock.calls[0];
    expect(url).not.toContain("before=");
  });
});

// ── Success response mapping ───────────────────────────────────────────────

describe("fetchChannelPage — success (200)", () => {
  it("returns a ChannelFeedPageV1 with messages and nextCursor", async () => {
    mockFetch(200, FIXTURE_PAGE);
    const result = await fetchChannelPage("ch-1", "tok");
    expect(result.messages).toHaveLength(2);
    expect(result.nextCursor).toBe("49");
  });

  it("handles an empty messages array (empty channel)", async () => {
    mockFetch(200, { messages: [], nextCursor: null });
    const result = await fetchChannelPage("ch-1", "tok");
    expect(result.messages).toEqual([]);
    expect(result.nextCursor).toBeNull();
  });

  it("handles a page with nextCursor = null (end of history)", async () => {
    mockFetch(200, { messages: FIXTURE_PAGE.messages, nextCursor: null });
    const result = await fetchChannelPage("ch-1", "tok");
    expect(result.nextCursor).toBeNull();
  });
});

// ── Error response mapping ─────────────────────────────────────────────────

describe("fetchChannelPage — error responses", () => {
  it("throws 'Unauthorized' on 401 (spec Failure Mode)", async () => {
    mockFetch(401, { error: "Unauthorized" });
    await expect(fetchChannelPage("ch-1", "bad-token")).rejects.toThrow("Unauthorized");
  });

  it("throws 'Channel not accessible' on 403 (spec Failure Mode)", async () => {
    mockFetch(403, { error: "Channel not accessible" });
    await expect(fetchChannelPage("ch-1", "tok")).rejects.toThrow("Channel not accessible");
  });

  it("throws 'Channel not found' on 404 (spec Failure Mode)", async () => {
    mockFetch(404, { error: "Channel not found" });
    await expect(fetchChannelPage("ch-1", "tok")).rejects.toThrow("Channel not found");
  });

  it("throws a non-empty error string on 500", async () => {
    mockFetch(500, { error: "Internal Server Error" });
    const rejection = fetchChannelPage("ch-1", "tok");
    await expect(rejection).rejects.toThrow();
    await expect(rejection).rejects.toHaveProperty("message");
  });
});
