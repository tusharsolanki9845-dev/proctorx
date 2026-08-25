import { parse } from "cookie";
import type { Request, Response } from "express";
import { jwtVerify, SignJWT } from "jose";
import { getSessionCookieOptions } from "./_core/cookies";

export const LOCAL_SESSION_COOKIE = "proctorx_local_session";
const SESSION_LIFETIME_SECONDS = 60 * 60 * 12;

function getSecret() {
  const source = process.env.JWT_SECRET;
  if (!source) throw new Error("Local credential sessions are unavailable because the session secret is missing.");
  return new TextEncoder().encode(source);
}

export async function issueLocalSession(req: Request, res: Response, userId: number) {
  const token = await new SignJWT({ authType: "local" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(userId))
    .setIssuedAt()
    .setExpirationTime(`${SESSION_LIFETIME_SECONDS}s`)
    .sign(getSecret());
  res.cookie(LOCAL_SESSION_COOKIE, token, { ...getSessionCookieOptions(req), maxAge: SESSION_LIFETIME_SECONDS * 1000 });
}

export async function getLocalSessionUserId(req: Request) {
  const token = parse(req.headers.cookie ?? "")[LOCAL_SESSION_COOKIE];
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });
    if (payload.authType !== "local" || !payload.sub || !/^\d+$/.test(payload.sub)) return null;
    return Number(payload.sub);
  } catch {
    return null;
  }
}

export function clearLocalSession(req: Request, res: Response) {
  res.clearCookie(LOCAL_SESSION_COOKIE, { ...getSessionCookieOptions(req), maxAge: -1 });
}
