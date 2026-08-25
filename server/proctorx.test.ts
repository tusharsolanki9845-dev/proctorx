import { describe, expect, it } from "vitest";
import { calculateExamScore, getIntegrityEscalation, normalizeProctoringConfig } from "../shared/proctoring";
import { getRemainingExamSeconds } from "../shared/examTiming";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

describe("ProctorX scoring", () => {
  it("scores correct selections without giving credit to unanswered questions", () => {
    const result = calculateExamScore(
      [
        { id: 1, correctOption: "A", points: 2 },
        { id: 2, correctOption: "C", points: 1 },
      ],
      new Map([
        [1, "A"],
        [2, null],
      ])
    );
    expect(result).toEqual({ score: 2, maxScore: 3, percentage: 67 });
  });
});

describe("ProctorX integrity escalation", () => {
  it("warns before triggering configured automatic submission", () => {
    const config = normalizeProctoringConfig({ warningEventCount: 2, autoSubmitEventCount: 5 });
    expect(getIntegrityEscalation(2, config)).toEqual({ shouldWarn: true, shouldAutoSubmit: false });
    expect(getIntegrityEscalation(5, config)).toEqual({ shouldWarn: true, shouldAutoSubmit: true });
  });

  it("returns safe defaults for incomplete configuration", () => {
    expect(normalizeProctoringConfig({ warningEventCount: -1 })).toMatchObject({
      warningEventCount: 2,
      autoSubmitEventCount: 5,
    });
  });
});

describe("ProctorX timing", () => {
  it("respects the earlier scheduled end even when exam duration is longer", () => {
    const startedAt = new Date("2026-08-25T10:00:00.000Z");
    const scheduledEnd = new Date("2026-08-25T10:04:00.000Z");
    expect(getRemainingExamSeconds(new Date("2026-08-25T10:03:30.000Z").getTime(), startedAt, 600, scheduledEnd)).toBe(30);
    expect(getRemainingExamSeconds(new Date("2026-08-25T10:04:01.000Z").getTime(), startedAt, 600, scheduledEnd)).toBe(0);
  });
});

describe("ProctorX role protection", () => {
  it("rejects administrator procedures for a standard candidate account", async () => {
    const ctx = {
      user: {
        id: 22,
        openId: "candidate-22",
        name: "Candidate",
        email: "candidate@example.com",
        loginMethod: "manus",
        role: "user",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
      req: {} as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    } as TrpcContext;
    const caller = appRouter.createCaller(ctx);
    await expect(caller.proctorx.admin.listExams()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
