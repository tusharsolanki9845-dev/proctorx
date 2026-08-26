# Netlify Production Environment Requirements

## Purpose

This document records the required production configuration for the **Netlify-hosted** ProctorX application. It deliberately contains variable names and operational boundaries only. Values, Firebase private keys, passwords, and generated session secrets must never be committed to Git or embedded into this document.

## Build and routing configuration

Netlify must build the repository with `pnpm build:netlify`, publish `dist/public`, and deploy the `netlify/functions` directory. The `api` function owns `/api/*`; the SPA fallback must serve only routes that are not handled by that function. The configuration is committed in `netlify.toml`.

| Setting | Required value | Reason |
|---|---|---|
| Build command | `pnpm build:netlify` | Builds the Vite client application. |
| Publish directory | `dist/public` | Matches the existing Vite output. |
| Functions directory | `netlify/functions` | Keeps server-only source outside the published client assets. |
| Node runtime | `22` | Matches the validated development and Firebase Admin runtime. |
| Function path | `/api/*` | Preserves the existing tRPC browser contract without a client-side endpoint change. |

## Required production secrets

Set these values in the **Netlify user interface or CLI**, with availability for production functions. Do not define their values in `netlify.toml`; Netlify does not expose configuration-file environment variables to runtime functions.

| Variable | Required | Handling |
|---|---:|---|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Yes | Store the complete Firebase Admin service-account JSON as a masked secret. It is used only inside the Netlify Function. |
| `JWT_SECRET` | Yes | Use a high-entropy, server-generated secret for ProctorX signed sessions. Do not reuse the Firebase credential or an application password. |
| `ADMIN_LOGIN_ID` | Yes for configured administrator sign-in | Store the administrator’s chosen login identifier as a restricted production variable. |
| `ADMIN_LOGIN_PASSWORD` | Yes for configured administrator sign-in | Store only a high-entropy administrator password. Do not disclose it in logs, source, or deployment settings screenshots. |

The legacy `DATABASE_URL` must remain absent in Netlify production so the existing data-layer selector uses Firestore. Manus-specific Forge and OAuth variables are intentionally not copied into Netlify; the Netlify deployment must not depend on Manus credentials.

## Firebase and privacy boundary

The deployed function accesses Firebase through the Admin SDK only. Firestore client rules remain deny-all, browser code receives no Firebase Admin credentials, and direct browser access to exam, credential, report, support, or integrity data remains blocked. Camera and microphone processing remains local to the candidate’s device; ProctorX does not add continuous media storage, voiceprints, transcription, or speaker identification as part of this move.

## No-cost and release constraints

Netlify’s current free plan has a hard monthly credit limit. When the limit is exhausted, all projects on the account are paused. For this reason, the free plan is suitable only for controlled rollout and must be monitored during nationwide examination use. Netlify’s self-service function regions do not include India; the closest available region is Singapore, while Firestore remains in Mumbai. No billing upgrade, auto-recharge, Blaze plan, Firebase SQL Connect, Cloud SQL, or paid add-on is authorized by this configuration.[1] [2]

The Android wrapper must not be released from the Downloads page until the Netlify host is stable, the production API has been validated with consented device testing, and a user-owned Android signing key produces a signed release APK.

## References

[1]: https://docs.netlify.com/build/functions/configuration/ "Netlify Functions configuration"
[2]: https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/ "Netlify credit-based plans"
