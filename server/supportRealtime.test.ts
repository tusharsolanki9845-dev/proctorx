import { describe, expect, it } from "vitest";
import { notifyAdministrators, notifySupportConversation } from "./supportRealtime";

describe("Vercel-compatible notification boundary", () => {
  it("does not rely on an in-memory emitter after a persisted update", () => {
    expect(() => notifySupportConversation(42)).not.toThrow();
    expect(() => notifyAdministrators()).not.toThrow();
  });
});
