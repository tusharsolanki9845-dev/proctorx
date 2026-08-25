import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({
  createAccountToken: vi.fn(),
  createAdminNotification: vi.fn(),
  createLocalStudent: vi.fn(),
  consumeAccountToken: vi.fn(),
  ensureConfiguredAdmin: vi.fn(),
  findLocalAccountByEmail: vi.fn(),
  findLocalCredentialByEmail: vi.fn(),
  getUserById: vi.fn(),
  getStudentAttempt: vi.fn(),
  getSupportMessages: vi.fn(),
  markEmailVerified: vi.fn(),
  recordProctoringEvent: vi.fn(),
  replaceLocalPassword: vi.fn(),
  sendSupportMessage: vi.fn(),
  submitExamAttempt: vi.fn(),
  touchUserSignIn: vi.fn(),
  updateManagedUser: vi.fn(),
  getAttemptReview: vi.fn(),
}));

import * as db from "./db";
import { appRouter } from "./routers";
import { hashPassword } from "./localAuth";
import { LOCAL_SESSION_COOKIE } from "./localSession";
import type { TrpcContext } from "./_core/context";

function createContext(role: "user" | "admin" | null = null, userId = 7): { ctx: TrpcContext; setCookies: Array<{ name: string; value: string }> } {
  const setCookies: Array<{ name: string; value: string }> = [];
  return {
    ctx: {
      user: role ? { id: userId, openId: "test-user", name: "Test User", email: "test@example.com", loginMethod: "local", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() } : null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { cookie: (name: string, value: string) => setCookies.push({ name, value }), clearCookie: vi.fn() } as unknown as TrpcContext["res"],
    },
    setCookies,
  };
}

