import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getFirebaseAuth = vi.hoisted(() => vi.fn());
const isFirebaseAdminConfigured = vi.hoisted(() => vi.fn());
const getFirebaseAdminApp = vi.hoisted(() => vi.fn());

vi.mock("./firebaseAdmin", () => ({ getFirebaseAuth, getFirebaseAdminApp, isFirebaseAdminConfigured }));

import {
  authenticateFirebaseEmailPassword,
  isFirebaseEmailPasswordAuthenticationConfigured,
  isFirebaseEmailActionRateLimited,
  resendFirebaseVerificationEmail,
  sendFirebaseVerificationEmail,
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
    getFirebaseAdminApp.mockReturnValue({ options: { projectId: "test-project", credential: { getAccessToken: vi.fn().mockResolvedValue({ access_token: "test-oauth-token" }) } } });
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
      expect.stringContaining("accounts:sendOobCode"),
      expect.objectContaining({ method: "POST", headers: expect.objectContaining({ Authorization: "Bearer test-oauth-token" }) })
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
      .mockResolvedValueOnce({ ok: true, json: async () => ({ idToken: "verification-id-token" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    getFirebaseAuth.mockReturnValue({
      getUserByEmail: vi.fn().mockResolvedValue({ uid: "firebase-user-id", emailVerified: false }),
      createCustomToken: vi.fn().mockResolvedValue("server-only-custom-token"),
      verifyIdToken: vi.fn().mockResolvedValue({ uid: "firebase-user-id" }),
    });

    await expect(resendFirebaseVerificationEmail("student@example.test", "https://proctorx-assessment.netlify.app")).resolves.toEqual({ mode: "sent" });
    expect(fetchMock.mock.calls[0]?.[0]).toContain("accounts:signInWithCustomToken?key=test-web-key");
    expect(fetchMock.mock.calls[1]?.[0]).toContain("accounts:sendOobCode");
    expect(fetchMock.mock.calls[1]?.[1]?.headers).toMatchObject({ Authorization: "Bearer test-oauth-token" });
  });

  it("uses Firebase's default action handler only when the approved continuation domain is rejected", async () => {
    process.env.FIREBASE_WEB_API_KEY = "test-web-key";
    process.env.PROCTORX_PUBLIC_ORIGIN = "https://proctorx-assessment.netlify.app";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: { message: "UNAUTHORIZED_DOMAIN" } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendFirebaseVerificationEmail("signed-id-token", "https://proctorx-assessment.netlify.app")).resolves.toEqual({ mode: "sent" });
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toMatchObject({ continueUrl: "https://proctorx-assessment.netlify.app/signin" });
    expect(JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string)).toEqual({ requestType: "VERIFY_EMAIL", idToken: "signed-id-token", targetProjectId: "test-project" });
  });

  it("rejects a caller-controlled email-action origin before contacting Firebase", async () => {
    process.env.FIREBASE_WEB_API_KEY = "test-web-key";
    process.env.PROCTORX_PUBLIC_ORIGIN = "https://proctorx-assessment.netlify.app";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendFirebaseVerificationEmail("signed-id-token", "https://unapproved.example")).rejects.toThrow("not approved");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("identifies Firebase's temporary email-action rate limit without treating it as successful delivery", async () => {
    process.env.FIREBASE_WEB_API_KEY = "test-web-key";
    process.env.PROCTORX_PUBLIC_ORIGIN = "https://proctorx-assessment.netlify.app";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: { message: "TOO_MANY_ATTEMPTS_TRY_LATER" } }) }));

    const error = await sendFirebaseVerificationEmail("signed-id-token", "https://proctorx-assessment.netlify.app").catch(error => error);
    expect(isFirebaseEmailActionRateLimited(error)).toBe(true);
  });
});
