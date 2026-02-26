/**
 * Component render tests for feat-009: e2e-channel-feed-playwright
 * Tests the ChannelFeedPage DOM structure and conditional rendering.
 * Hooks are mocked — these tests verify the component wiring, not hook logic.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@colloquium/ui", () => ({
  useInfiniteChannelFeed: vi.fn(),
  useMessageComposer: vi.fn(),
  useChannelPageErrorState: vi.fn(),
}));

vi.mock("react-router-dom", () => ({
  useParams: vi.fn(),
  useSearchParams: vi.fn(),
}));

import {
  useInfiniteChannelFeed,
  useMessageComposer,
  useChannelPageErrorState,
} from "@colloquium/ui";
import { useParams, useSearchParams } from "react-router-dom";
import { ChannelFeedPage } from "./ChannelFeedPage";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MESSAGE_1 = {
  messageId: "msg-001",
  authorId: "user-1",
  content: "First message",
  sequenceNumber: 1,
  postedAt: "2026-01-01T00:00:00Z",
};

const MESSAGE_2 = {
  messageId: "msg-002",
  authorId: "user-1",
  content: "Second message",
  sequenceNumber: 2,
  postedAt: "2026-01-01T00:01:00Z",
};

function makeFeedResult(overrides = {}) {
  return {
    state: "Loaded" as const,
    messages: [MESSAGE_1, MESSAGE_2],
    hasNextPage: false,
    nextCursor: null,
    error: null,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
    sentinelRef: { current: null },
    ...overrides,
  };
}

function makeComposerResult(overrides = {}) {
  return {
    state: "Idle" as const,
    inputValue: "",
    validationError: null,
    errorMessage: null,
    onChange: vi.fn(),
    onSubmit: vi.fn(),
    ...overrides,
  };
}

function makeErrorState(overrides = {}) {
  return {
    visible: false,
    message: "",
    retryable: false,
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(useParams).mockReturnValue({ channelId: "ch-test" });
  vi.mocked(useSearchParams).mockReturnValue([
    new URLSearchParams("token=tok-test"),
    vi.fn(),
  ] as ReturnType<typeof useSearchParams>);
  vi.mocked(useInfiniteChannelFeed).mockReturnValue(makeFeedResult());
  vi.mocked(useMessageComposer).mockReturnValue(makeComposerResult());
  vi.mocked(useChannelPageErrorState).mockReturnValue(makeErrorState());
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("ChannelFeedPage — DOM structure", () => {
  it("renders the channel-feed-page root element", () => {
    render(<ChannelFeedPage />);
    expect(screen.getByTestId("channel-feed-page")).toBeTruthy();
  });

  it("renders a messages container", () => {
    render(<ChannelFeedPage />);
    expect(screen.getByTestId("messages")).toBeTruthy();
  });

  it("renders each message with data-testid=message-{messageId}", () => {
    render(<ChannelFeedPage />);
    expect(screen.getByTestId("message-msg-001")).toBeTruthy();
    expect(screen.getByTestId("message-msg-002")).toBeTruthy();
  });

  it("renders message content inside each message element", () => {
    render(<ChannelFeedPage />);
    expect(screen.getByText("First message")).toBeTruthy();
    expect(screen.getByText("Second message")).toBeTruthy();
  });

  it("renders the sentinel div for infinite scroll", () => {
    render(<ChannelFeedPage />);
    expect(screen.getByTestId("sentinel")).toBeTruthy();
  });

  it("renders the composer textarea", () => {
    render(<ChannelFeedPage />);
    expect(screen.getByTestId("composer-input")).toBeTruthy();
  });

  it("renders the composer send button", () => {
    render(<ChannelFeedPage />);
    expect(screen.getByTestId("composer-send")).toBeTruthy();
  });
});

describe("ChannelFeedPage — error banner", () => {
  it("does NOT render error-banner when errorState.visible=false", () => {
    vi.mocked(useChannelPageErrorState).mockReturnValue(makeErrorState({ visible: false }));
    render(<ChannelFeedPage />);
    expect(screen.queryByTestId("error-banner")).toBeNull();
  });

  it("renders error-banner when errorState.visible=true", () => {
    vi.mocked(useChannelPageErrorState).mockReturnValue(
      makeErrorState({ visible: true, message: "Feed failed", retryable: true })
    );
    render(<ChannelFeedPage />);
    expect(screen.getByTestId("error-banner")).toBeTruthy();
  });

  it("renders error-message text inside error-banner", () => {
    vi.mocked(useChannelPageErrorState).mockReturnValue(
      makeErrorState({ visible: true, message: "Internal Server Error", retryable: true })
    );
    render(<ChannelFeedPage />);
    expect(screen.getByTestId("error-message").textContent).toBe("Internal Server Error");
  });

  it("renders retry-button when errorState.retryable=true", () => {
    vi.mocked(useChannelPageErrorState).mockReturnValue(
      makeErrorState({ visible: true, message: "Feed error", retryable: true })
    );
    render(<ChannelFeedPage />);
    expect(screen.getByTestId("retry-button")).toBeTruthy();
  });

  it("does NOT render retry-button when errorState.retryable=false", () => {
    vi.mocked(useChannelPageErrorState).mockReturnValue(
      makeErrorState({ visible: true, message: "Unauthorized", retryable: false })
    );
    render(<ChannelFeedPage />);
    expect(screen.queryByTestId("retry-button")).toBeNull();
  });
});

describe("ChannelFeedPage — hook wiring", () => {
  it("calls useInfiniteChannelFeed with channelId from params and token from query", () => {
    render(<ChannelFeedPage />);
    expect(useInfiniteChannelFeed).toHaveBeenCalledWith("ch-test", "tok-test");
  });

  it("calls useMessageComposer with channelId from params and token from query", () => {
    render(<ChannelFeedPage />);
    expect(useMessageComposer).toHaveBeenCalledWith("ch-test", "tok-test");
  });

  it("passes feed and composer results to useChannelPageErrorState", () => {
    const feedResult = makeFeedResult();
    const composerResult = makeComposerResult();
    vi.mocked(useInfiniteChannelFeed).mockReturnValue(feedResult);
    vi.mocked(useMessageComposer).mockReturnValue(composerResult);
    render(<ChannelFeedPage />);
    expect(useChannelPageErrorState).toHaveBeenCalledWith(feedResult, composerResult);
  });

  it("disables composer textarea while composer state is Submitting", () => {
    vi.mocked(useMessageComposer).mockReturnValue(makeComposerResult({ state: "Submitting" }));
    render(<ChannelFeedPage />);
    const textarea = screen.getByTestId("composer-input") as HTMLTextAreaElement;
    expect(textarea.disabled).toBe(true);
  });
});
