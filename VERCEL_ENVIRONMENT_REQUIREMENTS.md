# ProctorX Vercel Environment Requirements

**Purpose.** This document lists the configuration boundary required before ProctorX can be published as a functioning Vercel deployment. It intentionally contains **variable names and setup guidance only**. Do not paste credentials, session secrets, database URLs, or service keys into this repository, a ticket, or browser-visible `VITE_*` variables.

ProctorX is a full-stack application rather than a static site: its candidate sessions, exam data, reports, support messages, and audit events require server-side configuration. The Vercel function is exposed under `/api/*`, while the browser app is built into `dist/public`. The SPA fallback must not be used as a substitute for a functioning API.

| Variable | Scope | Required for | Handling |
|---|---|---|---|
| `DATABASE_URL` | Server only | Exam data, identities, attempts, reports, support, and audit records | Add as an encrypted Vercel environment variable for Production and Preview only if Preview is meant to use an isolated non-production database. |
| `JWT_SECRET` | Server only | Signed local session cookies | Generate and store a high-entropy secret in Vercel. It must remain stable per environment; rotating it signs users out. |
| `ADMIN_LOGIN_ID` | Server only | Configured administrator credential sign-in | Store only in Vercel’s encrypted environment settings. |
| `ADMIN_LOGIN_PASSWORD` | Server only | Configured administrator credential sign-in | Store only in Vercel’s encrypted environment settings. |
| `VITE_APP_ID` | Browser build and server | Existing OAuth integration | This is embedded in the browser build; it is an application identifier, not a server secret. |
| `VITE_OAUTH_PORTAL_URL` | Browser build | Existing OAuth sign-in redirect | Must allow the eventual Vercel production callback origin. |
| `OAUTH_SERVER_URL` | Server only | Existing OAuth callback and session exchange | Must allow the eventual Vercel production callback URL. |
| `OWNER_OPEN_ID` | Server only | Owner-aware platform operations | Add only if those platform operations remain enabled in production. |
| `BUILT_IN_FORGE_API_URL` | Server only | Built-in platform storage, notifications, and optional platform services | These Manus-scoped credentials are not assumed to be portable to Vercel. Configure a production-compatible alternative or disable/rework dependent features before release. |
| `BUILT_IN_FORGE_API_KEY` | Server only | Built-in platform storage, notifications, and optional platform services | Never expose this value to the browser or copy it from the managed development environment. |

The frontend currently reads `VITE_APP_ID` and `VITE_OAUTH_PORTAL_URL` at build time. Any variable beginning with `VITE_` is public to browser users after compilation, so it must never contain a database URL, password, session secret, service token, or administrator credential.

## Required release decisions

Before a production deployment, create a Vercel project and set the variables above in the project’s **Production** environment. Preview deployments must not connect to the production database unless that risk is deliberately accepted. If OAuth is retained, register the exact production callback URL:

```text
https://<production-domain>/api/oauth/callback
```

The Vercel project needs the same database schema as the validated application. Schema changes must continue to be applied through the controlled migration workflow, not by relying on a build-time side effect. The production database must be reachable from Vercel over TLS and restricted to the minimum necessary network access.

## Android distribution boundary

The Downloads page is deliberately web-first. It directs desktop, Chromebook, and supported mobile users to the secure web app or browser-managed PWA installation. Its Android APK control remains disabled until all of the following conditions are met: a stable production HTTPS domain exists; the Capacitor wrapper is synchronized against that domain; physical-device camera and microphone consent flows are tested; and the user supplies a signing key for a release build. No placeholder or debug APK may be published.

## Verification sequence

After environment setup, deploy a **Preview** build first and verify public page rendering plus `/api/trpc/auth.me` behavior. After OAuth redirect, local credential sign-in, database-backed exam access, report export, support polling, and administrator notification polling are verified with an authorized test account, promote or create a Production deployment. Review Vercel build and runtime logs for API errors before changing `PROCTORX_ANDROID_SERVER_URL` or preparing an Android release.

## References

[1] [Vercel, “Rewrites”](https://vercel.com/docs/rewrites)

[2] [Vercel, “Project configuration: vercel.json”](https://vercel.com/docs/project-configuration/vercel-json)
