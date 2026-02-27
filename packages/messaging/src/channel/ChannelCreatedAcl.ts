import { Channel } from "./Channel";
import type { ChannelRepository } from "./ChannelRepository";
import { InvalidPayloadError } from "./errors";

// ── CT-001 payload ────────────────────────────────────────────────────────────

export interface ChannelCreatedV1 {
  channelId: string;
  workspaceId: string;
  name: string;        // governance field — discarded
  isPrivate: boolean;  // governance field — discarded
  createdAt: number;   // governance field — discarded
}

// Re-export for backward compatibility with existing imports
export { InvalidPayloadError };

// ── ACL adapter ───────────────────────────────────────────────────────────────

export function handleChannelCreated(
  payload: ChannelCreatedV1,
  repo: ChannelRepository
): void {
  if (!payload.channelId?.trim()) {
    throw new InvalidPayloadError("ChannelCreated payload missing required field: channelId");
  }
  if (!payload.workspaceId?.trim()) {
    throw new InvalidPayloadError("ChannelCreated payload missing required field: workspaceId");
  }

  // Load existing channel or create a new one — name and isPrivate are intentionally ignored
  const channel = repo.findById(payload.channelId) ?? new Channel(payload.channelId);
  const events = channel.registerChannel(payload.workspaceId);
  repo.save(channel, events);
}
