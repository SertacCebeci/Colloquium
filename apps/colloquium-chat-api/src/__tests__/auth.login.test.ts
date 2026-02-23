import { describe, it, expect, beforeEach } from "vitest";
import { createDb } from "../db/index.js";
import { createApp } from "../app.js";

async function seedUser(app: ReturnType<typeof createApp>) {
  await app.request("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "login@example.com",
      username: "loginuser",
      password: "Pass123!",
    }),
  });
}

describe("POST /api/auth/login", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    const db = createDb(":memory:");
    app = createApp(db);
    await seedUser(app);
  });

  it("returns 200 and sets httpOnly access_token and refresh_token cookies on valid credentials", async () => {
    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "login@example.com",
        password: "Pass123!",
      }),
    });

    expect(res.status).toBe(200);

    const setCookieHeaders = res.headers.getSetCookie?.() ?? [];
    const allCookies = setCookieHeaders.join("; ");

    expect(allCookies).toMatch(/access_token=/);
    expect(allCookies).toMatch(/refresh_token=/);
    expect(allCookies).toMatch(/HttpOnly/i);
  });

  it("returns 200 with user data in the response body", async () => {
    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "login@example.com",
        password: "Pass123!",
      }),
    });

    const body = await res.json();
    expect(body.user.email).toBe("login@example.com");
    expect(body.user).not.toHaveProperty("passwordHash");
  });

  it("returns 401 when password is wrong", async () => {
    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "login@example.com",
        password: "WrongPass!",
      }),
    });

    expect(res.status).toBe(401);
  });

  it("returns 401 when email is not registered", async () => {
    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "ghost@example.com",
        password: "Pass123!",
      }),
    });

    expect(res.status).toBe(401);
  });

  it("returns 400 when required fields are missing", async () => {
    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "login@example.com" }),
    });

    expect(res.status).toBe(400);
  });
});
