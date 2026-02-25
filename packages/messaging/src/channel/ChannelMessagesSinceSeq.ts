import type { ChannelRepository } from "./ChannelRepository";
import type { ChannelMessagePostedV1 } from "./PostChannelMessageAcl";
import { InvalidPayloadError, ChannelNotFoundError } from "./errors";

export interface MessagesSinceSeqPayload {
  channelId: string;
  fromSeq: number;
}

export function queryMessagesSinceSeq(
  payload: MessagesSinceSeqPayload,
  repo: ChannelRepository
): ChannelMessagePostedV1[] {
  if (!payload.channelId?.trim()) {
    throw new InvalidPayloadError(
      "queryMessagesSinceSeq payload missing required field: channelId"
    );
  }
  if (
    payload.fromSeq === undefined ||
    payload.fromSeq === null ||
    !Number.isInteger(payload.fromSeq) ||
    payload.fromSeq < 0
  ) {
    throw new InvalidPayloadError(
      "queryMessagesSinceSeq payload: fromSeq must be a non-negative integer"
    );
  }

  const messages = repo.findMessagesSinceSeq(payload.channelId, payload.fromSeq);
  if (messages === null) {
    throw new ChannelNotFoundError(payload.channelId);
  }

  return messages.map((e) => ({
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
