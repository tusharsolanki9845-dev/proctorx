import { describe, expect, it, vi } from "vitest";
import { armFocusLossPolicyIfReady, getBrowserIntegritySignal, reportFocusLossIfArmed } from "../client/src/lib/focusLossPolicy";

describe("strict focus-loss client policy", () => {
  it("does not report a browser focus change during device permission or fullscreen setup", () => {
    const report = vi.fn();
    const state = { armed: false, reported: false };

    expect(reportFocusLossIfArmed(state, true, report)).toBe(false);
    expect(report).not.toHaveBeenCalled();
  });

  it("arms strict enforcement only after device, fullscreen, and foreground readiness are all confirmed", () => {
    const state = { armed: false, reported: false };

    expect(armFocusLossPolicyIfReady(state, { strictFocusPolicyEnabled: true, deviceCheckSucceeded: true, fullscreenActive: false, pageVisible: true })).toBe(false);
    expect(armFocusLossPolicyIfReady(state, { strictFocusPolicyEnabled: true, deviceCheckSucceeded: true, fullscreenActive: true, pageVisible: false })).toBe(false);
    expect(armFocusLossPolicyIfReady(state, { strictFocusPolicyEnabled: true, deviceCheckSucceeded: true, fullscreenActive: true, pageVisible: true })).toBe(true);
  });

  it("maps the browser event wiring to one post-readiness signal and ignores setup-time events", () => {
    const state = { armed: false, reported: false };
    expect(getBrowserIntegritySignal(state, true, { type: "fullscreen_change", fullscreenActive: false, pageFocused: true })).toBeNull();

    state.armed = true;
    expect(getBrowserIntegritySignal(state, true, { type: "fullscreen_change", fullscreenActive: false, pageFocused: false })).toBe("tab_hidden");
    expect(getBrowserIntegritySignal(state, true, { type: "visibility_hidden", fullscreenActive: false, pageFocused: false })).toBeNull();
  });

  it("reports exactly one event once strict focus enforcement is armed", () => {
    const report = vi.fn();
    const state = { armed: true, reported: false };

    expect(reportFocusLossIfArmed(state, true, report)).toBe(true);
    expect(reportFocusLossIfArmed(state, true, report)).toBe(false);
    expect(report).toHaveBeenCalledTimes(1);
  });

  it("does not report focus loss when an assessment disables the strict policy", () => {
    const report = vi.fn();
    const state = { armed: true, reported: false };

    expect(reportFocusLossIfArmed(state, false, report)).toBe(false);
    expect(report).not.toHaveBeenCalled();
  });
});
