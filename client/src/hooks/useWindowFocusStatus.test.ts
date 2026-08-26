import { describe, expect, it } from "vitest";
import { readWindowFocusStatus } from "./useWindowFocusStatus";

describe("readWindowFocusStatus", () => {
  it("classifies active, visible-but-unfocused, and backgrounded browser states without recording history", () => {
    expect(readWindowFocusStatus({ hidden: false, hasFocus: () => true })).toBe("active");
    expect(readWindowFocusStatus({ hidden: false, hasFocus: () => false })).toBe("focus_lost");
    expect(readWindowFocusStatus({ hidden: true, hasFocus: () => true })).toBe("backgrounded");
  });
});
