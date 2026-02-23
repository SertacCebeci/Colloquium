import { describe, it, expect } from "vitest";
import { AvatarDirectionSchema, AvatarPositionSchema, PeerSchema, RoomSchema } from "./office";

describe("AvatarDirectionSchema", () => {
  it("accepts valid directions", () => {
    expect(AvatarDirectionSchema.parse("up")).toBe("up");
    expect(AvatarDirectionSchema.parse("down")).toBe("down");
    expect(AvatarDirectionSchema.parse("left")).toBe("left");
    expect(AvatarDirectionSchema.parse("right")).toBe("right");
  });
  it("rejects invalid direction", () => {
    expect(() => AvatarDirectionSchema.parse("diagonal")).toThrow();
  });
});

describe("AvatarPositionSchema", () => {
  const valid = {
    userId: "00000000-0000-0000-0000-000000000001",
    displayName: "Alice",
    color: "#2D6A4F",
    x: 100.5,
    y: 200.75,
    direction: "right" as const,
  };
  it("accepts valid position", () => {
    expect(AvatarPositionSchema.parse(valid)).toEqual(valid);
  });
  it("rejects non-uuid userId", () => {
    expect(() => AvatarPositionSchema.parse({ ...valid, userId: "not-uuid" })).toThrow();
  });
  it("allows fractional x/y for lerp", () => {
    expect(AvatarPositionSchema.parse({ ...valid, x: 10.5, y: 20.75 }).x).toBe(10.5);
  });
});

describe("RoomSchema", () => {
  const valid = {
    id: "00000000-0000-0000-0000-000000000002",
    name: "Engineering",
    x: 60,
    y: 60,
    width: 480,
    height: 280,
  };
  it("accepts valid room", () => {
    expect(RoomSchema.parse(valid)).toEqual(valid);
  });
  it("rejects zero-width room", () => {
    expect(() => RoomSchema.parse({ ...valid, width: 0 })).toThrow();
  });
  it("rejects negative height", () => {
    expect(() => RoomSchema.parse({ ...valid, height: -1 })).toThrow();
  });
});

describe("PeerSchema", () => {
  it("is structurally identical to AvatarPositionSchema", () => {
    const peer = {
      userId: "00000000-0000-0000-0000-000000000003",
      displayName: "Bob",
      color: "#1A5276",
      x: 50,
      y: 75,
      direction: "up" as const,
    };
    expect(PeerSchema.parse(peer)).toEqual(peer);
  });
});
