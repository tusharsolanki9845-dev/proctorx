import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it, vi } from "vitest";
import { examAttempts, examAuditLogs, exams, users } from "../drizzle/schema";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";
import { appRouter } from "./routers";

const suffix = randomUUID().slice(0, 10);
let auditUserIds: number[] = [];
let auditExamId: number | null = null;
let auditAttemptId: number | null = null;

function context(userId: number, role: "user" | "admin"): TrpcContext {
  return { user: { id: userId, openId: `full-audit-${userId}`, name: "Audit User", email: `audit-${userId}@example.test`, loginMethod: "audit", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: { cookie: vi.fn(), clearCookie: vi.fn() } as unknown as TrpcContext["res"] };
}

afterAll(async () => {
  const database = await getDb();
  if (!database) return;
  if (auditAttemptId) await database.delete(examAttempts).where(eq(examAttempts.id, auditAttemptId));
  if (auditExamId) await database.delete(exams).where(eq(exams.id, auditExamId));
  if (auditUserIds.length) {
    await database.delete(examAuditLogs).where(inArray(examAuditLogs.actorUserId, auditUserIds));
    await database.delete(users).where(inArray(users.id, auditUserIds));
  }
});

describe("full-stack Integrity Foundations Demo audit", () => {
  it("detects five cheating signals, persists the review timeline, auto-submits, and exposes the high-risk alert only to the administrator", async () => {
    const database = await getDb();
    if (!database) throw new Error("The audit database is unavailable.");
    const [admin] = await database.insert(users).values({ openId: `full-audit-admin:${suffix}`, name: "Audit Administrator", email: `full-admin-${suffix}@example.test`, loginMethod: "audit", role: "admin" }).$returningId();
    const [candidate] = await database.insert(users).values({ openId: `full-audit-candidate:${suffix}`, name: "Audit Candidate", email: `full-candidate-${suffix}@example.test`, loginMethod: "audit", role: "user" }).$returningId();
    const [otherCandidate] = await database.insert(users).values({ openId: `full-audit-other:${suffix}`, name: "Other Candidate", email: `full-other-${suffix}@example.test`, loginMethod: "audit", role: "user" }).$returningId();
    auditUserIds = [admin!.id, candidate!.id, otherCandidate!.id];
    const [exam] = await database.insert(exams).values({ createdByUserId: admin!.id, title: `Full-stack audit demo ${suffix}`, durationSeconds: 900, status: "live", proctoringConfig: { warningEventCount: 2, autoSubmitEventCount: 5, faceAbsentThresholdSeconds: 3, multipleFaceThresholdSeconds: 3 } }).$returningId();
    auditExamId = exam!.id;
    const [attempt] = await database.insert(examAttempts).values({ examId: auditExamId, userId: candidate!.id, status: "in_progress" }).$returningId();
    auditAttemptId = attempt!.id;

    const candidateCaller = appRouter.createCaller(context(candidate!.id, "user"));
    const signals = ["camera_interrupted", "face_absent", "multiple_faces", "fullscreen_exit", "tab_hidden"] as const;
    const outcomes = [];
    for (const eventType of signals) outcomes.push(await candidateCaller.proctorx.proctoring.logEvent({ attemptId: auditAttemptId, eventType, durationMs: 4000 }));

    expect(outcomes[1]).toMatchObject({ shouldWarn: true, submitted: false });
    expect(outcomes[4]).toMatchObject({ shouldAutoSubmit: true, submitted: true });
    const ownerReport = await candidateCaller.proctorx.student.getAttempt({ attemptId: auditAttemptId });
    expect(ownerReport.attempt.submissionReason).toBe("integrity_threshold");
    expect(ownerReport.events.map(event => event.eventType)).toEqual([...signals].reverse());
    await expect(appRouter.createCaller(context(otherCandidate!.id, "user")).proctorx.student.getAttempt({ attemptId: auditAttemptId })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(appRouter.createCaller(context(candidate!.id, "user")).proctorx.notifications.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
    const adminCaller = appRouter.createCaller(context(admin!.id, "admin"));
    const review = await adminCaller.proctorx.admin.getAttemptReview({ attemptId: auditAttemptId });
    expect(review.attempt.submissionReason).toBe("integrity_threshold");
    expect(review.events.map(event => event.eventType)).toEqual([...signals].reverse());
    const notifications = await adminCaller.proctorx.notifications.list();
    expect(notifications.some(notification => notification.relatedAttemptId === auditAttemptId && notification.type === "high_risk_integrity")).toBe(true);
  }, 25_000);
});
