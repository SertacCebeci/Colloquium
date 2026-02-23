import { describe, it, expect } from "vitest";
import { HealthResponseSchema } from "./health";

describe("HealthResponseSchema", () => {
  it("validates a correct health response", () => {
    const valid = { status: "ok", timestamp: new Date().toISOString() };
    const result = HealthResponseSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("rejects missing timestamp", () => {
    const invalid = { status: "ok" };
    const result = HealthResponseSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects invalid status", () => {
    const invalid = { status: "broken", timestamp: new Date().toISOString() };
    const result = HealthResponseSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});
