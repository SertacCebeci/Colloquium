/**
 * UAT seed server for feat-001 (channel-feed-aggregate)
 *
 * Starts colloquium-api on port 5099 with 75 pre-seeded messages in an
 * in-memory repo — no real database required.
 *
 * Run with:  tsx src/uat-seed-server.ts
 * Kill with: Ctrl-C
 */
import { serve } from "@hono/node-server";
import jwt from "jsonwebtoken";
import { Channel, ChannelRepository, InMemoryChannelEventStore } from "@colloquium/messaging";
import type { ChannelMessagePosted } from "@colloquium/messaging";
import { createApp } from "./app.js";
import { createDb } from "./db/index.js";

const UAT_SECRET = "uat-secret-2026";
const CHANNEL_ID = "ch-uat-001";
const MEMBER_ID = "uat-user-1";
const PORT = 5099;

// ── Seed repo with 75 messages ────────────────────────────────────────────────
const store = new InMemoryChannelEventStore();
const repo = new ChannelRepository(store);

const ch = new Channel(CHANNEL_ID);
const [registered] = ch.registerChannel("ws-uat");
repo.save(ch, [registered]);

const chWithMember = repo.findById(CHANNEL_ID)!;
const [membership] = chWithMember.grantChannelMembership(MEMBER_ID);
repo.save(chWithMember, [membership]);

for (let i = 0; i < 75; i++) {
  const chMsg = repo.findById(CHANNEL_ID)!;
  const events = chMsg.postChannelMessage(MEMBER_ID, `UAT message ${i + 1} of 75`);
  const posted = events.find((e): e is ChannelMessagePosted => e.type === "ChannelMessagePosted")!;
  repo.save(chMsg, [posted]);
}

// ── Token helper (logged for Playwright to use) ───────────────────────────────
process.env.JWT_SECRET = UAT_SECRET;
const token = jwt.sign({ sub: MEMBER_ID }, UAT_SECRET);

// ── Start server ──────────────────────────────────────────────────────────────
const db = createDb(":memory:");
const app = createApp(db, repo);

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log("UAT_SERVER_READY");
  console.log(`UAT_CHANNEL_ID=${CHANNEL_ID}`);
  console.log(`UAT_MEMBER_ID=${MEMBER_ID}`);
  console.log(`UAT_TOKEN=${token}`);
  console.log(`UAT_BASE_URL=http://localhost:${PORT}`);
});
