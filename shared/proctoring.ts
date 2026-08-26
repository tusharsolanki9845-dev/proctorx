export const EVENT_TYPES = [
  "camera_interrupted",
  "face_absent",
  "multiple_faces",
  "fullscreen_exit",
  "tab_hidden",
  "device_check_failed",
  "audio_activity",
] as const;

export type ProctoringEventType = (typeof EVENT_TYPES)[number];
export type AnswerOption = "A" | "B" | "C" | "D";

/**
 * These event types end an active attempt immediately after the event is
 * recorded. They are assessment-control actions, not misconduct findings.
 */
export const IMMEDIATE_SUBMISSION_EVENT_TYPES = ["tab_hidden", "audio_activity"] as const;

export function requiresImmediateIntegritySubmission(eventType: ProctoringEventType) {
  return (IMMEDIATE_SUBMISSION_EVENT_TYPES as readonly ProctoringEventType[]).includes(eventType);
}

export type ProctoringConfig = {
  faceAbsentThresholdSeconds: number;
  multipleFaceThresholdSeconds: number;
  warningEventCount: number;
  autoSubmitEventCount: number;
  immediateSubmitOnFocusLoss: boolean;
  audioMonitoringEnabled: boolean;
  audioActivityThresholdSeconds: number;
  audioActivityLevel: number;
  immediateSubmitOnAudioActivity: boolean;
};

export const DEFAULT_PROCTORING_CONFIG: ProctoringConfig = {
  faceAbsentThresholdSeconds: 3,
  multipleFaceThresholdSeconds: 3,
  warningEventCount: 2,
  autoSubmitEventCount: 5,
  immediateSubmitOnFocusLoss: true,
  audioMonitoringEnabled: false,
  audioActivityThresholdSeconds: 4,
  audioActivityLevel: 18,
  immediateSubmitOnAudioActivity: false,
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
    immediateSubmitOnFocusLoss:
      typeof candidate.immediateSubmitOnFocusLoss === "boolean"
        ? candidate.immediateSubmitOnFocusLoss
        : DEFAULT_PROCTORING_CONFIG.immediateSubmitOnFocusLoss,
    audioMonitoringEnabled:
      typeof candidate.audioMonitoringEnabled === "boolean"
        ? candidate.audioMonitoringEnabled
        : DEFAULT_PROCTORING_CONFIG.audioMonitoringEnabled,
    audioActivityThresholdSeconds:
      Number.isInteger(candidate.audioActivityThresholdSeconds) && candidate.audioActivityThresholdSeconds! > 0
        ? candidate.audioActivityThresholdSeconds!
        : DEFAULT_PROCTORING_CONFIG.audioActivityThresholdSeconds,
    audioActivityLevel:
      Number.isInteger(candidate.audioActivityLevel) && candidate.audioActivityLevel! >= 1 && candidate.audioActivityLevel! <= 127
        ? candidate.audioActivityLevel!
        : DEFAULT_PROCTORING_CONFIG.audioActivityLevel,
    immediateSubmitOnAudioActivity:
      typeof candidate.immediateSubmitOnAudioActivity === "boolean"
        ? candidate.immediateSubmitOnAudioActivity
        : DEFAULT_PROCTORING_CONFIG.immediateSubmitOnAudioActivity,
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
