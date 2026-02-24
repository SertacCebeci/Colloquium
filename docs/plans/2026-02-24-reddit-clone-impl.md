# Reddit Clone — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Bootstrap `apps/reddit-clone`, `apps/reddit-clone-api`, and `packages/reddit-clone-types` as first-class Colloquium monorepo members, create all project state files for the `colloquium:project` skill, and verify the scaffold by passing Test #1 (health check).

**Architecture:** Three new monorepo packages follow the exact pattern of `colloquium-chat`. The `colloquium:project` skill drives all ongoing feature development session-by-session using a 265-entry behavioral feature list. This plan covers bootstrap only — from zero to a running scaffold with one green test.

**Tech Stack:** React 18 + Vite 5 (port 5174), Hono + SQLite/Drizzle (port 5002), JWT auth, TanStack Query v5, Zustand 5, React Hook Form + Zod, Tailwind CSS 4, React Router v7, nuqs v2, WebSockets (ws)

---

## Task 1: Create `packages/reddit-clone-types`

**Files:**

- Create: `packages/reddit-clone-types/package.json`
- Create: `packages/reddit-clone-types/tsconfig.json`
- Create: `packages/reddit-clone-types/src/index.ts`

**Step 1: Create package.json**

```json
{
  "name": "@colloquium/reddit-clone-types",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "default": "./src/index.ts"
    }
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "build": "tsc --noEmit"
  },
  "devDependencies": {
    "@colloquium/tsconfig": "workspace:*",
    "typescript": "^5.5.0"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "extends": "@colloquium/tsconfig/base.json",
  "compilerOptions": {
    "outDir": "./dist"
  },
  "include": ["src"]
}
```

**Step 3: Create src/index.ts**

```typescript
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
```

**Step 4: Install dependencies from repo root**

```bash
pnpm install
```

Expected: No errors. `packages/reddit-clone-types` is now a workspace member.

**Step 5: Typecheck**

```bash
pnpm turbo typecheck --filter=@colloquium/reddit-clone-types
```

Expected: No TypeScript errors.

**Step 6: Commit**

```bash
git add packages/reddit-clone-types
git commit -m "feat(reddit-clone-types): bootstrap shared types package"
```

---

## Task 2: Scaffold `apps/reddit-clone-api`

**Files:**

- Create: `apps/reddit-clone-api/package.json`
- Create: `apps/reddit-clone-api/tsconfig.json`
- Create: `apps/reddit-clone-api/.env`
- Create: `apps/reddit-clone-api/.env.example`
- Create: `apps/reddit-clone-api/src/index.ts`
- Create: `apps/reddit-clone-api/src/app.ts`
- Create: `apps/reddit-clone-api/src/db/index.ts`
- Create: `apps/reddit-clone-api/src/db/schema.ts`

**Step 1: Create package.json**

```json
{
  "name": "@colloquium/reddit-clone-api",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc --noEmit && tsup src/index.ts --format esm --out-dir dist",
    "start": "node dist/index.js",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "test": "vitest run"
  },
  "dependencies": {
    "@colloquium/reddit-clone-types": "workspace:*",
    "@hono/node-server": "^1.13.0",
    "bcryptjs": "^2.4.3",
    "better-sqlite3": "^11.5.0",
    "dotenv": "^16.4.0",
    "drizzle-orm": "^0.36.0",
    "hono": "^4.6.0",
    "jsonwebtoken": "^9.0.2",
    "ws": "^8.18.0"
  },
  "devDependencies": {
    "@colloquium/config": "workspace:*",
    "@colloquium/tsconfig": "workspace:*",
    "@types/bcryptjs": "^2.4.6",
    "@types/better-sqlite3": "^7.6.0",
    "@types/jsonwebtoken": "^9.0.7",
    "@types/node": "^22.0.0",
    "@types/ws": "^8.5.0",
    "@vitest/coverage-v8": "^3.2.4",
    "drizzle-kit": "^0.27.0",
    "tsup": "^8.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.5.0",
    "vitest": "^3.2.4"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "extends": "@colloquium/tsconfig/base.json",
  "compilerOptions": {
    "outDir": "./dist"
  },
  "include": ["src"]
}
```

**Step 3: Create .env**

