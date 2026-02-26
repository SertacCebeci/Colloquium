/**
 * Integration tests for feat-007: channel-message-form-state
 * Tests useMessageComposer with QueryClientProvider + mocked fetch.
 * Exercises: Idle→Typing→Submitting→Idle, error path, cache append, duplicate-submit guard.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, waitFor, fireEvent } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useMessageComposer } from "./useMessageComposer";
import type { UseMessageComposerResult } from "./useMessageComposer";

// ── Test harness ─────────────────────────────────────────────────────────────

/** Standard harness — submit button disabled when not Typing. */
function ComposerHarness({ channelId, token }: { channelId: string; token: string }) {
  const composer = useMessageComposer(channelId, token);
  return (
    <div>
      <span data-testid="state">{composer.state}</span>
      <span data-testid="validationError">{composer.validationError ?? ""}</span>
      <span data-testid="errorMessage">{composer.errorMessage ?? ""}</span>
      <textarea
        data-testid="input"
        value={composer.inputValue}
        onChange={(e) => composer.onChange(e.target.value)}
        disabled={composer.state === "Submitting"}
      />
      <button data-testid="submit" onClick={composer.onSubmit}>
        Send
      </button>
    </div>
  );
}

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, Wrapper };
}

const CHANNEL_ID = "ch-test";
const TOKEN = "tok-test";
const VALID_RESPONSE = {
  messageId: "msg-001",
  channelId: CHANNEL_ID,
  authorId: "user-001",
  content: "Hello!",
  sequenceNumber: 1,
  postedAt: "2026-02-26T18:00:00.000Z",
};

