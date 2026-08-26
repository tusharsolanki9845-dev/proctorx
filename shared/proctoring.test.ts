import { describe, expect, it } from "vitest";
import { DEFAULT_PROCTORING_CONFIG, normalizeProctoringConfig, requiresImmediateIntegritySubmission } from "./proctoring";

describe("audio activity proctoring policy", () => {
  it("keeps microphone monitoring opt-in and does not enable strict audio submission by default", () => {
    expect(normalizeProctoringConfig({})).toMatchObject({
      audioMonitoringEnabled: false,
      immediateSubmitOnAudioActivity: false,
      audioActivityThresholdSeconds: DEFAULT_PROCTORING_CONFIG.audioActivityThresholdSeconds,
    });
  });

  it("normalizes only safe configured audio bounds and classifies audio activity as an eligible immediate event", () => {
    expect(normalizeProctoringConfig({ audioMonitoringEnabled: true, audioActivityThresholdSeconds: 8, audioActivityLevel: 24, immediateSubmitOnAudioActivity: true })).toMatchObject({
      audioMonitoringEnabled: true,
      audioActivityThresholdSeconds: 8,
      audioActivityLevel: 24,
      immediateSubmitOnAudioActivity: true,
    });
    expect(normalizeProctoringConfig({ audioActivityLevel: 999 }).audioActivityLevel).toBe(DEFAULT_PROCTORING_CONFIG.audioActivityLevel);
    expect(requiresImmediateIntegritySubmission("audio_activity")).toBe(true);
  });
});
