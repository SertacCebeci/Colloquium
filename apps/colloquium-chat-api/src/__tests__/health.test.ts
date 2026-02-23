import { describe, it, expect } from "vitest";
import { createApp } from "../app.js";
import { createDb } from "../db/index.js";

describe("GET /api/health", () => {
  it("responds with 200 OK and status: ok", async () => {
    const app = createApp(createDb(":memory:"));
    const res = await app.request("/api/health");

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ status: "ok" });
  });
});
