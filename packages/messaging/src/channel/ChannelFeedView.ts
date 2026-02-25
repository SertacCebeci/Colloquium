import type { ChannelRepository } from "./ChannelRepository";
import type { ChannelMessagePostedV1 } from "./PostChannelMessageAcl";
import { InvalidPayloadError, ChannelNotFoundError } from "./errors";

export interface ChannelFeedPayload {
  channelId: string;
  limit: number;
  before?: number; // seq cursor — exclusive upper bound
}

export function queryChannelFeed(
  payload: ChannelFeedPayload,
  repo: ChannelRepository
): ChannelMessagePostedV1[] {
  if (!payload.channelId?.trim()) {
    throw new InvalidPayloadError("queryChannelFeed payload missing required field: channelId");
  }
  if (!Number.isInteger(payload.limit) || payload.limit <= 0) {
    throw new InvalidPayloadError("queryChannelFeed payload: limit must be a positive integer");
  }
  if (payload.before !== undefined && (!Number.isInteger(payload.before) || payload.before <= 0)) {
    throw new InvalidPayloadError("queryChannelFeed payload: before must be a positive integer when provided");
  }

  const messages = repo.findMessages(payload.channelId, payload.limit, payload.before);
  if (messages === null) {
    throw new ChannelNotFoundError(payload.channelId);
  }

  return messages.map(e => ({
    type: e.type,
    channelId: e.channelId,
    messageId: e.messageId,
    authorId: e.authorId,
    content: e.content,
    seq: e.seq,
    postedAt: e.postedAt,
    mentionedIds: e.mentionedIds,
  }));
}
