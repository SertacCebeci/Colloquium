import "dotenv/config";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import type { AppDb } from "./db/index.js";
import { authRoutes } from "./routes/auth.js";

export function createApp(db: AppDb) {
  const app = new Hono();

  app.use("*", logger());
  app.use(
    "*",
    cors({
      origin: process.env.FRONTEND_URL ?? "http://localhost:5173",
      credentials: true,
    })
  );

  app.get("/api/health", (c) => {
    return c.json({ status: "ok", service: "colloquium-chat-api" });
  });

  app.route("/api/auth", authRoutes(db));

  return app;
}

export default createApp;
