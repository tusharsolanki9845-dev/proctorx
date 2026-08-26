import { cert, getApps, initializeApp, type App, type ServiceAccount } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const FIREBASE_SERVICE_ACCOUNT_ENV = "FIREBASE_SERVICE_ACCOUNT_JSON";

type FirebaseServiceAccount = ServiceAccount & {
  project_id?: string;
  private_key?: string;
  client_email?: string;
};

let firebaseApp: App | null = null;

/**
 * Parses the server-only Firebase Admin credential. The value must be an entire
 * service-account JSON object stored as an encrypted environment variable.
 */
export function parseFirebaseServiceAccount(raw: string | undefined): ServiceAccount | null {
  if (!raw?.trim()) return null;

  let parsed: FirebaseServiceAccount;
  try {
    parsed = JSON.parse(raw) as FirebaseServiceAccount;
  } catch {
    throw new Error(`${FIREBASE_SERVICE_ACCOUNT_ENV} must contain valid JSON.`);
  }

  if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
    throw new Error(`${FIREBASE_SERVICE_ACCOUNT_ENV} is missing required service-account fields.`);
  }

  return {
    projectId: parsed.project_id,
    clientEmail: parsed.client_email,
    privateKey: parsed.private_key.replace(/\\n/g, "\n"),
  };
}

export function isFirebaseAdminConfigured(raw = process.env[FIREBASE_SERVICE_ACCOUNT_ENV]) {
  return Boolean(raw?.trim());
}

export function getFirebaseAdminApp() {
  if (firebaseApp) return firebaseApp;

  const serviceAccount = parseFirebaseServiceAccount(process.env[FIREBASE_SERVICE_ACCOUNT_ENV]);
  if (!serviceAccount) {
    throw new Error(`${FIREBASE_SERVICE_ACCOUNT_ENV} is required for Firebase-backed production persistence.`);
  }

  firebaseApp = getApps()[0] ?? initializeApp({ credential: cert(serviceAccount) });
  return firebaseApp;
}

export function getFirebaseFirestore() {
  return getFirestore(getFirebaseAdminApp());
}

export function getFirebaseAuth() {
  return getAuth(getFirebaseAdminApp());
}

/** Test-only reset for singleton state. */
export function __resetFirebaseAdminForTests() {
  firebaseApp = null;
}
