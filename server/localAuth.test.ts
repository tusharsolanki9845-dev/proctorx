import { describe, expect, it } from "vitest";
import { hashPassword, verifyConfiguredAdminCredentials, verifyPassword } from "./localAuth";

describe("configured administrator credentials", () => {
  it("accepts the protected configured login and rejects an incorrect password", () => {
    const loginId = process.env.ADMIN_LOGIN_ID;
    const password = process.env.ADMIN_LOGIN_PASSWORD;
    expect(loginId).toBeTruthy();
    expect(password).toBeTruthy();
    expect(verifyConfiguredAdminCredentials(loginId!, password!)).toBe(true);
    expect(verifyConfiguredAdminCredentials(loginId!, `${password!}-incorrect`)).toBe(false);
  });
});

describe("local student passwords", () => {
  it("verifies the original password and rejects an incorrect password", () => {
    const hash = hashPassword("CandidatePass!42");
    expect(verifyPassword("CandidatePass!42", hash)).toBe(true);
    expect(verifyPassword("CandidatePass!43", hash)).toBe(false);
  });
});
