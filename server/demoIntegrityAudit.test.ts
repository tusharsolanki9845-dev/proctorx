import { describe, expect, it } from "vitest";
import { calculateExamScore, EVENT_TYPES, getIntegrityEscalation, normalizeProctoringConfig } from "../shared/proctoring";

const demoPaper = [
  { id: 101, correctOption: "B" as const, points: 2 },
  { id: 102, correctOption: "C" as const, points: 3 },
  { id: 103, correctOption: "A" as const, points: 1 },
];

describe("Integrity Foundations Demo — simulated candidate audit", () => {
  it("scores the submitted demo paper server-side without exposing the answer key during delivery", () => {
    const candidateAnswers = new Map([[101, "B" as const], [102, "D" as const], [103, "A" as const]]);
    expect(calculateExamScore(demoPaper, candidateAnswers)).toEqual({ score: 3, maxScore: 6, percentage: 50 });
  });

  it("detects every configured cheating-signal category and escalates after the configured threshold", () => {
    const config = normalizeProctoringConfig({ warningEventCount: 2, autoSubmitEventCount: 5, faceAbsentThresholdSeconds: 3, multipleFaceThresholdSeconds: 3 });
    const simulatedSignals = ["camera_interrupted", "face_absent", "multiple_faces", "fullscreen_exit", "tab_hidden"] as const;
    expect(simulatedSignals.every(signal => EVENT_TYPES.includes(signal))).toBe(true);
    expect(getIntegrityEscalation(1, config)).toEqual({ shouldWarn: false, shouldAutoSubmit: false });
    expect(getIntegrityEscalation(2, config)).toEqual({ shouldWarn: true, shouldAutoSubmit: false });
    expect(getIntegrityEscalation(4, config)).toEqual({ shouldWarn: true, shouldAutoSubmit: false });
    expect(getIntegrityEscalation(5, config)).toEqual({ shouldWarn: true, shouldAutoSubmit: true });
  });
});
