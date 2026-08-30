# Vercel Production Environment Requirements

The Vercel deployment runs the ProctorX browser application from `dist/public` and routes `/api/*` to the bundled Express/tRPC serverless handler. Firebase remains the production persistence and authentication provider. Do not configure `DATABASE_URL` in Vercel production; its absence selects the Firebase Firestore adapter.

| Variable | Scope | Purpose |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Server only | Firebase Admin authentication for Firestore and Firebase Auth. |
| `FIREBASE_WEB_API_KEY` | Server only | Firebase Identity Toolkit requests for Email/Password actions. |
| `JWT_SECRET` | Server only | Signs the ProctorX HTTP-only session cookie. |
| `ADMIN_LOGIN_ID` | Server only | Configured administrator identifier. |
| `ADMIN_LOGIN_PASSWORD` | Server only | Configured administrator password. |
| `PROCTORX_PUBLIC_ORIGIN` | Server only | Canonical public Vercel HTTPS origin used to validate Firebase email-action continuations. |

Secrets must be entered as encrypted Vercel Production environment variables. Never commit secret values, upload service-account files, expose Firebase Admin credentials in client code, or add Firebase billing, Blaze, SQL Connect, Cloud SQL, or other paid Firebase services.

## Deployment checks

Run `pnpm test`, `pnpm check`, and `pnpm build:vercel` before deployment. After deployment, validate the public `system.health` procedure and a configured administrator session with `system.firebaseReadiness`. Candidate email verification, password reset, and assessment attempts require an explicitly approved test inbox.

The Android wrapper must not be repointed or published until the Vercel public deployment is operational, a consented physical-device matrix passes, and an owner-controlled signing key produces a signed release artifact.
