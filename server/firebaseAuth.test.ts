import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getFirebaseAuth = vi.hoisted(() => vi.fn());
const isFirebaseAdminConfigured = vi.hoisted(() => vi.fn());

vi.mock("./firebaseAdmin", () => ({ getFirebaseAuth, isFirebaseAdminConfigured }));

import {
  authenticateFirebaseEmailPassword,
  isFirebaseEmailPasswordAuthenticationConfigured,
  resendFirebaseVerificationEmail,
  sendFirebasePasswordResetEmail,
} from "./firebaseAuth";

describe("Firebase Email/Password gateway", () => {
  const originalEnvironment = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.FIREBASE_WEB_API_KEY;
    delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    delete process.env.DATABASE_URL;
    delete process.env.PROCTORX_PUBLIC_ORIGIN;
    isFirebaseAdminConfigured.mockReturnValue(false);
  });

  afterEach(() => {
    process.env = { ...originalEnvironment };
    vi.unstubAllGlobals();
  });

  it("requires both server-only Firebase credentials before enabling production Email/Password authentication", () => {
    expect(isFirebaseEmailPasswordAuthenticationConfigured()).toBe(false);
    isFirebaseAdminConfigured.mockReturnValue(true);
    process.env.FIREBASE_WEB_API_KEY = "test-web-key";
    expect(isFirebaseEmailPasswordAuthenticationConfigured()).toBe(true);
    process.env.DATABASE_URL = "mysql://legacy";
    expect(isFirebaseEmailPasswordAuthenticationConfigured()).toBe(false);
  });

  it("returns a privacy-preserving accepted result when Firebase hides whether a reset email exists", async () => {
    process.env.FIREBASE_WEB_API_KEY = "test-web-key";
    process.env.PROCTORX_PUBLIC_ORIGIN = "https://proctorx-assessment.netlify.app";
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: { message: "EMAIL_NOT_FOUND" } }) });
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendFirebasePasswordResetEmail("unknown@example.test", "https://proctorx-assessment.netlify.app")).resolves.toEqual({ mode: "sent" });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("accounts:sendOobCode?key=test-web-key"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("verifies the server-side Firebase ID token before accepting an email/password session", async () => {
    process.env.FIREBASE_WEB_API_KEY = "test-web-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ idToken: "signed-id-token", localId: "firebase-user-id", email: "student@example.test" }) }));
    getFirebaseAuth.mockReturnValue({ verifyIdToken: vi.fn().mockResolvedValue({ uid: "firebase-user-id", email_verified: true }) });

    await expect(authenticateFirebaseEmailPassword({ email: "student@example.test", password: "safe password" })).resolves.toMatchObject({ uid: "firebase-user-id", emailVerified: true });
  });

  it("resends Firebase verification using a server-minted custom-token session", async () => {
    process.env.FIREBASE_WEB_API_KEY = "test-web-key";
    process.env.PROCTORX_PUBLIC_ORIGIN = "https://proctorx-assessment.netlify.app";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ idToken: "verification-id-token", localId: "firebase-user-id" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    getFirebaseAuth.mockReturnValue({
      getUserByEmail: vi.fn().mockResolvedValue({ uid: "firebase-user-id", emailVerified: false }),
      createCustomToken: vi.fn().mockResolvedValue("server-only-custom-token"),
      verifyIdToken: vi.fn().mockResolvedValue({ uid: "firebase-user-id" }),
    });

    await expect(resendFirebaseVerificationEmail("student@example.test", "https://proctorx-assessment.netlify.app")).resolves.toEqual({ mode: "sent" });
    expect(fetchMock.mock.calls[0]?.[0]).toContain("accounts:signInWithCustomToken?key=test-web-key");
    expect(fetchMock.mock.calls[1]?.[0]).toContain("accounts:sendOobCode?key=test-web-key");
  });
});
