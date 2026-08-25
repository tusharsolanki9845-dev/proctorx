import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { examAttempts, examAuditLogs, exams, users } from "../drizzle/schema";
import { createAdminNotification, getAttemptReview, getDb, getStudentAttempt, listAdminNotifications, recordProctoringEvent, submitExamAttempt } from "./db";

const suffix = randomUUID().slice(0, 10);
let adminId: number | null = null;
let studentId: number | null = null;
let otherStudentId: number | null = null;
let examId: number | null = null;
let attemptId: number | null = null;

afterAll(async () => {
  const database = await getDb();
  if (!database) return;
  if (attemptId) await database.delete(examAttempts).where(eq(examAttempts.id, attemptId));
  if (examId) await database.delete(exams).where(eq(exams.id, examId));
  const auditUserIds = [adminId, studentId, otherStudentId].filter((id): id is number => id !== null);
  if (auditUserIds.length) {
    await database.delete(examAuditLogs).where(inArray(examAuditLogs.actorUserId, auditUserIds));
    await database.delete(users).where(inArray(users.id, auditUserIds));
  }
});

describe("storage-backed Integrity Foundations Demo audit", () => {
  it("persists all cheating signals, auto-submits the demo attempt, and exposes alert/review data only to authorized roles", async () => {
    const database = await getDb();
    if (!database) throw new Error("The audit database is unavailable.");
    const [admin] = await database.insert(users).values({ openId: `audit-admin:${suffix}`, name: "Audit Administrator", email: `audit-admin-${suffix}@example.test`, loginMethod: "audit", role: "admin" }).$returningId();
    const [student] = await database.insert(users).values({ openId: `audit-student:${suffix}`, name: "Audit Candidate", email: `audit-student-${suffix}@example.test`, loginMethod: "audit", role: "user" }).$returningId();
    const [otherStudent] = await database.insert(users).values({ openId: `audit-other:${suffix}`, name: "Other Candidate", email: `audit-other-${suffix}@example.test`, loginMethod: "audit", role: "user" }).$returningId();
    adminId = admin!.id; studentId = student!.id; otherStudentId = otherStudent!.id;
    const [exam] = await database.insert(exams).values({ createdByUserId: adminId, title: `Integrity Foundations Demo ${suffix}`, durationSeconds: 900, status: "live", proctoringConfig: { warningEventCount: 2, autoSubmitEventCount: 5, faceAbsentThresholdSeconds: 3, multipleFaceThresholdSeconds: 3 } }).$returningId();
    examId = exam!.id;
    const [attempt] = await database.insert(examAttempts).values({ examId, userId: studentId, status: "in_progress" }).$returningId();
    attemptId = attempt!.id;

    const signals = ["camera_interrupted", "face_absent", "multiple_faces", "fullscreen_exit", "tab_hidden"] as const;
    for (const eventType of signals) await recordProctoringEvent(studentId, { attemptId, eventType, durationMs: 4000 });
    await submitExamAttempt(studentId, attemptId, "integrity_threshold");
    await createAdminNotification({ type: "high_risk_integrity", title: `Audit high-risk threshold ${suffix}`, body: "The isolated audit candidate reached the automatic-submission threshold.", destination: `/admin/attempt/${attemptId}`, relatedAttemptId: attemptId });

    const ownerReport = await getStudentAttempt(studentId, attemptId);
    expect(ownerReport?.events.map(event => event.eventType)).toEqual([...signals].reverse());
    expect(await getStudentAttempt(otherStudentId, attemptId)).toBeNull();
    const review = await getAttemptReview(attemptId);
    expect(review?.attempt.submissionReason).toBe("integrity_threshold");
    expect(review?.events.map(event => event.eventType)).toEqual([...signals].reverse());
    const notifications = await listAdminNotifications();
    expect(notifications.some(notification => notification.relatedAttemptId === attemptId && notification.type === "high_risk_integrity")).toBe(true);
  }, 20_000);
});
