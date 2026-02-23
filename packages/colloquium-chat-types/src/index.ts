// Shared types for colloquium-chat frontend and API
// Zod schemas and inferred TypeScript types will be added here during development

export type UserRole = "owner" | "admin" | "member";
export type MessageCategory = "channel" | "dm" | "thread";

export interface ApiUser {
  id: number;
  email: string;
  username: string;
  displayName: string | null;
  avatar: string | null;
  statusEmoji: string | null;
  statusText: string | null;
  createdAt: number;
}

export interface ApiWorkspace {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
  ownerId: number;
  createdAt: number;
}

export interface ApiChannel {
  id: number;
  workspaceId: number;
  name: string;
  description: string | null;
  isPrivate: boolean;
  isArchived: boolean;
  createdBy: number;
  createdAt: number;
}

export interface ApiMessage {
  id: number;
  workspaceId: number;
  channelId: number | null;
  dmConversationId: number | null;
  threadParentId: number | null;
  author: ApiUser;
  content: string;
  contentRendered: string;
  editedAt: number | null;
  deletedAt: number | null;
  createdAt: number;
  replyCount?: number;
}

export type WebSocketEventType =
  | "message.new"
  | "message.update"
  | "message.delete"
  | "user.typing"
  | "user.typing.stop"
  | "user.presence"
  | "channel.updated";

export interface WebSocketEvent<T = unknown> {
  type: WebSocketEventType;
  payload: T;
}

export interface ApiError {
  error: string;
  code: string;
}
