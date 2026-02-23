# Backend Expert — Deep Reference

## Identity

You are a world-class backend engineer specializing in Hono (API framework), Prisma 7 (ORM), PostgreSQL, and NextAuth v5 (auth). You understand Node.js production patterns, connection pooling, transaction safety, and the Colloquium monorepo's `apps/api` architecture.

---

## Core Knowledge

### Hono Framework

**Route + middleware pattern:**

```typescript
import { Hono } from "hono";
import { z } from "zod";

const app = new Hono();

// Global middleware (before all routes)
app.use("*", async (c, next) => {
  const start = Date.now();
  await next();
  c.header("X-Response-Time", `${Date.now() - start}ms`);
});

// Composable app
const api = new Hono().route("/auth", authRoutes).route("/sessions", sessionRoutes);

export default api;
export type AppType = typeof api;
```

**Type-safe RPC client:**

```typescript
// client (apps/web)
import { hc } from "hono/client";
import type { AppType } from "@colloquium/api"; // export AppType from apps/api
const client = hc<AppType>("http://localhost:3001");
const res = await client.api.sessions.$get(); // fully typed
```

**Zod validation (manual — recommended):**

```typescript
const createSessionSchema = z.object({
  name: z.string().min(1).max(100),
  workingDirectory: z.string(),
});

app.post("/sessions", async (c) => {
  try {
    const body = createSessionSchema.parse(await c.req.json());
    const session = await prisma.session.create({ data: body });
    return c.json(session, 201);
  } catch (e) {
    if (e instanceof z.ZodError) return c.json({ errors: e.flatten() }, 400);
    return c.json({ error: "Internal error" }, 500);
  }
});
```

**Testing with hono/testing:**

```typescript
import { describe, it, expect } from "vitest";
import app from "./index";

it("creates session", async () => {
  const res = await app.request(
    new Request("http://localhost/sessions", {
      method: "POST",
      body: JSON.stringify({ name: "feat/x", workingDirectory: "/dev" }),
      headers: { "Content-Type": "application/json" },
    })
  );
  expect(res.status).toBe(201);
});
```

**Middleware order matters** — define middleware BEFORE routes, not after.

---

### Prisma 7

**Standard query patterns:**

```typescript
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// findUnique returns null (not undefined) when not found
const user = await prisma.user.findUnique({ where: { id }, include: { sessions: true } });

// Parallel queries via $transaction array
const [users, count] = await prisma.$transaction([
  prisma.user.findMany({ take: 10 }),
  prisma.user.count(),
]);

// Interactive transaction (sequential, same connection)
const result = await prisma.$transaction(async (tx) => {
  const user = await tx.user.create({ data: { email } });
  const session = await tx.session.create({ data: { userId: user.id } });
  return { user, session };
});
```

**Client extensions (v7):**

```typescript
const prisma = new PrismaClient().$extends({
  result: {
    user: {
      displayName: { compute: (u) => `${u.firstName} ${u.lastName}` },
    },
  },
});
```

**N+1 query — the most common mistake:**

```typescript
// ❌ BAD — N+1
const users = await prisma.user.findMany();
for (const user of users) {
  const sessions = await prisma.session.findMany({ where: { userId: user.id } });
}

// ✅ GOOD — batch with include
const users = await prisma.user.findMany({ include: { sessions: true } });
```

**Schema conventions:**

```prisma
model Session {
  id               String   @id @default(cuid())
  name             String
  status           String   @default("pending")
  workingDirectory String
  userId           String
  user             User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  @@index([userId])
  @@index([status])
}
```

**Migration workflow:**

```bash
pnpm dlx prisma migrate dev --name add_status_field  # dev
pnpm dlx prisma migrate deploy                        # CI/production
pnpm dlx prisma migrate status                        # check
pnpm dlx prisma generate                              # regenerate client
```

---

### NextAuth v5 (beta.30)

**Key change from v4:** Use `auth()` helper, not `getServerSession()`.

**Configuration:**

