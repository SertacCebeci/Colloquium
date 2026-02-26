import "dotenv/config";
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { swaggerUI } from "@hono/swagger-ui";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import jwt from "jsonwebtoken";
import {
  ChannelRepository,
  InMemoryChannelEventStore,
  handleGetChannelMessages,
  handlePostChannelMessage,
  InvalidPayloadError,
  ChannelNotFoundError,
  ChannelAccessDeniedError,
  MessageValidationFailedError,
} from "@colloquium/messaging";
import type { AppDb } from "./db/index.js";

// ── Zod schemas (kept in sync with @colloquium/messaging types) ───────────────

const MessageItemSchema = z.object({
  messageId: z.string(),
  authorId: z.string(),
  content: z.string(),
  sequenceNumber: z.number().int(),
  postedAt: z.string(),
});

const ChannelFeedPageSchema = z.object({
  messages: z.array(MessageItemSchema),
  nextCursor: z.string().nullable(),
});

const ErrorSchema = z.object({ error: z.string() });

// ── Route definition ──────────────────────────────────────────────────────────

const GetChannelMessagesRoute = createRoute({
  method: "get",
  path: "/channels/{channelId}/messages",
  request: {
    params: z.object({ channelId: z.string() }),
    query: z.object({
      before: z.string().optional(),
      limit: z.string().optional(),
    }),
  },
  responses: {
    200: {
      content: { "application/json": { schema: ChannelFeedPageSchema } },
      description: "Paginated channel message feed",
    },
    400: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Bad request (invalid limit or before param)",
    },
    401: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Missing or invalid Bearer JWT",
    },
    403: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Authenticated user is not a channel member",
    },
    404: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Channel not found",
    },
  },
});

const PostChannelMessageBodySchema = z.object({
  content: z.string(),
});

const PostChannelMessageResponseSchema = z.object({
  messageId: z.string(),
  channelId: z.string(),
  authorId: z.string(),
  content: z.string(),
  sequenceNumber: z.number().int(),
  postedAt: z.string(),
});

const PostChannelMessageRoute = createRoute({
  method: "post",
  path: "/channels/{channelId}/messages",
  request: {
    params: z.object({ channelId: z.string() }),
    body: {
      content: { "application/json": { schema: PostChannelMessageBodySchema } },
      required: true,
    },
  },
  responses: {
    201: {
      content: { "application/json": { schema: PostChannelMessageResponseSchema } },
      description: "Message posted successfully",
    },
    400: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Missing or malformed request body",
    },
    401: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Missing or invalid Bearer JWT",
    },
    403: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Authenticated user is not a channel member",
    },
    404: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Channel not found",
    },
    422: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Content validation failed (empty or too long)",
    },
  },
});

// ── App factory ───────────────────────────────────────────────────────────────

export function createApp(_db: AppDb, channelRepo?: ChannelRepository) {
  const app = new OpenAPIHono({
    defaultHook: (result, c) => {
      if (!result.success) {
        return c.json({ error: result.error.message }, 400);
      }
    },
  });
  const repo = channelRepo ?? new ChannelRepository(new InMemoryChannelEventStore());
  const jwtSecret = process.env.JWT_SECRET ?? "dev-secret";
  if (!process.env.JWT_SECRET) {
    console.warn("[security] JWT_SECRET not set — using insecure dev-secret fallback");
  }

  app.use("*", logger());
  app.use(
    "*",
    cors({
      origin: process.env.FRONTEND_URL ?? "http://localhost:5174",
      credentials: true,
    })
  );

  // Health check (plain route — no OpenAPI schema needed)
  app.get("/api/health", (c) => {
    return c.json({ status: "ok", service: "colloquium-api" });
  });

  // OpenAPI spec + Swagger UI
  app.doc("/api/openapi.json", {
    openapi: "3.1.0",
    info: { title: "Colloquium API", version: "1.0.0" },
  });
  app.get("/api/docs", swaggerUI({ url: "/api/openapi.json" }));

  // POST /channels/:channelId/messages
  app.openapi(PostChannelMessageRoute, (c) => {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    let authorId: string;
    try {
      const token = authHeader.slice(7);
      const decoded = jwt.verify(token, jwtSecret) as { sub?: string };
      if (!decoded.sub) throw new Error("Missing sub claim");
      authorId = decoded.sub;
    } catch {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const { channelId } = c.req.valid("param");
    const { content } = c.req.valid("json");

    try {
      const result = handlePostChannelMessage({ channelId, authorId, content }, repo);
      return c.json(
        {
          messageId: result.messageId,
          channelId: result.channelId,
          authorId: result.authorId,
          content: result.content,
          sequenceNumber: result.seq,
          postedAt: new Date(result.postedAt).toISOString(),
        },
        201
      );
    } catch (e) {
      if (e instanceof ChannelNotFoundError) return c.json({ error: "Channel not found" }, 404);
      if (e instanceof ChannelAccessDeniedError)
        return c.json({ error: "Channel not accessible" }, 403);
      if (e instanceof MessageValidationFailedError) {
        const msg =
          e.reason === "EMPTY_CONTENT"
            ? "Message content must not be empty"
            : "Message content must not exceed 4000 characters";
        return c.json({ error: msg }, 422);
      }
      if (e instanceof InvalidPayloadError) return c.json({ error: e.message }, 400);
      throw e;
    }
  });

  // GET /channels/:channelId/messages
  app.openapi(GetChannelMessagesRoute, (c) => {
    // JWT verification — returns 401 for missing or malformed tokens
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    let requesterId: string;
    try {
      const token = authHeader.slice(7);
      const decoded = jwt.verify(token, jwtSecret) as { sub?: string };
      if (!decoded.sub) throw new Error("Missing sub claim");
      requesterId = decoded.sub;
    } catch {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const { channelId } = c.req.valid("param");
    const { limit: limitStr, before: beforeStr } = c.req.valid("query");
    const limit = limitStr !== undefined ? Number(limitStr) : undefined;
    const before = beforeStr !== undefined ? Number(beforeStr) : undefined;

    try {
      const result = handleGetChannelMessages({ channelId, requesterId, limit, before }, repo);
      return c.json(result, 200);
    } catch (e) {
      if (e instanceof ChannelNotFoundError) return c.json({ error: "Channel not found" }, 404);
      if (e instanceof ChannelAccessDeniedError)
        return c.json({ error: "Channel not accessible" }, 403);
      if (e instanceof InvalidPayloadError) return c.json({ error: e.message }, 400);
      throw e;
    }
  });

  return app;
}

export default createApp;
