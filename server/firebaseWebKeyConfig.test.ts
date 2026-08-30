import { describe, expect, it } from "vitest";

describe("configured Firebase Web API key", () => {
  it("is accepted by the non-mutating Identity Toolkit endpoint", async () => {
    const apiKey = process.env.FIREBASE_WEB_API_KEY?.trim();
    expect(apiKey).toBeTruthy();

    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey!)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: "validation-only-invalid-token" }),
    });
    const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;

    expect(body?.error?.message).not.toBe("API_KEY_INVALID");
  }, 15000);
});