```
JWT_SECRET=reddit-clone-dev-jwt-secret-change-in-production
JWT_REFRESH_SECRET=reddit-clone-dev-refresh-secret-change-in-production
DATABASE_PATH=./db/reddit.db
PORT=5002
FRONTEND_URL=http://localhost:5174
```

**Step 4: Create .env.example**

```
JWT_SECRET=
JWT_REFRESH_SECRET=
DATABASE_PATH=./db/reddit.db
PORT=5002
FRONTEND_URL=http://localhost:5174
```

**Step 5: Create src/db/schema.ts** (minimal — just users + refresh_tokens for now; more tables added test-by-test)

```typescript
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  karmaPost: integer("karma_post").notNull().default(0),
  karmaComment: integer("karma_comment").notNull().default(0),
  cakeDay: integer("cake_day").notNull(),
  avatarUrl: text("avatar_url"),
  bio: text("bio"),
  isPremium: integer("is_premium", { mode: "boolean" }).notNull().default(false),
  coinBalance: integer("coin_balance").notNull().default(0),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at"),
});

export const refreshTokens = sqliteTable("refresh_tokens", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  tokenHash: text("token_hash").notNull(),
  expiresAt: integer("expires_at").notNull(),
  createdAt: integer("created_at").notNull(),
});
```

**Step 6: Create src/db/index.ts**

Use `sqlite.prepare(...).run()` for each DDL statement (same pattern as `colloquium-chat-api`):

```typescript
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";

export type AppDb = ReturnType<typeof createDb>;

export function createDb(dbPath: string) {
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  sqlite
    .prepare(
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        karma_post INTEGER NOT NULL DEFAULT 0,
        karma_comment INTEGER NOT NULL DEFAULT 0,
        cake_day INTEGER NOT NULL,
        avatar_url TEXT,
        bio TEXT,
        is_premium INTEGER NOT NULL DEFAULT 0,
        coin_balance INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER
      )`
    )
    .run();

  sqlite
    .prepare(
      `CREATE TABLE IF NOT EXISTS refresh_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id),
        token_hash TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      )`
    )
    .run();

  return drizzle(sqlite, { schema });
}

let _db: ReturnType<typeof createDb> | null = null;

export function getDb(dbPath?: string): ReturnType<typeof createDb> {
  if (!_db) {
    _db = createDb(dbPath ?? process.env.DATABASE_PATH ?? "./db/reddit.db");
  }
  return _db;
}
```

**Step 7: Create src/app.ts**

```typescript
import "dotenv/config";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import type { AppDb } from "./db/index.js";

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
```

**Step 8: Create src/index.ts**

```typescript
import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { createDb } from "./db/index.js";
import fs from "node:fs";
import path from "node:path";

const dbPath = process.env.DATABASE_PATH ?? "./db/reddit.db";
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = createDb(dbPath);
const app = createApp(db);
const PORT = Number(process.env.PORT ?? 5002);

serve(
  {
    fetch: app.fetch,
    port: PORT,
  },
  (info) => {
    console.log(`reddit-clone-api running on http://localhost:${info.port}`);
  }
);
```

**Step 9: Install and typecheck**

```bash
pnpm install && pnpm turbo typecheck --filter=@colloquium/reddit-clone-api
```

Expected: No TypeScript errors.

**Step 10: Commit**

```bash
git add apps/reddit-clone-api
git commit -m "feat(reddit-clone-api): bootstrap Hono API scaffold on port 5002"
```

---

## Task 3: Scaffold `apps/reddit-clone` (frontend)

**Files:**

- Create: `apps/reddit-clone/package.json`
- Create: `apps/reddit-clone/tsconfig.json`
- Create: `apps/reddit-clone/vite.config.ts`
- Create: `apps/reddit-clone/index.html`
- Create: `apps/reddit-clone/.env`
- Create: `apps/reddit-clone/.env.example`
- Create: `apps/reddit-clone/src/main.tsx`
- Create: `apps/reddit-clone/src/App.tsx`
- Create: `apps/reddit-clone/src/index.css`
- Create: `apps/reddit-clone/src/vite-env.d.ts`

**Step 1: Create package.json**

```json
{
  "name": "@colloquium/reddit-clone",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite --port 5174",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "test": "vitest run"
  },
  "dependencies": {
    "@colloquium/reddit-clone-types": "workspace:*",
    "@hookform/resolvers": "^5.2.2",
    "@tanstack/react-query": "^5.90.21",
    "@tanstack/react-table": "^8.21.3",
    "nuqs": "^2.8.8",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-hook-form": "^7.71.2",
    "react-router-dom": "^7.0.0",
    "zod": "^3.23.0",
    "zustand": "^5.0.0"
  },
  "devDependencies": {
    "@colloquium/config": "workspace:*",
    "@colloquium/tsconfig": "workspace:*",
    "@tailwindcss/vite": "^4.0.0",
    "@testing-library/jest-dom": "^6.0.0",
    "@testing-library/react": "^14.0.0",
    "@testing-library/user-event": "^14.6.1",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "@vitest/coverage-v8": "^3.2.4",
    "jsdom": "^24.0.0",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.5.0",
    "vite": "^6.0.0",
    "vitest": "^4.0.18"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "extends": "@colloquium/tsconfig/react.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"]
}
```

**Step 3: Create vite.config.ts**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5174,
    strictPort: true,
  },
});
```

