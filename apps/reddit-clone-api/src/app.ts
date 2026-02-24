import "dotenv/config";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import type { AppDb } from "./db/index.js";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function createApp(db: AppDb) {
  const app = new Hono();

  app.use("*", logger());
  app.use(
    "*",
    cors({
      origin: process.env.FRONTEND_URL ?? "http://localhost:5174",
      credentials: true,
    })
  );

  app.get("/api/health", (c) => {
    return c.json({ status: "ok", service: "reddit-clone-api" });
  });

  return app;
}

export default createApp;
