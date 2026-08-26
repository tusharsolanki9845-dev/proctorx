import { describe, expect, it } from "vitest";
import { calculateAudioLevel } from "./useAudioActivityMonitor";

describe("calculateAudioLevel", () => {
  it("returns a coarse local signal level without retaining or interpreting audio content", () => {
    expect(calculateAudioLevel(new Uint8Array([128, 128, 128, 128]))).toBe(0);
    expect(calculateAudioLevel(new Uint8Array([96, 160, 96, 160]))).toBe(64);
  });
});
