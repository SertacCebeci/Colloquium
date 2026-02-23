import { describe, it, expect, beforeEach } from "vitest";
import bcrypt from "bcryptjs";
import { createDb } from "../db/index.js";
import { users } from "../db/schema.js";
import { createApp } from "../app.js";

describe("POST /api/auth/register", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    // Use in-memory SQLite for each test — isolated, no file side effects
    const db = createDb(":memory:");
    app = createApp(db);
  });

  it("creates a new user and returns 201 with user data", async () => {
    const res = await app.request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "testuser@example.com",
        username: "testuser",
        password: "SecurePass123!",
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.user.email).toBe("testuser@example.com");
    expect(body.user.username).toBe("testuser");
    expect(body.user).not.toHaveProperty("passwordHash");
  });

  it("stores a bcrypt-hashed password, not the plain text", async () => {
    const db = createDb(":memory:");
    const testApp = createApp(db);

    await testApp.request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "hash@example.com",
        username: "hashuser",
        password: "PlainPass!99",
      }),
    });

    const [row] = db.select().from(users).all();
    expect(row.passwordHash).not.toBe("PlainPass!99");
    expect(await bcrypt.compare("PlainPass!99", row.passwordHash)).toBe(true);
  });

  it("returns 409 when email is already taken", async () => {
    const payload = {
      email: "dup@example.com",
      username: "dupuser",
      password: "Pass123!",
    };
    await app.request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const res = await app.request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, username: "dupuser2" }),
    });

    expect(res.status).toBe(409);
  });

  it("returns 400 when required fields are missing", async () => {
    const res = await app.request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "incomplete@example.com" }),
    });

    expect(res.status).toBe(400);
  });
});
