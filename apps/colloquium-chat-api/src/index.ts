import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { getDb } from "./db/index.js";
import fs from "node:fs";
import path from "node:path";

const dbPath = process.env.DATABASE_PATH ?? "./db/chat.db";
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = getDb();
const app = createApp(db);
const PORT = Number(process.env.PORT ?? 5001);

serve(
  {
    fetch: app.fetch,
    port: PORT,
  },
  (info) => {
    console.log(`colloquium-chat-api running on http://localhost:${info.port}`);
  }
);