describe("credential procedures", () => {
  beforeEach(() => vi.clearAllMocks());

  it("issues a local session when student credentials are valid and rejects an incorrect password", async () => {
    const passwordHash = hashPassword("StudentPass!42");
    vi.mocked(db.findLocalCredentialByEmail).mockResolvedValue({ userId: 21, passwordHash, role: "user", name: "Student", email: "student@example.com", emailVerifiedAt: new Date() });
    const success = createContext();
    const result = await appRouter.createCaller(success.ctx).proctorx.credentials.signIn({ email: "student@example.com", password: "StudentPass!42" });
    expect(result).toEqual({ id: 21, role: "user" });
    expect(success.setCookies[0]?.name).toBe(LOCAL_SESSION_COOKIE);
    const failure = createContext();
    await expect(appRouter.createCaller(failure.ctx).proctorx.credentials.signIn({ email: "student@example.com", password: "incorrect" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(failure.setCookies).toHaveLength(0);
  });

  it("creates a session for configured administrator credentials without exposing configuration", async () => {
    vi.mocked(db.ensureConfiguredAdmin).mockResolvedValue({ id: 31, openId: "admin:test", name: "Admin", email: null, loginMethod: "configured-admin", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() });
    const { ctx, setCookies } = createContext();
    const result = await appRouter.createCaller(ctx).proctorx.credentials.adminSignIn({ loginId: process.env.ADMIN_LOGIN_ID!, password: process.env.ADMIN_LOGIN_PASSWORD! });
    expect(result).toEqual({ id: 31, role: "admin" });
    expect(setCookies[0]?.name).toBe(LOCAL_SESSION_COOKIE);
  });
});

describe("administrator procedure isolation", () => {
  it("rejects a student attempting identity management or detailed attempt reporting", async () => {
    const { ctx } = createContext("user");
    const caller = appRouter.createCaller(ctx);
    await expect(caller.proctorx.admin.updateUser({ userId: 8, fullName: "Other Student", role: "admin" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.proctorx.admin.getAttemptReview({ attemptId: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.proctorx.notifications.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.updateManagedUser).not.toHaveBeenCalled();
    expect(db.getAttemptReview).not.toHaveBeenCalled();
  });

  it("allows an administrator to update identity data and promote a user", async () => {
    vi.mocked(db.updateManagedUser).mockResolvedValue({ id: 8, openId: "student-8", name: "Promoted Student", email: "student@example.com", loginMethod: "local", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() });
    const { ctx } = createContext("admin");
    const result = await appRouter.createCaller(ctx).proctorx.admin.updateUser({ userId: 8, fullName: "Promoted Student", collegeName: "Example College", rollNumber: "R-8", role: "admin" });
    expect(result?.role).toBe("admin");
    expect(db.updateManagedUser).toHaveBeenCalledWith(7, expect.objectContaining({ userId: 8, role: "admin", rollNumber: "R-8" }));
  });
});

describe("student support and report procedures", () => {
  it("routes report retrieval through the authenticated attempt owner and blocks a student from the support inbox", async () => {
    vi.mocked(db.getStudentAttempt).mockResolvedValue({ attempt: { id: 55 }, questions: [], answers: [], events: [] } as never);
    const { ctx } = createContext("user");
    const caller = appRouter.createCaller(ctx);
    await caller.proctorx.student.getAttempt({ attemptId: 55 });
    expect(db.getStudentAttempt).toHaveBeenCalledWith(7, 55);
    await expect(caller.proctorx.support.inbox()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects a report request from a different student", async () => {
    vi.mocked(db.getStudentAttempt).mockImplementation(async userId => userId === 7 ? ({ attempt: { id: 55 }, questions: [], answers: [], events: [] } as never) : null);
    await expect(appRouter.createCaller(createContext("user", 7).ctx).proctorx.student.getAttempt({ attemptId: 55 })).resolves.toMatchObject({ attempt: { id: 55 } });
    await expect(appRouter.createCaller(createContext("user", 8).ctx).proctorx.student.getAttempt({ attemptId: 55 })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("assigns student support messages to the authenticated owner and never accepts a client-selected role", async () => {
    vi.mocked(db.sendSupportMessage).mockResolvedValue({ id: 1 } as never);
    vi.mocked(db.getSupportMessages).mockResolvedValue({ attempt: { id: 55 }, messages: [] } as never);
    const { ctx } = createContext("user");
    const caller = appRouter.createCaller(ctx);
    await caller.proctorx.support.send({ attemptId: 55, message: "My camera permission failed." });
    await caller.proctorx.support.list({ attemptId: 55 });
    expect(db.sendSupportMessage).toHaveBeenCalledWith({ attemptId: 55, message: "My camera permission failed.", senderUserId: 7, senderRole: "student" });
    expect(db.getSupportMessages).toHaveBeenCalledWith(55, 7, false);
  });
});

describe("verification, reset, and high-risk alert procedures", () => {
  it("consumes verification and reset tokens only through their intended procedure", async () => {
    vi.mocked(db.consumeAccountToken).mockResolvedValueOnce({ userId: 22 } as never).mockResolvedValueOnce({ userId: 22 } as never);
    const { ctx } = createContext(); const caller = appRouter.createCaller(ctx);
    await expect(caller.proctorx.credentials.verifyEmail({ token: "v".repeat(40) })).resolves.toEqual({ verified: true });
    expect(db.markEmailVerified).toHaveBeenCalledWith(22);
    await expect(caller.proctorx.credentials.resetPassword({ token: "r".repeat(40), password: "UpdatedPass!42" })).resolves.toEqual({ reset: true });
    expect(db.replaceLocalPassword).toHaveBeenCalledWith(22, expect.any(String));
  });

  it("rejects a verification link after its token has already been consumed", async () => {
    vi.mocked(db.consumeAccountToken).mockResolvedValueOnce({ userId: 22 } as never).mockResolvedValueOnce(null);
    const caller = appRouter.createCaller(createContext().ctx);
    await expect(caller.proctorx.credentials.verifyEmail({ token: "x".repeat(40) })).resolves.toEqual({ verified: true });
    await expect(caller.proctorx.credentials.verifyEmail({ token: "x".repeat(40) })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("creates an administrator alert when an integrity threshold requires automatic submission", async () => {
    vi.mocked(db.recordProctoringEvent).mockResolvedValue({ eventCount: 5, proctoringConfig: { warningEventCount: 2, autoSubmitEventCount: 5 } } as never);
    const { ctx } = createContext("user");
    await appRouter.createCaller(ctx).proctorx.proctoring.logEvent({ attemptId: 15, eventType: "tab_hidden", durationMs: 0 });
    expect(db.createAdminNotification).toHaveBeenCalledWith(expect.objectContaining({ type: "high_risk_integrity", relatedAttemptId: 15, destination: "/admin/attempt/15" }));
  });
});
