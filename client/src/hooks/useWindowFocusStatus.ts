import { useEffect, useState } from "react";

export type WindowFocusStatus = "active" | "focus_lost" | "backgrounded";

export function readWindowFocusStatus(documentState: Pick<Document, "hidden" | "hasFocus">): WindowFocusStatus {
  if (documentState.hidden) return "backgrounded";
  return documentState.hasFocus() ? "active" : "focus_lost";
}

export function useWindowFocusStatus() {
  const [status, setStatus] = useState<WindowFocusStatus>(() => typeof document === "undefined" ? "active" : readWindowFocusStatus(document));

  useEffect(() => {
    const refresh = () => setStatus(readWindowFocusStatus(document));
    refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("blur", refresh);
    window.addEventListener("pageshow", refresh);
    window.addEventListener("pagehide", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("blur", refresh);
      window.removeEventListener("pageshow", refresh);
      window.removeEventListener("pagehide", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  return status;
}
