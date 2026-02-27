import { describe, test, expect } from "vitest";
import { Channel } from "./Channel";
import { ChannelRepository, InMemoryChannelEventStore } from "./ChannelRepository";

function makeRepo() {
  return new ChannelRepository(new InMemoryChannelEventStore());
}

describe("ChannelRepository — persistence round-trip", () => {
  test("returns null for a channel that has never been saved", () => {
    const repo = makeRepo();
    expect(repo.findById("ch-unknown")).toBeNull();
  });

  test("reconstructs Active state from a RegisterChannel event stream", () => {
    const repo = makeRepo();
    const ch = new Channel("ch-1");
    repo.save(ch, ch.registerChannel("ws-1"));

    const loaded = repo.findById("ch-1");
    expect(loaded).not.toBeNull();
    expect(loaded!.state).toBe("Active");
  });

  test("reconstructs member access rights from ChannelMembershipGranted events", () => {
    const repo = makeRepo();
    const ch = new Channel("ch-1");
    repo.save(ch, ch.registerChannel("ws-1"));
    repo.save(ch, ch.grantChannelMembership("user-1"));
    repo.save(ch, ch.grantChannelMembership("user-2"));

    const loaded = repo.findById("ch-1")!;

    // user-1 can post after hydration
    const [ev1] = loaded.postChannelMessage("user-1", "hello");
    expect(ev1).toMatchObject({ type: "ChannelMessagePosted", authorId: "user-1" });

    // user-3 was never granted — still denied after hydration
    const [ev3] = loaded.postChannelMessage("user-3", "hello");
    expect(ev3).toMatchObject({ type: "ChannelAccessDenied", authorId: "user-3" });
  });

  test("seq counter continues from last stored message after hydration", () => {
    const repo = makeRepo();
    const ch = new Channel("ch-1");
    repo.save(ch, ch.registerChannel("ws-1"));
    repo.save(ch, ch.grantChannelMembership("user-1"));
    repo.save(ch, ch.postChannelMessage("user-1", "msg 1")); // seq 1
    repo.save(ch, ch.postChannelMessage("user-1", "msg 2")); // seq 2
    repo.save(ch, ch.postChannelMessage("user-1", "msg 3")); // seq 3

    const loaded = repo.findById("ch-1")!;
    const [next] = loaded.postChannelMessage("user-1", "msg 4");
    expect((next as { seq: number }).seq).toBe(4);
  });

  test("full event stream round-trip: register → grant → post → hydrate → post again", () => {
    const repo = makeRepo();
    const ch = new Channel("ch-1");
    repo.save(ch, ch.registerChannel("ws-1"));
    repo.save(ch, ch.grantChannelMembership("user-1"));
    repo.save(ch, ch.postChannelMessage("user-1", "Hello world")); // seq 1

    const loaded = repo.findById("ch-1")!;
    expect(loaded.state).toBe("Active");

    const [next] = loaded.postChannelMessage("user-1", "Post-hydration message");
    expect((next as { seq: number }).seq).toBe(2);
  });
});
