import { z } from "zod";

export const PostStatusSchema = z.enum(["draft", "published"]);
export type PostStatus = z.infer<typeof PostStatusSchema>;

export const PostSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  slug: z.string().min(1),
  body: z.string().min(1),
  authorName: z.string().min(1),
  status: PostStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  publishedAt: z.string().nullable(),
});
export type Post = z.infer<typeof PostSchema>;

export const PostCommentSchema = z.object({
  id: z.string(),
  postId: z.string(),
  authorName: z.string().min(1),
  body: z.string().min(1),
  createdAt: z.string(),
});
export type PostComment = z.infer<typeof PostCommentSchema>;

export const CreatePostRequestSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1),
  body: z.string().min(1),
  authorName: z.string().min(1),
});
export type CreatePostRequest = z.infer<typeof CreatePostRequestSchema>;

export const UpdatePostRequestSchema = z.object({
  title: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  body: z.string().min(1).optional(),
  authorName: z.string().min(1).optional(),
  status: PostStatusSchema.optional(),
});
export type UpdatePostRequest = z.infer<typeof UpdatePostRequestSchema>;

export const CreatePostCommentRequestSchema = z.object({
  authorName: z.string().min(1),
  body: z.string().min(1),
});
export type CreatePostCommentRequest = z.infer<typeof CreatePostCommentRequestSchema>;