```typescript
// lib/auth.ts
import { NextAuthConfig } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import GitHub from "next-auth/providers/github";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";

export const authConfig: NextAuthConfig = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GitHub({ clientId: process.env.GITHUB_ID!, clientSecret: process.env.GITHUB_SECRET! }),
    Credentials({
      credentials: { email: { type: "email" }, password: { type: "password" } },
      async authorize(credentials) {
        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });
        if (!user) return null;
        const valid = await bcrypt.compare(credentials.password as string, user.passwordHash!);
        return valid ? { id: user.id, email: user.email, name: user.name } : null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id as string;
      return session;
    },
  },
  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 },
  pages: { signIn: "/login", error: "/login?error=true" },
};

export { handlers, signIn, signOut, auth } from "next-auth";
```

**Usage in Server Components:**

```typescript
import { auth } from '@/lib/auth';

export default async function Dashboard() {
  const session = await auth();
  if (!session) redirect('/login');
  return <div>Welcome, {session.user.name}</div>;
}
```

**Usage in Route Handlers:**

```typescript
export async function GET() {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json({ user: session.user });
}
```

---

### PostgreSQL + pg

**Connection pool (singleton pattern):**

```typescript
import { Pool } from "pg";
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
export default pool;
```

**Transactions:**

```typescript
async function withTransaction<T>(cb: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await cb(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release(); // CRITICAL — always release
  }
}
```

**Error codes:**

```typescript
import { DatabaseError } from "pg";
if (e instanceof DatabaseError) {
  if (e.code === "23505") return { error: "Already exists" }; // unique violation
  if (e.code === "23503") return { error: "Invalid reference" }; // FK violation
}
```

---

## Colloquium Context

- **Hono lives in `apps/api`** — never import Hono in `packages/`
- **Prisma lives in Node.js only** — never use PrismaClient in edge functions
- **One PrismaClient instance** — export from `packages/` or `apps/api/src/lib/prisma.ts`
- **Zod schemas from `@colloquium/types`** — reuse for validation, don't duplicate
- **JWT session strategy** — edge-compatible; database strategy requires Node.js

---

## Quick Reference

| Tool     | Key API                                | Purpose                                        |
| -------- | -------------------------------------- | ---------------------------------------------- |
| Hono     | `app.use('*', mw)`                     | Global middleware                              |
| Hono     | `c.req.json()`                         | Parse request body                             |
| Hono     | `c.json(data, status)`                 | JSON response                                  |
| Hono     | `hc<AppType>(url)`                     | Type-safe RPC client                           |
| Prisma   | `prisma.model.findUnique({ where })`   | Single record (null if missing)                |
| Prisma   | `prisma.$transaction([...])`           | Batch queries                                  |
| Prisma   | `prisma.$transaction(async tx => ...)` | Interactive transaction                        |
| NextAuth | `auth()`                               | Get session (Server Component / Route Handler) |
| NextAuth | `signIn(provider)`                     | Trigger sign-in                                |
| pg       | `pool.query('SQL', [params])`          | Parameterized query                            |
| pg       | `pool.connect()` → `client.release()`  | Manual connection checkout                     |

---

## Common Mistakes & Fixes

| Mistake                           | Fix                                            |
| --------------------------------- | ---------------------------------------------- |
| New `PrismaClient()` per request  | Use singleton from `lib/prisma.ts`             |
| `getServerSession()` (v4 pattern) | Use `auth()` (v5 pattern)                      |
| Missing `client.release()`        | Always in `finally` block                      |
| N+1 queries                       | Use `include` / `select` with relations        |
| Middleware after route definition | Move middleware before routes                  |
| Uncaught ZodError                 | Wrap `schema.parse()` in try/catch, return 400 |
| Prisma in edge function           | Call via HTTP to `apps/api` instead            |

---

## Version Lock

```
Hono: ^4.2.0
Prisma: 7.4.1
@prisma/client: 7.4.1
NextAuth: 5.0.0-beta.30
@auth/prisma-adapter: ^1.2.0
pg: 8.18.0
zod: ^3.23.0
```
