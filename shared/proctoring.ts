export const EVENT_TYPES = [
  "camera_interrupted",
  "face_absent",
  "multiple_faces",
  "fullscreen_exit",
  "tab_hidden",
  "device_check_failed",
] as const;

export type ProctoringEventType = (typeof EVENT_TYPES)[number];
export type AnswerOption = "A" | "B" | "C" | "D";

export type ProctoringConfig = {
  faceAbsentThresholdSeconds: number;
  multipleFaceThresholdSeconds: number;
  warningEventCount: number;
  autoSubmitEventCount: number;
};

export const DEFAULT_PROCTORING_CONFIG: ProctoringConfig = {
  faceAbsentThresholdSeconds: 3,
  multipleFaceThresholdSeconds: 3,
  warningEventCount: 2,
  autoSubmitEventCount: 5,
};

export function normalizeProctoringConfig(value: unknown): ProctoringConfig {
  if (!value || typeof value !== "object") return DEFAULT_PROCTORING_CONFIG;
  const candidate = value as Partial<ProctoringConfig>;
  return {
    faceAbsentThresholdSeconds:
      Number.isInteger(candidate.faceAbsentThresholdSeconds) && candidate.faceAbsentThresholdSeconds! > 0
        ? candidate.faceAbsentThresholdSeconds!
        : DEFAULT_PROCTORING_CONFIG.faceAbsentThresholdSeconds,
    multipleFaceThresholdSeconds:
      Number.isInteger(candidate.multipleFaceThresholdSeconds) && candidate.multipleFaceThresholdSeconds! > 0
        ? candidate.multipleFaceThresholdSeconds!
        : DEFAULT_PROCTORING_CONFIG.multipleFaceThresholdSeconds,
    warningEventCount:
      Number.isInteger(candidate.warningEventCount) && candidate.warningEventCount! > 0
        ? candidate.warningEventCount!
        : DEFAULT_PROCTORING_CONFIG.warningEventCount,
    autoSubmitEventCount:
      Number.isInteger(candidate.autoSubmitEventCount) && candidate.autoSubmitEventCount! > 0
        ? candidate.autoSubmitEventCount!
        : DEFAULT_PROCTORING_CONFIG.autoSubmitEventCount,
  };
}

export function getIntegrityEscalation(eventCount: number, config: ProctoringConfig) {
  return {
    shouldWarn: eventCount >= config.warningEventCount,
    shouldAutoSubmit: eventCount >= config.autoSubmitEventCount,
  };
}

export function calculateExamScore(
  questions: Array<{ id: number; correctOption: AnswerOption; points: number }>,
  selectedAnswers: Map<number, AnswerOption | null | undefined>
) {
  const maxScore = questions.reduce((total, question) => total + question.points, 0);
  const score = questions.reduce(
    (total, question) => (selectedAnswers.get(question.id) === question.correctOption ? total + question.points : total),
    0
  );
  return { score, maxScore, percentage: maxScore === 0 ? 0 : Math.round((score / maxScore) * 100) };
}
