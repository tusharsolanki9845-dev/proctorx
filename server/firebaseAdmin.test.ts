import { describe, expect, it } from "vitest";
import { isFirebaseAdminConfigured, parseFirebaseServiceAccount } from "./firebaseAdmin";

describe("Firebase Admin credential boundary", () => {
  it("accepts a complete service-account JSON payload and restores escaped line breaks", () => {
    const account = parseFirebaseServiceAccount(
      JSON.stringify({
        project_id: "proctorx-production",
        client_email: "firebase-adminsdk@example.iam.gserviceaccount.com",
        private_key: "-----BEGIN PRIVATE KEY-----\\nexample\\n-----END PRIVATE KEY-----\\n",
      })
    );

    expect(account).toEqual({
      projectId: "proctorx-production",
      clientEmail: "firebase-adminsdk@example.iam.gserviceaccount.com",
      privateKey: "-----BEGIN PRIVATE KEY-----\nexample\n-----END PRIVATE KEY-----\n",
    });
  });

  it("does not consider an empty environment value configured", () => {
    expect(isFirebaseAdminConfigured(undefined)).toBe(false);
    expect(isFirebaseAdminConfigured("  ")).toBe(false);
  });

  it("rejects malformed and incomplete credential values", () => {
    expect(() => parseFirebaseServiceAccount("not-json")).toThrow("valid JSON");
    expect(() => parseFirebaseServiceAccount(JSON.stringify({ project_id: "proctorx-production" }))).toThrow("missing required");
  });
});
