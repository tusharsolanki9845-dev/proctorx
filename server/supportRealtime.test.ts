import { describe, expect, it, vi } from "vitest";
import { notifyAdministrators, notifySupportConversation, registerAdminNotificationEmitter, registerSupportRealtimeEmitter } from "./supportRealtime";

describe("real-time notification emitters", () => {
  it("emits updates for the affected support conversation and administrator feed", () => {
    const support = vi.fn(); const admin = vi.fn();
    registerSupportRealtimeEmitter(support); registerAdminNotificationEmitter(admin);
    notifySupportConversation(42); notifyAdministrators();
    expect(support).toHaveBeenCalledWith(42); expect(admin).toHaveBeenCalledOnce();
  });
});
