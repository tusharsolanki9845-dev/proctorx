export type FocusLossPolicyState = { armed: boolean; reported: boolean };

export function armFocusLossPolicyIfReady(
  state: FocusLossPolicyState,
  requirements: { strictFocusPolicyEnabled: boolean; deviceCheckSucceeded: boolean; fullscreenActive: boolean; pageVisible: boolean }
) {
  state.reported = false;
  state.armed = requirements.strictFocusPolicyEnabled && requirements.deviceCheckSucceeded && requirements.fullscreenActive && requirements.pageVisible;
  return state.armed;
}

/**
 * Converts raw browser events into at most one integrity signal after strict
 * enforcement is armed. A fullscreen transition while the page is unfocused is
 * classified as focus loss rather than a second independent violation.
 */
export function getBrowserIntegritySignal(
  state: FocusLossPolicyState,
  strictFocusPolicyEnabled: boolean,
  input: { type: "blur" | "visibility_hidden" | "fullscreen_change"; fullscreenActive: boolean; pageFocused: boolean }
) {
  if (!strictFocusPolicyEnabled || !state.armed || state.reported) return null;
  if (input.type === "blur" || input.type === "visibility_hidden") {
    state.reported = true;
    return "tab_hidden" as const;
  }
  if (!input.fullscreenActive) {
    state.reported = true;
    return input.pageFocused ? "fullscreen_exit" as const : "tab_hidden" as const;
  }
  return null;
}

/**
 * Reports one focus-loss event only after the device-consent flow has armed a
 * strict policy. This avoids treating permission and fullscreen setup as a
 * candidate focus-loss event.
 */
export function reportFocusLossIfArmed(
  state: FocusLossPolicyState,
  strictFocusPolicyEnabled: boolean,
  report: () => void
) {
  if (!strictFocusPolicyEnabled || !state.armed || state.reported) return false;
  state.reported = true;
  report();
  return true;
}
