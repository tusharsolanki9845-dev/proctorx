// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const logEventMutate = vi.fn((_input: unknown, options?: { onSuccess?: (result: { shouldWarn: boolean; submitted: boolean }) => void }) => options?.onSuccess?.({ shouldWarn: false, submitted: false }));
const navigate = vi.fn();

vi.mock("@/lib/trpc", () => ({
  trpc: {
    proctorx: {
      student: {
        getAttempt: { useQuery: () => ({ isLoading: false, data: { attempt: { id: 1, status: "in_progress", startedAt: new Date("2026-08-25T10:00:00.000Z"), durationSeconds: 1800, endsAt: null, title: "Integration Exam", proctoringConfig: { faceAbsentThresholdSeconds: 3, multipleFaceThresholdSeconds: 3, immediateSubmitOnFocusLoss: true } }, questions: [{ id: 10, prompt: "Prompt", optionA: "A", optionB: "B", optionC: "C", optionD: "D", points: 1 }], answers: [] } }) },
        saveAnswer: { useMutation: () => ({ mutate: vi.fn() }) },
        submitAttempt: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      },
      proctoring: { logEvent: { useMutation: () => ({ mutate: logEventMutate }) } },
    },
  },
}));

vi.mock("@/hooks/useProctoring", async () => {
  const React = await import("react");
  return {
    useProctoring: () => {
      const [status, setStatus] = React.useState<"idle" | "monitoring">("idle");
      const start = React.useCallback(async () => { setStatus("monitoring"); return true; }, []);
      const stop = React.useCallback(() => undefined, []);
      return { videoRef: { current: null }, status, faceCount: 1, error: null, start, stop };
    },
  };
});

vi.mock("@/components/SupportChat", () => ({ SupportChat: () => null }));
vi.mock("wouter", () => ({ useLocation: () => ["", navigate], useRoute: () => [true, { attemptId: "1" }] }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), message: vi.fn() } }));

import ExamConsole from "./ExamConsole";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLDivElement | null = null;

function setDocumentState({ fullscreen, hidden, focused }: { fullscreen: boolean; hidden: boolean; focused: boolean }) {
  Object.defineProperty(document, "fullscreenElement", { configurable: true, value: fullscreen ? document.documentElement : null });
  Object.defineProperty(document, "hidden", { configurable: true, value: hidden });
  Object.defineProperty(document, "hasFocus", { configurable: true, value: vi.fn(() => focused) });
}

describe("ExamConsole browser-event integration", () => {
  afterEach(() => {
    act(() => { root?.unmount(); });
    host?.remove();
    root = null;
    host = null;
    logEventMutate.mockClear();
    navigate.mockClear();
    vi.useRealTimers();
  });

  it("does not signal during setup and emits only one tab-hidden signal after readiness when browser focus leaves", async () => {
    vi.useFakeTimers();
    setDocumentState({ fullscreen: false, hidden: false, focused: true });
    Object.defineProperty(document.documentElement, "requestFullscreen", {
      configurable: true,
      value: vi.fn(async () => {
        setDocumentState({ fullscreen: true, hidden: false, focused: true });
        document.dispatchEvent(new Event("fullscreenchange"));
      }),
    });
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);

    await act(async () => { root?.render(<ExamConsole />); });

    await act(async () => {
      window.dispatchEvent(new Event("blur"));
      document.dispatchEvent(new Event("fullscreenchange"));
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(logEventMutate).not.toHaveBeenCalled();

    const deviceCheck = Array.from(host.querySelectorAll("button")).find(button => button.textContent?.includes("Begin device check"));
    expect(deviceCheck).toBeTruthy();
    await act(async () => { deviceCheck?.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
    await act(async () => { vi.advanceTimersByTime(800); });

    setDocumentState({ fullscreen: true, hidden: false, focused: false });
    await act(async () => { window.dispatchEvent(new Event("blur")); });
    expect(logEventMutate).toHaveBeenCalledTimes(1);
    expect(logEventMutate.mock.calls[0]?.[0]).toMatchObject({ attemptId: 1, eventType: "tab_hidden" });

    setDocumentState({ fullscreen: false, hidden: true, focused: false });
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      document.dispatchEvent(new Event("fullscreenchange"));
    });
    expect(logEventMutate).toHaveBeenCalledTimes(1);
  });
});
