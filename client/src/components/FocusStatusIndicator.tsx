import { MonitorCheck, MonitorOff, MonitorPause } from "lucide-react";
import { useWindowFocusStatus } from "@/hooks/useWindowFocusStatus";

const presentation = {
  active: { label: "Focus active", detail: "This browser window is in the foreground.", icon: MonitorCheck, className: "border-cyan-300/35 bg-cyan-300/10 text-cyan-100" },
  focus_lost: { label: "Focus lost", detail: "This browser window is visible but not focused.", icon: MonitorOff, className: "border-pink-400/40 bg-pink-400/10 text-pink-100" },
  backgrounded: { label: "Backgrounded", detail: "This browser tab or app is not visible.", icon: MonitorPause, className: "border-pink-400/40 bg-pink-400/10 text-pink-100" },
} as const;

export function FocusStatusIndicator({ compact = false }: { compact?: boolean }) {
  const status = useWindowFocusStatus();
  const item = presentation[status];
  const Icon = item.icon;
  return <div className={`border px-3 py-2 ${item.className}`} role="status" aria-live="polite" title={item.detail}><div className="flex items-center gap-2"><Icon className="h-4 w-4" /><div><p className="tech-label text-[0.52rem]">Browser focus</p><p className="mt-0.5 text-xs font-medium">{item.label}</p>{!compact && <p className="mt-1 max-w-56 text-[0.65rem] leading-4 text-current/75">{item.detail}</p>}</div></div></div>;
}
