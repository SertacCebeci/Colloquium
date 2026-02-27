import type { ChannelRepository } from "./ChannelRepository";
import { InvalidPayloadError, ChannelNotFoundError } from "./errors";

// ── CT-002 payload ────────────────────────────────────────────────────────────

export interface MemberAddedToChannelV1 {
  channelId: string;
  memberId: string;
  grantedAt: number;   // governance field — discarded
}

// ── ACL adapter ───────────────────────────────────────────────────────────────

export function handleMemberAddedToChannel(
  payload: MemberAddedToChannelV1,
  repo: ChannelRepository
): void {
  if (!payload.channelId?.trim()) {
    throw new InvalidPayloadError("MemberAddedToChannel payload missing required field: channelId");
  }
  if (!payload.memberId?.trim()) {
    throw new InvalidPayloadError("MemberAddedToChannel payload missing required field: memberId");
  }

  // Channel MUST already exist — do not create one if absent (CT-002 ordering guarantee)
  const channel = repo.findById(payload.channelId);
  if (!channel) {
    throw new ChannelNotFoundError(payload.channelId);
  }

  // grantedAt is intentionally not forwarded — membership timing is WO's concern
  const events = channel.grantChannelMembership(payload.memberId);
  repo.save(channel, events);
}
