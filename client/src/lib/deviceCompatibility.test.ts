import { describe, expect, it } from "vitest";
import { detectDeviceCompatibility, getCompatibilitySummary } from "./deviceCompatibility";

describe("device compatibility diagnostics", () => {
  it("recognizes an HTTPS Capacitor Android runtime with required device APIs", () => {
    const result = detectDeviceCompatibility({
      isSecureContext: true,
      Capacitor: { isNativePlatform: () => true },
      navigator: { mediaDevices: { getUserMedia: async () => new MediaStream() }, userAgent: "Mozilla/5.0 (Linux; Android 14)" } as unknown as Pick<Navigator, "mediaDevices" | "userAgent">,
      document: { fullscreenEnabled: true },
    });

    expect(result).toMatchObject({ secureContext: true, cameraSupported: true, microphoneSupported: true, fullscreenSupported: true, android: true, capacitorNative: true });
    expect(getCompatibilitySummary(result)).toEqual({ ready: true, missing: [] });
  });

  it("identifies missing secure-context and device APIs without requesting any permission", () => {
    const result = detectDeviceCompatibility({
      isSecureContext: false,
      navigator: { mediaDevices: undefined, userAgent: "Desktop" } as unknown as Pick<Navigator, "mediaDevices" | "userAgent">,
      document: { fullscreenEnabled: false },
    });

    expect(getCompatibilitySummary(result)).toEqual({ ready: false, missing: ["HTTPS secure context", "camera API", "microphone API", "fullscreen API"] });
  });
});
