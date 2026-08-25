import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

function equalSecret(value: string, configured: string) {
  const left = Buffer.from(value);
  const right = Buffer.from(configured);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, encoded: string) {
  const [algorithm, salt, hash] = encoded.split("$");
  if (algorithm !== "scrypt" || !salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64).toString("hex");
  return equalSecret(candidate, hash);
}

export function verifyConfiguredAdminCredentials(loginId: string, password: string) {
  const configuredId = process.env.ADMIN_LOGIN_ID ?? "";
  const configuredPassword = process.env.ADMIN_LOGIN_PASSWORD ?? "";
  if (!configuredId || !configuredPassword) return false;
  return equalSecret(loginId, configuredId) && equalSecret(password, configuredPassword);
}

export function getConfiguredAdminOpenId(loginId: string) {
  return `admin:${createHash("sha256").update(loginId).digest("hex").slice(0, 56)}`;
}
