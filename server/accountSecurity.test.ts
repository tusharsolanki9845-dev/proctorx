import { describe, expect, it } from "vitest";
import { createAccountTokenValue, didConsumeTokenExactlyOnce, getAffectedRowCount, getTokenExpiry, hashAccountToken, isUsableAccountToken } from "./accountSecurity";

describe("account security tokens", () => {
  it("creates non-reversible token hashes with purpose-specific expiry", () => {
    const value = createAccountTokenValue();
    expect(value.length).toBeGreaterThan(32);
    expect(hashAccountToken(value)).not.toBe(value);
    const now = new Date("2026-08-25T00:00:00.000Z");
    expect(getTokenExpiry("verify_email", now).getTime()).toBe(now.getTime() + 24 * 60 * 60_000);
    expect(getTokenExpiry("reset_password", now).getTime()).toBe(now.getTime() + 60 * 60_000);
  });

  it("rejects expired and previously consumed links", () => {
    const now = new Date();
    expect(isUsableAccountToken({ expiresAt: new Date(now.getTime() + 60_000), consumedAt: null }, now)).toBe(true);
    expect(isUsableAccountToken({ expiresAt: new Date(now.getTime() - 1), consumedAt: null }, now)).toBe(false);
    expect(isUsableAccountToken({ expiresAt: new Date(now.getTime() + 60_000), consumedAt: now }, now)).toBe(false);
    expect(didConsumeTokenExactlyOnce(1)).toBe(true);
    expect(didConsumeTokenExactlyOnce(0)).toBe(false);
    expect(didConsumeTokenExactlyOnce(2)).toBe(false);
    expect(getAffectedRowCount({ affectedRows: 1 })).toBe(1);
    expect(getAffectedRowCount([{ affectedRows: 0 }, []])).toBe(0);
    expect(getAffectedRowCount({})).toBe(0);
  });
});
