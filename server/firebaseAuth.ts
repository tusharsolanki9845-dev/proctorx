import { getFirebaseAuth, isFirebaseAdminConfigured } from "./firebaseAdmin";

const FIREBASE_WEB_API_KEY_ENV = "FIREBASE_WEB_API_KEY";
const IDENTITY_TOOLKIT_URL = "https://identitytoolkit.googleapis.com/v1/accounts";

type FirebaseSignInResponse = {
  idToken?: string;
  localId?: string;
  email?: string;
};

export class FirebaseAuthConfigurationError extends Error {}
export class FirebaseAuthCredentialsError extends Error {}

function getFirebaseWebApiKey() {
  const key = process.env[FIREBASE_WEB_API_KEY_ENV]?.trim();
  if (!key) throw new FirebaseAuthConfigurationError(`${FIREBASE_WEB_API_KEY_ENV} is required for Firebase Email/Password authentication.`);
  return key;
}

function approvedContinueUrl(requestedOrigin: string) {
  const configuredOrigin = process.env.PROCTORX_PUBLIC_ORIGIN?.trim();
  const origin = configuredOrigin || requestedOrigin;
  const parsed = new URL(origin);
  if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") throw new FirebaseAuthConfigurationError("A secure public ProctorX origin is required for Firebase email actions.");
  if (configuredOrigin && parsed.origin !== configuredOrigin.replace(/\/$/, "")) throw new FirebaseAuthConfigurationError("The requested email-action origin is not approved.");
  return `${parsed.origin}/signin`;
}

async function requestIdentityToolkit<T>(action: string, payload: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${IDENTITY_TOOLKIT_URL}:${action}?key=${encodeURIComponent(getFirebaseWebApiKey())}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (response.ok) return response.json() as Promise<T>;
  const detail = await response.json().catch(() => null) as { error?: { message?: string } } | null;
  const code = detail?.error?.message ?? "UNKNOWN";
  if (["EMAIL_NOT_FOUND", "INVALID_PASSWORD", "INVALID_LOGIN_CREDENTIALS", "INVALID_EMAIL"].some(value => code.includes(value))) {
    throw new FirebaseAuthCredentialsError("Email or password is incorrect.");
  }
  throw new Error(`Firebase Authentication request failed (${code}).`);
}

export function isFirebaseEmailPasswordAuthenticationConfigured() {
  return isFirebaseAdminConfigured() && Boolean(process.env[FIREBASE_WEB_API_KEY_ENV]?.trim()) && !process.env.DATABASE_URL;
}

export async function createFirebaseEmailPasswordUser(input: { email: string; password: string; displayName: string }) {
  try {
    const user = await getFirebaseAuth().createUser({ email: input.email, password: input.password, displayName: input.displayName, emailVerified: false });
    return { uid: user.uid, email: user.email ?? input.email };
  } catch (error: unknown) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (code.includes("email-already-exists")) throw new FirebaseAuthCredentialsError("An account already exists for this email address.");
    throw error;
  }
}

export async function deleteFirebaseEmailPasswordUser(uid: string) {
  await getFirebaseAuth().deleteUser(uid);
}

export async function authenticateFirebaseEmailPassword(input: { email: string; password: string }) {
  const session = await requestIdentityToolkit<FirebaseSignInResponse>("signInWithPassword", { email: input.email, password: input.password, returnSecureToken: true });
  if (!session.idToken || !session.localId) throw new Error("Firebase Authentication did not return a valid session.");
  const claims = await getFirebaseAuth().verifyIdToken(session.idToken);
  if (claims.uid !== session.localId) throw new Error("Firebase Authentication returned an inconsistent identity.");
  return { uid: claims.uid, email: session.email ?? input.email, emailVerified: Boolean(claims.email_verified), idToken: session.idToken };
}

export async function sendFirebaseVerificationEmail(idToken: string, origin: string) {
  await requestIdentityToolkit("sendOobCode", { requestType: "VERIFY_EMAIL", idToken, continueUrl: approvedContinueUrl(origin) });
  return { mode: "sent" as const };
}

export async function resendFirebaseVerificationEmail(email: string, origin: string) {
  let user: { uid: string; emailVerified?: boolean };
  try {
    user = await getFirebaseAuth().getUserByEmail(email);
  } catch (error: unknown) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (code.includes("user-not-found")) return { mode: "sent" as const };
    throw error;
  }
  if (user.emailVerified) return { mode: "sent" as const };
  const customToken = await getFirebaseAuth().createCustomToken(user.uid);
  const session = await requestIdentityToolkit<FirebaseSignInResponse>("signInWithCustomToken", { token: customToken, returnSecureToken: true });
  if (!session.idToken || !session.localId || session.localId !== user.uid) throw new Error("Firebase Authentication did not return a valid verification session.");
  const claims = await getFirebaseAuth().verifyIdToken(session.idToken);
  if (claims.uid !== user.uid) throw new Error("Firebase Authentication returned an inconsistent verification identity.");
  return sendFirebaseVerificationEmail(session.idToken, origin);
}

export async function sendFirebasePasswordResetEmail(email: string, origin: string) {
  try {
    await requestIdentityToolkit("sendOobCode", { requestType: "PASSWORD_RESET", email, continueUrl: approvedContinueUrl(origin) });
  } catch (error) {
    if (!(error instanceof FirebaseAuthCredentialsError)) throw error;
  }
  return { mode: "sent" as const };
}
