import { afterEach, describe, expect, it, vi } from "vitest";
import { deliverAccountLink } from "./transactionalEmail";

const originalEnvironment = { nodeEnv: process.env.NODE_ENV, apiKey: process.env.RESEND_API_KEY, from: process.env.RESEND_FROM_EMAIL };

afterEach(() => {
  process.env.NODE_ENV = originalEnvironment.nodeEnv;
  if (originalEnvironment.apiKey === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = originalEnvironment.apiKey;
  if (originalEnvironment.from === undefined) delete process.env.RESEND_FROM_EMAIL; else process.env.RESEND_FROM_EMAIL = originalEnvironment.from;
});

describe("transactional email fallback", () => {
  it("returns a development preview without exposing a production fallback link", async () => {
    delete process.env.RESEND_API_KEY; delete process.env.RESEND_FROM_EMAIL; process.env.NODE_ENV = "development";
    const preview = await deliverAccountLink({ to: "student@example.com", subject: "Verify", heading: "Verify", description: "Confirm", link: "https://example.test/verify-email?token=test" });
    expect(preview).toEqual({ mode: "preview", previewUrl: "https://example.test/verify-email?token=test" });
    process.env.NODE_ENV = "production";
    const production = await deliverAccountLink({ to: "student@example.com", subject: "Verify", heading: "Verify", description: "Confirm", link: "https://example.test/verify-email?token=test" });
    expect(production).toEqual({ mode: "configuration_required" });
  });
});
