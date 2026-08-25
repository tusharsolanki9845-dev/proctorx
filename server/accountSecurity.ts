import { createHash, randomBytes } from "node:crypto";

export type AccountTokenPurpose = "verify_email" | "reset_password";

export function createAccountTokenValue() {
  return randomBytes(32).toString("base64url");
}

export function hashAccountToken(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function getTokenExpiry(purpose: AccountTokenPurpose, now = new Date()) {
  const minutes = purpose === "verify_email" ? 24 * 60 : 60;
  return new Date(now.getTime() + minutes * 60_000);
}

export function isUsableAccountToken(input: { expiresAt: Date; consumedAt: Date | null }, now = new Date()) {
  return !input.consumedAt && input.expiresAt > now;
}

export function didConsumeTokenExactlyOnce(affectedRows: number) {
  return affectedRows === 1;
}

export function getAffectedRowCount(result: unknown): number {
  if (Array.isArray(result)) return getAffectedRowCount(result[0]);
  if (typeof result === "object" && result && "affectedRows" in result) {
    const value = (result as { affectedRows?: unknown }).affectedRows;
    return typeof value === "number" ? value : 0;
  }
  return 0;
}
