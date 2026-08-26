import { useEffect, useState } from "react";

export type MicrophonePermissionStatus = "not_requested" | "granted" | "blocked" | "unsupported";

export function useMicrophonePermissionStatus() {
  const [status, setStatus] = useState<MicrophonePermissionStatus>(() => !navigator.mediaDevices?.getUserMedia ? "unsupported" : "not_requested");

  useEffect(() => {
    let permission: PermissionStatus | null = null;
    let active = true;
    if (!navigator.mediaDevices?.getUserMedia || !navigator.permissions?.query) return;
    void navigator.permissions.query({ name: "microphone" as PermissionName }).then(result => {
      if (!active) return;
      permission = result;
      const refresh = () => setStatus(result.state === "granted" ? "granted" : result.state === "denied" ? "blocked" : "not_requested");
      refresh();
      result.addEventListener("change", refresh);
    }).catch(() => undefined);
    return () => { active = false; permission?.onchange && (permission.onchange = null); };
  }, []);

  return status;
}
