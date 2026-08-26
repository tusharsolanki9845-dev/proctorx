import { useCallback, useEffect, useRef, useState } from "react";
import { publishLocalDeviceTelemetry } from "@/lib/deviceTelemetry";

export type AudioMonitorStatus = "idle" | "requesting" | "checking" | "monitoring" | "blocked" | "unavailable";

type Options = {
  enabled: boolean;
  activityLevel: number;
  activityThresholdSeconds: number;
  onActivity: (durationMs: number, level: number) => void;
};

export function calculateAudioLevel(samples: Uint8Array) {
  if (!samples.length) return 0;
  let sum = 0;
  for (let index = 0; index < samples.length; index += 1) sum += Math.abs((samples[index] ?? 128) - 128);
  return Math.round((sum / samples.length) * 2);
}

export function useAudioActivityMonitor({ enabled, activityLevel, activityThresholdSeconds, onActivity }: Options) {
  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const timerRef = useRef<number | null>(null);
  const breachStartedAtRef = useRef<number | null>(null);
  const emittedRef = useRef(false);
  const [status, setStatus] = useState<AudioMonitorStatus>("idle");
  const [level, setLevel] = useState(0);
  const [hasLocalSignal, setHasLocalSignal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    void contextRef.current?.close();
    contextRef.current = null;
    analyserRef.current = null;
    breachStartedAtRef.current = null;
    emittedRef.current = false;
    setLevel(0);
    setHasLocalSignal(false);
    setStatus("idle");
    publishLocalDeviceTelemetry("inactive");
  }, []);

  const sample = useCallback((armed: boolean) => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const samples = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(samples);
    const nextLevel = calculateAudioLevel(samples);
    setLevel(nextLevel);
    if (nextLevel >= 4) { setHasLocalSignal(true); if (!armed) publishLocalDeviceTelemetry("signal_detected"); }
    if (!armed || !enabled) return;
    const now = performance.now();
    if (nextLevel >= activityLevel) {
      breachStartedAtRef.current ??= now;
      const durationMs = Math.round(now - breachStartedAtRef.current);
      if (durationMs >= activityThresholdSeconds * 1000 && !emittedRef.current) {
        emittedRef.current = true;
        onActivity(durationMs, nextLevel);
      }
    } else {
      breachStartedAtRef.current = null;
      emittedRef.current = false;
    }
  }, [activityLevel, activityThresholdSeconds, enabled, onActivity]);

  const startCheck = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) { setStatus("unavailable"); setError("Microphone access is not supported by this browser."); publishLocalDeviceTelemetry("unavailable"); return false; }
    setStatus("requesting"); setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { autoGainControl: true, echoCancellation: true, noiseSuppression: true }, video: false });
      const AudioContextConstructor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextConstructor) throw new Error("Audio analysis is not supported by this browser.");
      const context = new AudioContextConstructor();
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      context.createMediaStreamSource(stream).connect(analyser);
      streamRef.current = stream;
      contextRef.current = context;
      analyserRef.current = analyser;
      setStatus("checking");
      publishLocalDeviceTelemetry("checking");
      timerRef.current = window.setInterval(() => sample(false), 150);
      return true;
    } catch (caught) {
      stop();
      setStatus("blocked");
      setError(caught instanceof Error ? caught.message : "Microphone permission could not be granted.");
      publishLocalDeviceTelemetry("blocked");
      return false;
    }
  }, [sample, stop]);

  const activateMonitoring = useCallback(() => {
    if (!enabled || !analyserRef.current) return false;
    if (timerRef.current) window.clearInterval(timerRef.current);
    breachStartedAtRef.current = null;
    emittedRef.current = false;
    timerRef.current = window.setInterval(() => sample(true), 150);
    setStatus("monitoring");
    publishLocalDeviceTelemetry("monitoring");
    return true;
  }, [enabled, sample]);

  useEffect(() => () => stop(), [stop]);
  return { status, level, hasLocalSignal, error, startCheck, activateMonitoring, stop };
}
