import { afterEach, describe, expect, it, vi } from "vitest";
import { hashPassword, verifyConfiguredAdminCredentials, verifyPassword } from "./localAuth";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("configured administrator credentials", () => {
  it("accepts the configured login and rejects an incorrect password without production secrets", () => {
    vi.stubEnv("ADMIN_LOGIN_ID", "ci-admin");
    vi.stubEnv("ADMIN_LOGIN_PASSWORD", "ci-only-password");
    expect(verifyConfiguredAdminCredentials("ci-admin", "ci-only-password")).toBe(true);
    expect(verifyConfiguredAdminCredentials("ci-admin", "ci-only-password-incorrect")).toBe(false);
  });
});

describe("local student passwords", () => {
  it("verifies the original password and rejects an incorrect password", () => {
    const hash = hashPassword("CandidatePass!42");
    expect(verifyPassword("CandidatePass!42", hash)).toBe(true);
    expect(verifyPassword("CandidatePass!43", hash)).toBe(false);
  });
});