beforeEach(() => {
  vi.spyOn(globalThis, "fetch");
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("useMessageComposer integration", () => {
  it("starts in Idle state with empty inputValue", () => {
    const { Wrapper } = makeWrapper();
    render(
      <Wrapper>
        <ComposerHarness channelId={CHANNEL_ID} token={TOKEN} />
      </Wrapper>
    );
    expect(screen.getByTestId("state").textContent).toBe("Idle");
    expect((screen.getByTestId("input") as HTMLTextAreaElement).value).toBe("");
  });

  it("transitions to Typing when user enters text", () => {
    const { Wrapper } = makeWrapper();
    render(
      <Wrapper>
        <ComposerHarness channelId={CHANNEL_ID} token={TOKEN} />
      </Wrapper>
    );
    fireEvent.change(screen.getByTestId("input"), { target: { value: "Hello" } });
    expect(screen.getByTestId("state").textContent).toBe("Typing");
  });

  it("transitions back to Idle when input is cleared", () => {
    const { Wrapper } = makeWrapper();
    render(
      <Wrapper>
        <ComposerHarness channelId={CHANNEL_ID} token={TOKEN} />
      </Wrapper>
    );
    fireEvent.change(screen.getByTestId("input"), { target: { value: "Hello" } });
    expect(screen.getByTestId("state").textContent).toBe("Typing");
    fireEvent.change(screen.getByTestId("input"), { target: { value: "" } });
    expect(screen.getByTestId("state").textContent).toBe("Idle");
  });

  it("sets validationError='empty' and does NOT issue a POST when onSubmit called with empty input", () => {
    const { Wrapper } = makeWrapper();
    render(
      <Wrapper>
        <ComposerHarness channelId={CHANNEL_ID} token={TOKEN} />
      </Wrapper>
    );
    // Input is empty (Idle); click submit — hook's guard should set validationError, not POST
    fireEvent.click(screen.getByTestId("submit"));
    expect(screen.getByTestId("validationError").textContent).toBe("empty");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("transitions Typing→Submitting→Idle on successful POST", async () => {
    const { Wrapper } = makeWrapper();
    render(
      <Wrapper>
        <ComposerHarness channelId={CHANNEL_ID} token={TOKEN} />
      </Wrapper>
    );

    const deferred: { resolve: ((r: Response) => void) | null } = { resolve: null };
    vi.mocked(fetch).mockReturnValueOnce(
      new Promise<Response>((res) => {
        deferred.resolve = res;
      })
    );

    fireEvent.change(screen.getByTestId("input"), { target: { value: "Hello!" } });
    expect(screen.getByTestId("state").textContent).toBe("Typing");

    fireEvent.click(screen.getByTestId("submit"));
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("Submitting"));

    await act(async () => {
      deferred.resolve!(new Response(JSON.stringify(VALID_RESPONSE), { status: 201 }));
    });

    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("Idle"));
    expect((screen.getByTestId("input") as HTMLTextAreaElement).value).toBe("");
    expect(screen.getByTestId("validationError").textContent).toBe("");
  });

  it("transitions Typing→Submitting→Error on failed POST", async () => {
    const { Wrapper } = makeWrapper();
    render(
      <Wrapper>
        <ComposerHarness channelId={CHANNEL_ID} token={TOKEN} />
      </Wrapper>
    );

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    );

    fireEvent.change(screen.getByTestId("input"), { target: { value: "Hello!" } });
    fireEvent.click(screen.getByTestId("submit"));

    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("Error"));
    expect(screen.getByTestId("errorMessage").textContent).toBe("Unauthorized");
    // Input value preserved in Error state
    expect((screen.getByTestId("input") as HTMLTextAreaElement).value).toBe("Hello!");
  });

  it("appends new message to channelFeed cache on 201 success", async () => {
    const { queryClient, Wrapper } = makeWrapper();

    // Seed the cache with an initial page
    queryClient.setQueryData(["channelFeed", CHANNEL_ID], {
      pages: [
        {
          messages: [
            {
              messageId: "msg-000",
              authorId: "u0",
              content: "First",
              sequenceNumber: 0,
              postedAt: "2026-01-01T00:00:00Z",
            },
          ],
          nextCursor: null,
        },
      ],
      pageParams: [undefined],
    });

    render(
      <Wrapper>
        <ComposerHarness channelId={CHANNEL_ID} token={TOKEN} />
      </Wrapper>
    );

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(VALID_RESPONSE), { status: 201 })
    );

    fireEvent.change(screen.getByTestId("input"), { target: { value: "Hello!" } });
    fireEvent.click(screen.getByTestId("submit"));

    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("Idle"));

    const cached = queryClient.getQueryData(["channelFeed", CHANNEL_ID]) as {
      pages: Array<{ messages: Array<{ messageId: string }> }>;
    };
    expect(cached.pages[0]!.messages).toHaveLength(2);
    expect(cached.pages[0]!.messages[0]!.messageId).toBe("msg-001");
  });

  it("does not issue a second POST when onSubmit called during Submitting", async () => {
    const { Wrapper } = makeWrapper();
    render(
      <Wrapper>
        <ComposerHarness channelId={CHANNEL_ID} token={TOKEN} />
      </Wrapper>
    );

    const deferred: { resolve: ((r: Response) => void) | null } = { resolve: null };
    vi.mocked(fetch).mockReturnValueOnce(
      new Promise<Response>((res) => {
        deferred.resolve = res;
      })
    );

    fireEvent.change(screen.getByTestId("input"), { target: { value: "Hello!" } });
    fireEvent.click(screen.getByTestId("submit"));

    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("Submitting"));

    // Verify only 1 fetch call issued so far
    expect(fetch).toHaveBeenCalledTimes(1);

    // Click submit again while in Submitting — hook guard returns early (isPending check)
    fireEvent.click(screen.getByTestId("submit"));
    expect(fetch).toHaveBeenCalledTimes(1); // still only 1

    await act(async () => {
      deferred.resolve!(new Response(JSON.stringify(VALID_RESPONSE), { status: 201 }));
    });
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("Idle"));
    expect(fetch).toHaveBeenCalledTimes(1); // still only 1 call
  });

  it("UseMessageComposerResult includes all required fields", () => {
    const { Wrapper } = makeWrapper();
    let captured: UseMessageComposerResult | null = null;
    function CaptureHarness() {
      const result = useMessageComposer(CHANNEL_ID, TOKEN);
      captured = result;
      return null;
    }
    render(
      <Wrapper>
        <CaptureHarness />
      </Wrapper>
    );
    expect(captured).not.toBeNull();
    expect(captured).toHaveProperty("state");
    expect(captured).toHaveProperty("inputValue");
    expect(captured).toHaveProperty("validationError");
    expect(captured).toHaveProperty("errorMessage");
    expect(captured).toHaveProperty("onChange");
    expect(captured).toHaveProperty("onSubmit");
  });
});
