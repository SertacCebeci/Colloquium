import type { ChannelRepository } from "./ChannelRepository";
import {
  InvalidPayloadError,
  ChannelNotFoundError,
  ChannelAccessDeniedError,
  MessageValidationFailedError,
} from "./errors";

// ── CT-003 payload ────────────────────────────────────────────────────────────

export interface PostChannelMessagePayload {
  channelId: string;
  authorId: string;
  content: string;
}

export interface ChannelMessagePostedV1 {
  type: "ChannelMessagePosted";
  channelId: string;
  messageId: string;
  authorId: string;
  content: string;
  seq: number;
  postedAt: number;
  mentionedIds: string[];
}

// ── ACL adapter ───────────────────────────────────────────────────────────────

export function handlePostChannelMessage(
  payload: PostChannelMessagePayload,
  repo: ChannelRepository
): ChannelMessagePostedV1 {
  if (!payload.channelId?.trim()) {
    throw new InvalidPayloadError("PostChannelMessage payload missing required field: channelId");
  }
  if (!payload.authorId?.trim()) {
    throw new InvalidPayloadError("PostChannelMessage payload missing required field: authorId");
  }
  // content guard: null/undefined/"" → InvalidPayloadError.
  // Whitespace-only ("   ") is intentionally NOT caught here — the domain applies
  // content.trim().length === 0 and emits MessageValidationFailed(EMPTY_CONTENT).
  if (!payload.content) {
    throw new InvalidPayloadError("PostChannelMessage payload missing required field: content");
  }

  const channel = repo.findById(payload.channelId);
  if (!channel) {
    throw new ChannelNotFoundError(payload.channelId);
  }

  const events = channel.postChannelMessage(payload.authorId, payload.content);

  // Inspect domain result — do NOT save on rejection
  const successEvent = events.find(e => e.type === "ChannelMessagePosted");

  if (!successEvent) {
    const failure = events[0];
    if (failure.type === "ChannelAccessDenied") {
      throw new ChannelAccessDeniedError(failure.channelId, failure.authorId);
    }
    if (failure.type === "MessageValidationFailed") {
      throw new MessageValidationFailedError(failure.channelId, failure.reason);
    }
    // Unreachable: domain only emits the three event types above from postChannelMessage
    throw new Error(`Unexpected domain event: ${(failure as any).type}`);
  }

  repo.save(channel, [successEvent]);

  return {
    type: successEvent.type,
    channelId: successEvent.channelId,
    messageId: successEvent.messageId,
    authorId: successEvent.authorId,
    content: successEvent.content,
    seq: successEvent.seq,
    postedAt: successEvent.postedAt,
    mentionedIds: successEvent.mentionedIds,
  };
}
