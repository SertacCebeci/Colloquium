import { Hono } from "hono";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import type { AppDb } from "../db/index.js";
import { users } from "../db/schema.js";

export function authRoutes(db: AppDb) {
  const router = new Hono();

  router.post("/register", async (c) => {
    const body = await c.req.json().catch(() => null);

    if (!body?.email || !body?.username || !body?.password) {
      return c.json({ error: "email, username, and password are required" }, 400);
    }

    const { email, username, password } = body as {
      email: string;
      username: string;
      password: string;
    };

    // Check for duplicate email
    const existing = db.select().from(users).where(eq(users.email, email)).get();
    if (existing) {
      return c.json({ error: "Email already in use" }, 409);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const now = Date.now();

    const [user] = db
      .insert(users)
      .values({ email, username, passwordHash, createdAt: now })
      .returning({
        id: users.id,
        email: users.email,
        username: users.username,
        displayName: users.displayName,
        createdAt: users.createdAt,
      })
      .all();

    return c.json({ user }, 201);
  });

  return router;
}
