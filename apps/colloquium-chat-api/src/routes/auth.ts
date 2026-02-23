import { Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
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

  router.get("/me", async (c) => {
    const accessToken = getCookie(c, "access_token");

    // Fast path: valid access token
    if (accessToken) {
      try {
        const payload = jwt.verify(accessToken, JWT_SECRET) as { sub?: string | number };
        const userId = Number(payload.sub);
        const user = db.select().from(users).where(eq(users.id, userId)).get();
        if (user) {
          return c.json({
            user: {
              id: user.id,
              email: user.email,
              username: user.username,
              displayName: user.displayName,
            },
          });
        }
      } catch {
        // fall through to refresh token path
      }
    }

    // Fallback: try refresh token transparently
    const refreshToken = getCookie(c, "refresh_token");
    if (!refreshToken) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    let refreshPayload: { sub?: string | number; type?: string };
    try {
      refreshPayload = jwt.verify(refreshToken, JWT_SECRET) as {
        sub?: string | number;
        type?: string;
      };
    } catch {
      return c.json({ error: "Unauthorized" }, 401);
    }

    if (refreshPayload.type !== "refresh") {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const userId = Number(refreshPayload.sub);
    const now = Date.now();

    // Verify the refresh token exists in the DB (not revoked) and is not expired
    const stored = db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.userId, userId))
      .all()
      .filter((r) => r.expiresAt > now);

    let tokenValid = false;
    for (const row of stored) {
      if (await bcrypt.compare(refreshToken, row.tokenHash)) {
        tokenValid = true;
        break;
      }
    }

    if (!tokenValid) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const user = db.select().from(users).where(eq(users.id, userId)).get();
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    // Issue new access token
    const newAccessToken = jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: ACCESS_TOKEN_TTL_S,
    });

    setCookie(c, "access_token", newAccessToken, {
      httpOnly: true,
      sameSite: "Lax" as const,
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: ACCESS_TOKEN_TTL_S,
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
