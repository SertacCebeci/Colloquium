import "dotenv/config";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import jwt from "jsonwebtoken";
import {
  ChannelRepository,
  InMemoryChannelEventStore,
  handleGetChannelMessages,
  InvalidPayloadError,
  ChannelNotFoundError,
  ChannelAccessDeniedError,
} from "@colloquium/messaging";
import type { AppDb } from "./db/index.js";

export function createApp(_db: AppDb, channelRepo?: ChannelRepository) {
  const app = new Hono();
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

  app.get("/api/health", (c) => {
    return c.json({ status: "ok", service: "colloquium-api" });
  });

  app.get("/channels/:channelId/messages", (c) => {
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

    // Query param parsing
    const channelId = c.req.param("channelId");
    const limitStr = c.req.query("limit");
    const beforeStr = c.req.query("before");
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
