import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { InfiniteData } from "@tanstack/react-query";
import type { ChannelFeedPageV1 } from "@colloquium/messaging";

// ── Types ────────────────────────────────────────────────────────────────────

export type MessageComposerState = "Idle" | "Typing" | "Submitting" | "Error";

export interface UseMessageComposerResult {
  state: MessageComposerState;
  inputValue: string;
  validationError: string | null;
  errorMessage: string | null;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

// ── Pure domain functions (exported for unit testing) ────────────────────────

/**
 * Validates message content before submission.
 * Returns null if content is valid, "empty" if blank/whitespace, "too-long" if > 4000 chars.
 */
export function validateInput(content: string): string | null {
  if (content.trim().length === 0) return "empty";
  if (content.length > 4000) return "too-long";
  return null;
}

/**
 * Derives MessageComposerState from TanStack Query mutation status + current inputValue.
 * isPending takes priority over isError (mutation cannot be both settled and pending).
 */
export function mapMutationStateToComposerState(
  isPending: boolean,
  isError: boolean,
  inputValue: string
): MessageComposerState {
  if (isPending) return "Submitting";
  if (isError) return "Error";
  if (inputValue.trim().length > 0) return "Typing";
  return "Idle";
}

// ── CT-005 HTTP adapter ───────────────────────────────────────────────────────

interface PostChannelMessageResponse {
  messageId: string;
  channelId: string;
  authorId: string;
  content: string;
  sequenceNumber: number;
  postedAt: string;
}

export async function postChannelMessage(
  channelId: string,
  content: string,
  token: string
): Promise<PostChannelMessageResponse> {
  const res = await fetch(`/channels/${channelId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((body as { error?: string }).error ?? res.statusText);
  }
  return res.json() as Promise<PostChannelMessageResponse>;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useMessageComposer(channelId: string, token: string): UseMessageComposerResult {
  const queryClient = useQueryClient();
  const [inputValue, setInputValue] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (content: string) => postChannelMessage(channelId, content, token),
    onSuccess: (data) => {
      // Prepend new message to the first page of the channelFeed cache — no re-fetch
      queryClient.setQueryData(
        ["channelFeed", channelId],
        (old: InfiniteData<ChannelFeedPageV1> | undefined) => {
          if (!old) return old;
          const newMessage = {
            messageId: data.messageId,
            authorId: data.authorId,
            content: data.content,
            sequenceNumber: data.sequenceNumber,
            postedAt: data.postedAt,
          };
          return {
            ...old,
            pages: old.pages.map((page, i) =>
              i === 0 ? { ...page, messages: [newMessage, ...page.messages] } : page
            ),
          };
        }
      );
      setInputValue("");
      setValidationError(null);
    },
  });

  const onChange = useCallback((value: string) => {
    setInputValue(value);
    // Clear validation error as user types (re-validated on next submit attempt)
    setValidationError(null);
  }, []);

  const onSubmit = useCallback(() => {
    if (mutation.isPending) return; // guard: no duplicate POST
    const error = validateInput(inputValue);
    if (error !== null) {
      setValidationError(error);
      return;
    }
    setValidationError(null);
    mutation.mutate(inputValue);
  }, [inputValue, mutation]);

  const state = mapMutationStateToComposerState(mutation.isPending, mutation.isError, inputValue);

  return {
    state,
    inputValue,
    validationError,
    errorMessage: mutation.isError
      ? mutation.error instanceof Error
        ? mutation.error.message
        : "Unknown error"
      : null,
    onChange,
    onSubmit,
  };
}
