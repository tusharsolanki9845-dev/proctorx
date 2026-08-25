import { afterEach, describe, expect, it } from "vitest";
import { __setDbForTests, consumeAccountToken } from "./db";

function fakeDatabase(token: unknown, updateResult: unknown) {
  return {
    select: () => ({ from: () => ({ where: () => ({ limit: async () => token ? [token] : [] }) }) }),
    update: () => ({ set: () => ({ where: async () => updateResult }) }),
  };
}

describe("db.consumeAccountToken", () => {
  afterEach(() => __setDbForTests(null));

  it("returns a token only when the persistence update consumes exactly one unconsumed row", async () => {
    const token = { id: 11, userId: 7, purpose: "verify_email", tokenHash: "hashed", expiresAt: new Date(Date.now() + 60_000), consumedAt: null, createdAt: new Date() };
    __setDbForTests(fakeDatabase(token, [{ affectedRows: 1 }, []]));
    await expect(consumeAccountToken("hashed", "verify_email")).resolves.toMatchObject({ id: 11, userId: 7 });
  });

  it("rejects zero-row updates, including a concurrent or repeat consume", async () => {
    const token = { id: 11, userId: 7, purpose: "verify_email", tokenHash: "hashed", expiresAt: new Date(Date.now() + 60_000), consumedAt: null, createdAt: new Date() };
    __setDbForTests(fakeDatabase(token, [{ affectedRows: 0 }, []]));
    await expect(consumeAccountToken("hashed", "verify_email")).resolves.toBeNull();
  });
});
