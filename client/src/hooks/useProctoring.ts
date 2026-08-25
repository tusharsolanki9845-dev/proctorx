import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ProctoringEventType } from "../../../shared/proctoring";

type ProctoringStatus = "idle" | "requesting" | "monitoring" | "blocked" | "unavailable";

type UseProctoringOptions = {
  faceAbsentThresholdSeconds: number;
  multipleFaceThresholdSeconds: number;
  onSignal: (eventType: ProctoringEventType, durationMs: number) => void;
};

const WASM_ROOT = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const FACE_MODEL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task";

export function useProctoring({ faceAbsentThresholdSeconds, multipleFaceThresholdSeconds, onSignal }: UseProctoringOptions) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const frameRef = useRef<number | null>(null);
  const lastInferenceRef = useRef(0);
  const breachesRef = useRef(new Map<ProctoringEventType, number>());
  const emittedRef = useRef(new Set<ProctoringEventType>());
  const onSignalRef = useRef(onSignal);
  const [status, setStatus] = useState<ProctoringStatus>("idle");
  const [faceCount, setFaceCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { onSignalRef.current = onSignal; }, [onSignal]);

  const resetBreach = useCallback((eventType: ProctoringEventType) => {
    breachesRef.current.delete(eventType);
    emittedRef.current.delete(eventType);
  }, []);

  const registerBreach = useCallback((eventType: ProctoringEventType, thresholdSeconds: number) => {
    const now = performance.now();
    const startedAt = breachesRef.current.get(eventType) ?? now;
    breachesRef.current.set(eventType, startedAt);
    const durationMs = Math.round(now - startedAt);
    if (durationMs >= thresholdSeconds * 1000 && !emittedRef.current.has(eventType)) {
      emittedRef.current.add(eventType);
      onSignalRef.current(eventType, durationMs);
    }
  }, []);

  const stop = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    landmarkerRef.current?.close();
    landmarkerRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus("idle");
    setFaceCount(null);
  }, []);

  const start = useCallback(async (): Promise<boolean> => {
    if (!navigator.mediaDevices?.getUserMedia) { setStatus("unavailable"); setError("Camera access is not supported by this browser."); return false; }
    setStatus("requesting"); setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error("Camera preview is not available.");
      video.srcObject = stream;
      await video.play();
      stream.getVideoTracks().forEach(track => track.addEventListener("ended", () => onSignalRef.current("camera_interrupted", 0), { once: true }));
      const vision = await FilesetResolver.forVisionTasks(WASM_ROOT);
      landmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: FACE_MODEL },
        runningMode: "VIDEO",
        numFaces: 2,
        minFaceDetectionConfidence: 0.55,
        minFacePresenceConfidence: 0.55,
        minTrackingConfidence: 0.5,
      });
      setStatus("monitoring");
      const detect = (timestamp: number) => {
        if (!landmarkerRef.current || !videoRef.current || videoRef.current.readyState < 2) { frameRef.current = requestAnimationFrame(detect); return; }
        if (timestamp - lastInferenceRef.current > 180) {
          lastInferenceRef.current = timestamp;
          const result = landmarkerRef.current.detectForVideo(videoRef.current, timestamp);
          const count = result.faceLandmarks?.length ?? 0;
          setFaceCount(count);
          if (count === 0) registerBreach("face_absent", faceAbsentThresholdSeconds); else resetBreach("face_absent");
          if (count > 1) registerBreach("multiple_faces", multipleFaceThresholdSeconds); else resetBreach("multiple_faces");
        }
        frameRef.current = requestAnimationFrame(detect);
      };
      frameRef.current = requestAnimationFrame(detect);
      return true;
    } catch (caught) {
      stop();
      setStatus("blocked");
      setError(caught instanceof Error ? caught.message : "Camera permission could not be granted.");
      return false;
    }
  }, [faceAbsentThresholdSeconds, multipleFaceThresholdSeconds, registerBreach, resetBreach, stop]);

  useEffect(() => () => stop(), [stop]);
  return { videoRef, status, faceCount, error, start, stop };
}
