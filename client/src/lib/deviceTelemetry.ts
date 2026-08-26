export type MicrophoneActivityState = "inactive" | "checking" | "monitoring" | "signal_detected" | "blocked" | "unavailable";

export type LocalDeviceTelemetry = {
  microphone: MicrophoneActivityState;
  updatedAt: number;
};

const KEY = "proctorx.local-device-telemetry";
const EVENT = "proctorx:device-telemetry";

export function readLocalDeviceTelemetry(): LocalDeviceTelemetry {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { microphone: "inactive", updatedAt: 0 };
    const value = JSON.parse(raw) as Partial<LocalDeviceTelemetry>;
    return typeof value.updatedAt === "number" && typeof value.microphone === "string" ? value as LocalDeviceTelemetry : { microphone: "inactive", updatedAt: 0 };
  } catch {
    return { microphone: "inactive", updatedAt: 0 };
  }
}

export function publishLocalDeviceTelemetry(microphone: MicrophoneActivityState) {
  const next: LocalDeviceTelemetry = { microphone, updatedAt: Date.now() };
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* Device-state display remains local and best effort. */ }
  window.dispatchEvent(new CustomEvent<LocalDeviceTelemetry>(EVENT, { detail: next }));
}

export function subscribeLocalDeviceTelemetry(listener: (value: LocalDeviceTelemetry) => void) {
  const localListener = (event: Event) => listener((event as CustomEvent<LocalDeviceTelemetry>).detail);
  const storageListener = (event: StorageEvent) => { if (event.key === KEY) listener(readLocalDeviceTelemetry()); };
  window.addEventListener(EVENT, localListener);
  window.addEventListener("storage", storageListener);
  return () => { window.removeEventListener(EVENT, localListener); window.removeEventListener("storage", storageListener); };
}
