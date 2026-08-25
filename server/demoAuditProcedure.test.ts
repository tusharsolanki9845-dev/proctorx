import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const timeline: Array<{ attemptId: number; eventType: string; durationMs: number; eventCount: number }> = [];

vi.mock("./db", () => ({
  createAdminNotification: vi.fn(),
  getAttemptReview: vi.fn(async () => ({ attempt: { id: 900, submissionReason: "integrity_threshold" }, answers: [], events: [...timeline] })),
  getStudentAttempt: vi.fn(async () => ({ attempt: { id: 900 }, questions: [], answers: [], events: [...timeline] })),
  recordProctoringEvent: vi.fn(async (_userId: number, input: { attemptId: number; eventType: string; durationMs: number }) => {
    const eventCount = timeline.length + 1;
    timeline.push({ ...input, eventCount });
    return { eventCount, proctoringConfig: { warningEventCount: 2, autoSubmitEventCount: 5, faceAbsentThresholdSeconds: 3, multipleFaceThresholdSeconds: 3 } };
  }),
  submitExamAttempt: vi.fn(async (_userId: number, attemptId: number, reason: string) => ({ id: attemptId, submissionReason: reason })),
}));

import * as db from "./db";
import { appRouter } from "./routers";

function candidateContext(role: "user" | "admin" = "user"): TrpcContext {
  return { user: { id: role === "admin" ? 2 : 1, openId: `demo-${role}`, name: "Demo Candidate", email: "demo@example.com", loginMethod: "local", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: { cookie: vi.fn(), clearCookie: vi.fn() } as unknown as TrpcContext["res"] };
}

describe("Integrity Foundations Demo — procedure and timeline audit", () => {
  it("records every cheating signal, warns, auto-submits, and exposes the resulting timeline to the owner and administrator", async () => {
    timeline.splice(0); vi.clearAllMocks();
    const candidate = appRouter.createCaller(candidateContext());
    const signals = ["camera_interrupted", "face_absent", "multiple_faces", "fullscreen_exit", "tab_hidden"] as const;
    const outcomes = [];
    for (const eventType of signals) outcomes.push(await candidate.proctorx.proctoring.logEvent({ attemptId: 900, eventType, durationMs: 4000 }));

    expect(timeline.map(event => event.eventType)).toEqual(signals);
    expect(outcomes[0]).toMatchObject({ shouldWarn: false, submitted: false });
    expect(outcomes[1]).toMatchObject({ shouldWarn: true, submitted: false });
    expect(outcomes[4]).toMatchObject({ shouldWarn: true, shouldAutoSubmit: true, submitted: true });
    expect(db.submitExamAttempt).toHaveBeenCalledWith(1, 900, "integrity_threshold");
    expect(db.createAdminNotification).toHaveBeenCalledWith(expect.objectContaining({ type: "high_risk_integrity", relatedAttemptId: 900, destination: "/admin/attempt/900" }));

    const ownerReport = await candidate.proctorx.student.getAttempt({ attemptId: 900 });
    expect(ownerReport.events.map(event => event.eventType)).toEqual(signals);
    const administrator = appRouter.createCaller(candidateContext("admin"));
    const adminReview = await administrator.proctorx.admin.getAttemptReview({ attemptId: 900 });
    expect(adminReview.attempt.submissionReason).toBe("integrity_threshold");
    expect(adminReview.events.map(event => event.eventType)).toEqual(signals);
  });
});
