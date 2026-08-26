import { Mic, MicOff, MicVocal } from "lucide-react";
import { useMicrophonePermissionStatus } from "@/hooks/useMicrophonePermissionStatus";
import { useLocalDeviceTelemetry } from "@/hooks/useLocalDeviceTelemetry";

const presentation = {
  granted: { label: "Permission granted", detail: "No microphone stream is active on this dashboard.", icon: MicVocal, className: "border-cyan-300/35 bg-cyan-300/10 text-cyan-100" },
  not_requested: { label: "Not requested", detail: "Permission is requested only from the device check.", icon: Mic, className: "border-cyan-200/20 bg-black/10 text-muted-foreground" },
  blocked: { label: "Permission blocked", detail: "Enable microphone permission in browser settings before a device check.", icon: MicOff, className: "border-pink-400/40 bg-pink-400/10 text-pink-100" },
  unsupported: { label: "Unavailable", detail: "This browser does not support microphone permission checks.", icon: MicOff, className: "border-pink-400/40 bg-pink-400/10 text-pink-100" },
} as const;

export function MicrophoneStatusIndicator() {
  const status = useMicrophonePermissionStatus();
  const telemetry = useLocalDeviceTelemetry();
  const activityPresentation = telemetry.microphone === "monitoring" ? { label: "Local monitoring active", detail: "Only a local sound level is analyzed; no audio or voice data is retained." } : telemetry.microphone === "checking" ? { label: "Local check active", detail: "The candidate is confirming microphone level locally." } : telemetry.microphone === "signal_detected" ? { label: "Local signal detected", detail: "A coarse local level was detected; no sound content is exposed." } : null;
  const item = presentation[status];
  const Icon = item.icon;
  return <div className={`border px-3 py-2 ${item.className}`} role="status" aria-live="polite"><div className="flex items-center gap-2"><Icon className="h-4 w-4" /><div><p className="tech-label text-[0.52rem]">Microphone</p><p className="mt-0.5 text-xs font-medium">{activityPresentation?.label ?? item.label}</p><p className="mt-1 max-w-56 text-[0.65rem] leading-4 text-current/75">{activityPresentation?.detail ?? item.detail}</p></div></div></div>;
}