**Step 4: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Reddit</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**Step 5: Create .env**

```
VITE_API_BASE_URL=http://localhost:5002
VITE_WS_URL=ws://localhost:5002
```

**Step 6: Create .env.example**

```
VITE_API_BASE_URL=http://localhost:5002
VITE_WS_URL=ws://localhost:5002
```

**Step 7: Create src/vite-env.d.ts**

```typescript
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_WS_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

**Step 8: Create src/index.css** (Reddit color palette — light default, dark via .dark class)

```css
@import "tailwindcss";

:root {
  --color-bg: #dae0e6;
  --color-surface: #ffffff;
  --color-surface-2: #f6f7f8;
  --color-border: #edeff1;
  --color-text: #1c1c1c;
  --color-text-muted: #878a8c;
  --color-accent: #ff4500;
  --color-accent-hover: #e03d00;
  --color-upvote: #ff4500;
  --color-downvote: #7193ff;
  --color-danger: #ea0027;
  --color-mod: #46d160;
  --color-gold: #ffd635;
}

.dark {
  --color-bg: #1a1a1b;
  --color-surface: #272729;
  --color-surface-2: #1a1a1b;
  --color-border: #343536;
  --color-text: #d7dadc;
  --color-text-muted: #818384;
  --color-accent: #ff4500;
  --color-accent-hover: #e03d00;
  --color-upvote: #ff4500;
  --color-downvote: #7193ff;
  --color-danger: #ea0027;
  --color-mod: #46d160;
  --color-gold: #ffd635;
}

* {
  box-sizing: border-box;
}

html,
body,
#root {
  height: 100%;
  margin: 0;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, sans-serif;
  background-color: var(--color-bg);
  color: var(--color-text);
}
```

**Step 9: Create src/App.tsx**

```tsx
import { Routes, Route, Navigate } from "react-router-dom";

