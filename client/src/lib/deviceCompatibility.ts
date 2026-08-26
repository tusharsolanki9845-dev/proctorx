export type DeviceCompatibility = {
  secureContext: boolean;
  cameraSupported: boolean;
  microphoneSupported: boolean;
  fullscreenSupported: boolean;
  android: boolean;
  capacitorNative: boolean;
};

type CompatibilityRuntime = {
  isSecureContext: boolean;
  Capacitor?: { isNativePlatform?: () => boolean };
  navigator: Pick<Navigator, "mediaDevices" | "userAgent">;
  document: Pick<Document, "fullscreenEnabled">;
};

export function detectDeviceCompatibility(input: CompatibilityRuntime): DeviceCompatibility {
  const capacitor = input.Capacitor;
  return {
    secureContext: input.isSecureContext,
    cameraSupported: Boolean(input.navigator.mediaDevices?.getUserMedia),
    microphoneSupported: Boolean(input.navigator.mediaDevices?.getUserMedia),
    fullscreenSupported: Boolean(input.document.fullscreenEnabled),
    android: /Android/i.test(input.navigator.userAgent),
    capacitorNative: Boolean(capacitor?.isNativePlatform?.()),
  };
}

export function getCompatibilitySummary(value: DeviceCompatibility) {
  const missing = [!value.secureContext && "HTTPS secure context", !value.cameraSupported && "camera API", !value.microphoneSupported && "microphone API", !value.fullscreenSupported && "fullscreen API"].filter(Boolean) as string[];
  return { ready: missing.length === 0, missing };
}
