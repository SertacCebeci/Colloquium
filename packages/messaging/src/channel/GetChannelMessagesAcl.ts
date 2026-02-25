import type { ChannelRepository } from "./ChannelRepository";
import { queryChannelFeed } from "./ChannelFeedView";
import { InvalidPayloadError, ChannelNotFoundError, ChannelAccessDeniedError } from "./errors";

// ── CT-004 payload ────────────────────────────────────────────────────────────

export interface GetChannelMessagesPayload {
  channelId: string;
  requesterId: string;
  limit?: number; // default 50, max 50
  before?: number; // seq cursor — exclusive upper bound
}

// ── CT-004 response ───────────────────────────────────────────────────────────

export interface MessageItem {
  messageId: string;
  authorId: string;
  content: string;
  sequenceNumber: number;
  postedAt: string; // ISO 8601 UTC
}

export interface ChannelFeedPageV1 {
  messages: MessageItem[];
  nextCursor: string | null;
}

// ── ACL adapter ───────────────────────────────────────────────────────────────

export function handleGetChannelMessages(
  payload: GetChannelMessagesPayload,
  repo: ChannelRepository
): ChannelFeedPageV1 {
  if (!payload.channelId?.trim()) {
    throw new InvalidPayloadError("GetChannelMessages payload missing required field: channelId");
  }
  if (!payload.requesterId?.trim()) {
    throw new InvalidPayloadError("GetChannelMessages payload missing required field: requesterId");
  }

  const limit = payload.limit ?? 50;
  if (!Number.isInteger(limit) || limit <= 0 || limit > 50) {
    throw new InvalidPayloadError(
      "GetChannelMessages payload: limit must be a positive integer ≤ 50"
    );
  }
  if (payload.before !== undefined && (!Number.isInteger(payload.before) || payload.before <= 0)) {
    throw new InvalidPayloadError(
      "GetChannelMessages payload: before must be a positive integer when provided"
    );
  }

  const channel = repo.findById(payload.channelId);
  if (!channel) {
    throw new ChannelNotFoundError(payload.channelId);
  }
  if (!channel.hasMember(payload.requesterId)) {
    throw new ChannelAccessDeniedError(payload.channelId, payload.requesterId);
  }

  const raw = queryChannelFeed(
    { channelId: payload.channelId, limit, before: payload.before },
    repo
  );

  // CT-004: newest-first within the page (descending sequenceNumber).
  // queryChannelFeed returns ascending order; reverse to satisfy the contract.
  const messages: MessageItem[] = raw
    .map((m) => ({
      messageId: m.messageId,
      authorId: m.authorId,
      content: m.content,
      sequenceNumber: m.seq,
      postedAt: new Date(m.postedAt).toISOString(),
    }))
    .reverse();

  // nextCursor is the sequenceNumber of the oldest message in this page (last after reversal).
  const nextCursor =
    messages.length === limit ? String(messages[messages.length - 1].sequenceNumber) : null;

  return { messages, nextCursor };
}