function App() {
  return (
    <Routes>
      <Route path="/" element={<div>Reddit Clone — coming soon</div>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
```

**Step 10: Create src/main.tsx**

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 1000 * 30 },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
```

**Step 11: Install and typecheck**

```bash
pnpm install && pnpm turbo typecheck --filter=@colloquium/reddit-clone
```

Expected: No TypeScript errors.

**Step 12: Commit**

```bash
git add apps/reddit-clone
git commit -m "feat(reddit-clone): bootstrap React + Vite frontend scaffold on port 5174"
```

---

## Task 4: Initialize project state for `colloquium:project`

**Files:**

- Create: `.claude/projects/reddit-clone/project-state.json`
- Create: `.claude/projects/reddit-clone/claude-progress.txt`
- Create: `.claude/projects/reddit-clone/app_spec.txt`
- Create: `.claude/projects/reddit-clone/feature_list.json`

**Step 1: Create the directory**

```bash
mkdir -p .claude/projects/reddit-clone
```

**Step 2: Create project-state.json**

```json
{
  "version": 1,
  "slug": "reddit-clone",
  "name": "Reddit Clone",
  "appDir": "apps/reddit-clone",
  "apiDir": "apps/reddit-clone-api",
  "packages": ["packages/reddit-clone-types"],
  "specFile": ".claude/projects/reddit-clone/app_spec.txt",
  "featureListFile": ".claude/projects/reddit-clone/feature_list.json",
  "progressFile": ".claude/projects/reddit-clone/claude-progress.txt",
  "totalTests": 265,
  "passingTests": 0,
  "currentTestIndex": 0,
  "phase": "develop",
  "lastUpdated": "2026-02-24T00:00:00.000Z",
  "sessionCount": 0
}
```

**Step 3: Create claude-progress.txt**

```
# Reddit Clone — Development Progress Log

## 2026-02-24 — Session 0 (Bootstrap)
- Project scaffolded: apps/reddit-clone (port 5174), apps/reddit-clone-api (port 5002), packages/reddit-clone-types
- Design document: docs/plans/2026-02-24-reddit-clone-design.md
- 265 behavioral test cases defined
- project-state.json initialized
- Ready to begin feature development at test #1
```

**Step 4: Create app_spec.txt**

```xml
<project_specification>
  <project_name>Reddit Clone</project_name>

  <overview>
    Reddit Clone is a one-to-one clone of modern Reddit (new.reddit.com).
    It supports communities (subreddits), text/link/image/video/poll/gallery posts,
    nested comments, up/downvoting, moderation tools, Reddit Chat (DMs via WebSocket),
    awards, Reddit Premium, Reddit Talk (audio rooms), custom feeds (multireddits),
    and a full notification system. Visual design faithfully follows Reddit: orange
    (#FF4500) accent, card-based layout, vote arrows on the left of each row,
    light/dark mode.
  </overview>

  <technology_stack>
    <frontend>
      <framework>React 18 + Vite 5</framework>
      <styling>Tailwind CSS 4 (dark-mode via .dark class strategy)</styling>
      <state_management>Zustand 5 (feature-sliced stores)</state_management>
      <server_state>TanStack Query v5</server_state>
      <forms>React Hook Form v7 + Zod resolvers</forms>
      <tables>TanStack Table v8</tables>
      <url_state>nuqs v2</url_state>
      <routing>React Router v7</routing>
      <port>5174 only</port>
    </frontend>
    <backend>
      <runtime>Hono (Node adapter, TypeScript)</runtime>
      <database>SQLite (via better-sqlite3 / Drizzle ORM)</database>
      <port>5002</port>
    </backend>
    <auth>JWT access token (15 min) + refresh token (7 days), httpOnly cookies via Hono</auth>
    <realtime>WebSockets (ws library) — Reddit Chat (DMs) only</realtime>
  </technology_stack>

  <prerequisites>
    <environment_setup>
      - Node.js >= 20 and pnpm >= 9
      - apps/reddit-clone-api/.env: JWT_SECRET, JWT_REFRESH_SECRET, DATABASE_PATH=./db/reddit.db, PORT=5002, FRONTEND_URL=http://localhost:5174
      - apps/reddit-clone/.env: VITE_API_BASE_URL=http://localhost:5002, VITE_WS_URL=ws://localhost:5002
      - Run pnpm install from repo root before first start
    </environment_setup>
  </prerequisites>
</project_specification>
```

**Step 5: Create feature_list.json**

Generate all 265 entries from the behavioral scenarios in `docs/plans/2026-02-24-reddit-clone-design.md`. Each entry follows this structure:

```json
{
  "category": "functional",
  "description": "<full behavioral scenario text from the design doc>",
  "steps": ["Step 1: <verification step>", "Step 2: <verification step>"],
  "passes": false
}
```

The first two entries look like this — use the same pattern for all 265:

```json
[
  {
    "category": "functional",
    "description": "Server health check: GET /api/health returns 200 OK with { status: 'ok', service: 'reddit-clone-api' }",
    "steps": [
      "Step 1: Start the API with `pnpm turbo dev --filter=@colloquium/reddit-clone-api`",
      "Step 2: Send GET http://localhost:5002/api/health",
      "Step 3: Verify response status is 200",
      "Step 4: Verify response body equals { \"status\": \"ok\", \"service\": \"reddit-clone-api\" }"
    ],
    "passes": false
  },
  {
    "category": "functional",
    "description": "Registration: Given a visitor fills in username, email, and password — When they submit the register form — Then an account is created and they are redirected to the home feed as a logged-in user",
    "steps": [
      "Step 1: POST /api/auth/register with { username, email, password }",
      "Step 2: Verify response is 201 with user object (id, username, email)",
      "Step 3: Verify JWT access token and refresh token cookies are set in the response",
      "Step 4: Frontend: /register renders a form; submitting navigates to / for authenticated users"
    ],
    "passes": false
  }
]
```

> Continue this pattern for all 265 entries, using the scenarios from the design doc's test suite section as the `description` fields.

**Step 6: Commit project state**

```bash
git add .claude/projects/reddit-clone
git commit -m "feat(reddit-clone): initialize colloquium:project state with 265 behavioral tests"
```

---

## Task 5: Implement Test #1 — Server Health Check (TDD)

**Files:**

- Create: `apps/reddit-clone-api/src/__tests__/health.test.ts`

**Step 1: Write the test**

```typescript
import { describe, it, expect } from "vitest";
import { createApp } from "../app.js";
import { createDb } from "../db/index.js";

const db = createDb(":memory:");
const app = createApp(db);

describe("GET /api/health", () => {
  it("returns 200 OK with status and service name", async () => {
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: "ok", service: "reddit-clone-api" });
  });
});
```

**Step 2: Run the test**

```bash
pnpm turbo test --filter=@colloquium/reddit-clone-api
```

Expected: PASS — the health endpoint is already in `src/app.ts`.

**Step 3: Update project-state.json**

- Set `"passingTests": 1`
- Set `"currentTestIndex": 1`
- Update `"lastUpdated"` to current ISO timestamp

Also set `"passes": true` on index 0 in `feature_list.json`.

**Step 4: Commit**

```bash
git add apps/reddit-clone-api/src/__tests__/health.test.ts
git add .claude/projects/reddit-clone/project-state.json
git add .claude/projects/reddit-clone/feature_list.json
git commit -m "feat(reddit-clone-api): health check endpoint — test #1 passing"
```

---

## Task 6: Verify full monorepo build

**Step 1: Typecheck all three new packages**

```bash
pnpm turbo typecheck --filter=@colloquium/reddit-clone-types --filter=@colloquium/reddit-clone --filter=@colloquium/reddit-clone-api
```

Expected: All pass with no errors.

**Step 2: Run all tests**

```bash
pnpm turbo test --filter=@colloquium/reddit-clone-api
```

Expected: health.test.ts PASS.

**Step 3: Start dev servers and manually verify**

```bash
pnpm turbo dev --filter=@colloquium/reddit-clone --filter=@colloquium/reddit-clone-api
```

Expected:

- `http://localhost:5174` — shows "Reddit Clone — coming soon"
- `http://localhost:5002/api/health` — returns `{ "status": "ok", "service": "reddit-clone-api" }`

**Step 4: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "chore(reddit-clone): verify full monorepo build — scaffold complete"
```

---

## Handoff to `colloquium:project`

With the scaffold complete and test #1 passing, all further feature development is driven by:

```
/colloquium:project
```

Select "Continue existing project" → "reddit-clone". The skill will:

1. Read `project-state.json` to find `currentTestIndex: 1`
2. Load the next test from `feature_list.json` (Test #2 — Registration)
3. Implement it TDD-style
4. Update `project-state.json` and `feature_list.json`
5. Repeat session-by-session until all 265 tests pass

---

## Reference: Key File Paths

| Path                                                | Purpose                                            |
| --------------------------------------------------- | -------------------------------------------------- |
| `docs/plans/2026-02-24-reddit-clone-design.md`      | Full design document and 265 behavioral test suite |
| `.claude/projects/reddit-clone/project-state.json`  | Progress tracker (currentTestIndex, passingTests)  |
| `.claude/projects/reddit-clone/feature_list.json`   | 265 behavioral test entries                        |
| `.claude/projects/reddit-clone/app_spec.txt`        | XML specification for the app                      |
| `.claude/projects/reddit-clone/claude-progress.txt` | Session-by-session log                             |
| `apps/reddit-clone/`                                | React + Vite frontend (port 5174)                  |
| `apps/reddit-clone-api/`                            | Hono + SQLite API (port 5002)                      |
| `packages/reddit-clone-types/`                      | Shared Zod schemas + TS types                      |
| `apps/reddit-clone-api/.env`                        | Backend env vars (JWT secrets, DB path, port)      |
| `apps/reddit-clone/.env`                            | Frontend env vars (API URL, WS URL)                |
