import { ShieldCheck, TriangleAlert } from "lucide-react";
import { detectDeviceCompatibility, getCompatibilitySummary } from "@/lib/deviceCompatibility";

export function DeviceCompatibilityIndicator() {
  const compatibility = detectDeviceCompatibility({ isSecureContext: window.isSecureContext, Capacitor: (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor, navigator, document });
  const summary = getCompatibilitySummary(compatibility);
  return <div className={`border px-3 py-2 ${summary.ready ? "border-cyan-300/35 bg-cyan-300/10 text-cyan-100" : "border-pink-400/40 bg-pink-400/10 text-pink-100"}`}><div className="flex items-center gap-2">{summary.ready ? <ShieldCheck className="h-4 w-4" /> : <TriangleAlert className="h-4 w-4" />}<div><p className="tech-label text-[0.52rem]">Device compatibility</p><p className="mt-0.5 text-xs font-medium">{summary.ready ? `${compatibility.capacitorNative ? "Android wrapper" : compatibility.android ? "Android browser" : "Browser"} ready` : "Needs attention"}</p><p className="mt-1 max-w-56 text-[0.65rem] leading-4 text-current/75">{summary.ready ? "Camera, microphone, secure context, and fullscreen checks are available." : `Missing: ${summary.missing.join(", ")}`}</p></div></div></div>;
}
