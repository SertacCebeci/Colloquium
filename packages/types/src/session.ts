import { z } from "zod";

export const SessionStatusSchema = z.enum([
  "in_progress",
  "interrupted",
  "awaiting_input",
  "ready_for_review",
]);
export type SessionStatus = z.infer<typeof SessionStatusSchema>;

export const SessionSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: SessionStatusSchema,
  workingDirectory: z.string(),
  agentVersion: z.string().optional(),
  taskDescription: z.string().optional(),
  startedAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  planId: z.string().nullable(),
});
export type Session = z.infer<typeof SessionSchema>;

export const PlanSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  content: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Plan = z.infer<typeof PlanSchema>;

export const CommentSchema = z.object({
  id: z.string(),
  planId: z.string(),
  lineNumber: z.number().int().min(1),
  body: z.string(),
  createdAt: z.string().datetime(),
});
export type Comment = z.infer<typeof CommentSchema>;

export const CreateCommentRequestSchema = z.object({
  lineNumber: z.number().int().min(1),
  body: z.string().min(1),
});
export type CreateCommentRequest = z.infer<typeof CreateCommentRequestSchema>;

export const UpdateSessionStatusRequestSchema = z.object({
  status: SessionStatusSchema,
});
export type UpdateSessionStatusRequest = z.infer<typeof UpdateSessionStatusRequestSchema>;

export const SessionDetailResponseSchema = z.object({
  session: SessionSchema,
  plan: PlanSchema.nullable(),
  comments: z.array(CommentSchema),
});
export type SessionDetailResponse = z.infer<typeof SessionDetailResponseSchema>;
