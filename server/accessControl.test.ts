import { describe, expect, it } from "vitest";
import { canAccessAttemptReport, canSendSupportMessage } from "../shared/accessControl";

describe("support and report authorization", () => {
  it("allows a student to send support messages only for an active attempt they own", () => {
    expect(canSendSupportMessage({ requesterUserId: 4, attemptOwnerUserId: 4, attemptStatus: "in_progress", senderRole: "student" })).toBe(true);
    expect(canSendSupportMessage({ requesterUserId: 4, attemptOwnerUserId: 5, attemptStatus: "in_progress", senderRole: "student" })).toBe(false);
    expect(canSendSupportMessage({ requesterUserId: 4, attemptOwnerUserId: 4, attemptStatus: "submitted", senderRole: "student" })).toBe(false);
  });

  it("isolates attempt reports to their owner or an administrator", () => {
    expect(canAccessAttemptReport({ requesterUserId: 4, attemptOwnerUserId: 4, isAdmin: false })).toBe(true);
    expect(canAccessAttemptReport({ requesterUserId: 4, attemptOwnerUserId: 5, isAdmin: false })).toBe(false);
    expect(canAccessAttemptReport({ requesterUserId: 4, attemptOwnerUserId: 5, isAdmin: true })).toBe(true);
  });
});
