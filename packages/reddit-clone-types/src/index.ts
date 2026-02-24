// Shared types for reddit-clone frontend and API
export type UserRole = "owner" | "moderator" | "member";
export type PostType = "text" | "link" | "image" | "video" | "poll" | "gallery";
export type CommunityType = "public" | "private" | "restricted";
export type VoteValue = 1 | -1 | 0;

export interface ApiUser {
  id: number;
  username: string;
  email: string;
  karmaPost: number;
  karmaComment: number;
  cakeDay: number;
  avatarUrl: string | null;
  bio: string | null;
  isPremium: boolean;
  coinBalance: number;
  createdAt: number;
}

export interface ApiCommunity {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  iconUrl: string | null;
  bannerUrl: string | null;
  type: CommunityType;
  memberCount: number;
  createdAt: number;
}

export interface ApiPost {
  id: number;
  title: string;
  body: string | null;
  url: string | null;
  type: PostType;
  authorId: number;
  authorUsername: string;
  communitySlug: string;
  flair: string | null;
  isNsfw: boolean;
  isSpoiler: boolean;
  isLocked: boolean;
  isStickied: boolean;
  score: number;
  commentCount: number;
  createdAt: number;
  editedAt: number | null;
}

export interface ApiComment {
  id: number;
  body: string;
  authorId: number;
  authorUsername: string;
  postId: number;
  parentCommentId: number | null;
  score: number;
  isRemoved: boolean;
  isDistinguished: boolean;
  createdAt: number;
  editedAt: number | null;
  replies: ApiComment[];
}
