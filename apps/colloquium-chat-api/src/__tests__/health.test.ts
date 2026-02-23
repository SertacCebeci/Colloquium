import { describe, it, expect } from "vitest";
import app from "../app.js";

describe("GET /api/health", () => {
  it("responds with 200 OK and status: ok", async () => {
    const res = await app.request("/api/health");

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ status: "ok" });
  });
});
