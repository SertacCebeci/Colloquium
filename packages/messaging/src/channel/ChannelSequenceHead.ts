import type { ChannelRepository } from "./ChannelRepository";
import { InvalidPayloadError, ChannelNotFoundError } from "./errors";

export interface ChannelSequenceHeadPayload {
  channelId: string;
}

export function queryChannelSequenceHead(
  payload: ChannelSequenceHeadPayload,
  repo: ChannelRepository
): number {
  if (!payload.channelId?.trim()) {
    throw new InvalidPayloadError("queryChannelSequenceHead payload missing required field: channelId");
  }

  const head = repo.findSequenceHead(payload.channelId);
  if (head === null) {
    throw new ChannelNotFoundError(payload.channelId);
  }

  return head;
}
