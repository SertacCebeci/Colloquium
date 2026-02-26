/**
 * Integration tests for feat-008: channel-page-error-state
 * Tests useChannelPageErrorState composing useInfiniteChannelFeed + useMessageComposer.
 * Asserts derived error state across feed error, composer error, both error, and happy path.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, waitFor, fireEvent } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useInfiniteChannelFeed } from "./useInfiniteChannelFeed";
import { useMessageComposer } from "./useMessageComposer";
import { useChannelPageErrorState } from "./useChannelPageErrorState";

// ── Harness ───────────────────────────────────────────────────────────────────

function ErrorStateHarness({ channelId, token }: { channelId: string; token: string }) {
  const feed = useInfiniteChannelFeed(channelId, token);
  const composer = useMessageComposer(channelId, token);
  const errorState = useChannelPageErrorState(feed, composer);

  return (
    <div>
      <span data-testid="visible">{String(errorState.visible)}</span>
      <span data-testid="retryable">{String(errorState.retryable)}</span>
      <span data-testid="message">{errorState.message}</span>
      <span data-testid="feedState">{feed.state}</span>
      <span data-testid="composerState">{composer.state}</span>
      {/* Controls for triggering composer submit */}
      <textarea
        data-testid="input"
        value={composer.inputValue}
        onChange={(e) => composer.onChange(e.target.value)}
      />
      <button data-testid="send" onClick={composer.onSubmit}>
        Send
      </button>
      <button data-testid="retry" onClick={() => void feed.refetch()}>
        Retry
      </button>
    </div>
  );
}

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, Wrapper };
}

const CHANNEL_ID = "ch-test";
const TOKEN = "tok-test";
const FEED_PAGE = {
  messages: [
    {
      messageId: "m1",
      authorId: "u1",
      content: "Hi",
      sequenceNumber: 1,
      postedAt: "2026-01-01T00:00:00Z",
    },
  ],
  nextCursor: null,
};

beforeEach(() => {
  vi.spyOn(globalThis, "fetch");
});
afterEach(() => {
  vi.restoreAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("useChannelPageErrorState integration", () => {
  it("visible=false when feed loads successfully (happy path)", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(FEED_PAGE), { status: 200 })
    );
    const { Wrapper } = makeWrapper();
    render(
      <Wrapper>
        <ErrorStateHarness channelId={CHANNEL_ID} token={TOKEN} />
      </Wrapper>
    );
    await waitFor(() => expect(screen.getByTestId("feedState").textContent).toBe("Loaded"));
    expect(screen.getByTestId("visible").textContent).toBe("false");
    expect(screen.getByTestId("retryable").textContent).toBe("false");
    expect(screen.getByTestId("message").textContent).toBe("");
  });

  it("visible=true, retryable=true when feed GET returns 500", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 })
    );
    const { Wrapper } = makeWrapper();
    render(
      <Wrapper>
        <ErrorStateHarness channelId={CHANNEL_ID} token={TOKEN} />
      </Wrapper>
    );
    await waitFor(() => expect(screen.getByTestId("feedState").textContent).toBe("Error"));
    expect(screen.getByTestId("visible").textContent).toBe("true");
    expect(screen.getByTestId("retryable").textContent).toBe("true");
    expect(screen.getByTestId("message").textContent).toBe("Internal Server Error");
  });

  it("visible=true, retryable=false when composer POST returns 401", async () => {
    // Feed loads OK first
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(FEED_PAGE), { status: 200 })
    );
    const { Wrapper } = makeWrapper();
    render(
      <Wrapper>
        <ErrorStateHarness channelId={CHANNEL_ID} token={TOKEN} />
      </Wrapper>
    );
    await waitFor(() => expect(screen.getByTestId("feedState").textContent).toBe("Loaded"));

    // Now trigger composer error
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    );
    fireEvent.change(screen.getByTestId("input"), { target: { value: "Hello!" } });
    fireEvent.click(screen.getByTestId("send"));
    await waitFor(() => expect(screen.getByTestId("composerState").textContent).toBe("Error"));
    expect(screen.getByTestId("visible").textContent).toBe("true");
    expect(screen.getByTestId("retryable").textContent).toBe("false");
    expect(screen.getByTestId("message").textContent).toBe("Unauthorized");
  });

  it("feed error takes precedence when both are in Error — retryable=true", async () => {
    // Both feed and composer fail
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Feed unavailable" }), { status: 503 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
      );

    const { Wrapper } = makeWrapper();
    render(
      <Wrapper>
        <ErrorStateHarness channelId={CHANNEL_ID} token={TOKEN} />
      </Wrapper>
    );

    // Wait for feed error
    await waitFor(() => expect(screen.getByTestId("feedState").textContent).toBe("Error"));

    // Trigger composer error too
    fireEvent.change(screen.getByTestId("input"), { target: { value: "Hello!" } });
    fireEvent.click(screen.getByTestId("send"));
    await waitFor(() => expect(screen.getByTestId("composerState").textContent).toBe("Error"));

    // Feed error wins
    expect(screen.getByTestId("visible").textContent).toBe("true");
    expect(screen.getByTestId("retryable").textContent).toBe("true");
    expect(screen.getByTestId("message").textContent).toBe("Feed unavailable");
  });

  it("error clears when feed retries successfully", async () => {
    // First call: feed error
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "503" }), { status: 503 }))
      .mockResolvedValueOnce(
        // Second call: retry succeeds
        new Response(JSON.stringify(FEED_PAGE), { status: 200 })
      );

    const { Wrapper } = makeWrapper();
    render(
      <Wrapper>
        <ErrorStateHarness channelId={CHANNEL_ID} token={TOKEN} />
      </Wrapper>
    );

    await waitFor(() => expect(screen.getByTestId("feedState").textContent).toBe("Error"));
    expect(screen.getByTestId("visible").textContent).toBe("true");

    // Retry
    await act(async () => {
      fireEvent.click(screen.getByTestId("retry"));
    });
    await waitFor(() => expect(screen.getByTestId("feedState").textContent).toBe("Loaded"));
    expect(screen.getByTestId("visible").textContent).toBe("false");
    expect(screen.getByTestId("message").textContent).toBe("");
  });
});
