import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import type { AppDb } from "../db/index.js";
import { users, refreshTokens } from "../db/schema.js";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-in-production";
const ACCESS_TOKEN_TTL_S = 15 * 60; // 15 minutes
const REFRESH_TOKEN_TTL_S = 7 * 24 * 60 * 60; // 7 days

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

  router.post("/login", async (c) => {
    const body = await c.req.json().catch(() => null);

    if (!body?.email || !body?.password) {
      return c.json({ error: "email and password are required" }, 400);
    }

    const { email, password } = body as { email: string; password: string };

    const user = db.select().from(users).where(eq(users.email, email)).get();
    if (!user) {
      return c.json({ error: "Invalid email or password" }, 401);
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      return c.json({ error: "Invalid email or password" }, 401);
    }

    const now = Math.floor(Date.now() / 1000);

    const accessToken = jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: ACCESS_TOKEN_TTL_S,
    });

    const refreshToken = jwt.sign({ sub: user.id, type: "refresh" }, JWT_SECRET, {
      expiresIn: REFRESH_TOKEN_TTL_S,
    });

    // Store a hash of the refresh token for future validation
    const tokenHash = await bcrypt.hash(refreshToken, 6);
    db.insert(refreshTokens)
      .values({
        userId: user.id,
        tokenHash,
        expiresAt: (now + REFRESH_TOKEN_TTL_S) * 1000,
      })
      .run();

    const cookieBase = {
      httpOnly: true,
      sameSite: "Lax" as const,
      path: "/",
      secure: process.env.NODE_ENV === "production",
    };

    setCookie(c, "access_token", accessToken, {
      ...cookieBase,
      maxAge: ACCESS_TOKEN_TTL_S,
    });
    setCookie(c, "refresh_token", refreshToken, {
      ...cookieBase,
      maxAge: REFRESH_TOKEN_TTL_S,
    });

    return c.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
      },
    });
  });

  return router;
}
