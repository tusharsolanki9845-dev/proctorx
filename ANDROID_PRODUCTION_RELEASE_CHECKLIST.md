# ProctorX Android Production Release Checklist

## Current status

The Capacitor Android project is synchronized against the public Netlify host **`https://proctorx-assessment.netlify.app`**. The Android project declares camera and microphone permissions, the wrapper host was regenerated on 27 August 2026, and the Netlify server-side Firebase readiness boundary has been validated. The wrapper is **not** ready for candidate distribution or APK publication.

| Release gate | Status | Owner |
|---|---|---|
| Public Netlify HTTPS host | Complete | ProctorX project |
| Server-only Firebase, session, and administrator configuration | Complete | ProctorX project |
| Capacitor sync against `https://proctorx-assessment.netlify.app` | Complete | Development workflow |
| Consented candidate/exam workflow validation | Pending | Consenting tester and project owner |
| Physical Android permission and recovery matrix | Pending | Consenting Android tester |
| User-owned Android signing key | Required | Project owner |
| Signed release APK and post-install smoke check | Pending | Development workflow |

## Required sequence

Use only the stable public Netlify hostname; do not substitute a preview URL, localhost address, or a placeholder domain.

```bash
export PROCTORX_ANDROID_SERVER_URL="https://proctorx-assessment.netlify.app"
pnpm android:sync
pnpm android:open
```

Confirm that `android/app/src/main/assets/capacitor.config.json` contains the same HTTPS origin before installing a debug build on a consenting test device. The tester must control the camera and microphone permission prompts. Record only visible compatibility state and configured integrity metadata; do not retain recordings, voice samples, camera images, or video.

After the physical matrix passes, the project owner must create and safeguard the Android signing keystore and its passwords. The keystore, alias password, and key password must never be committed or shared in source. Only then may a release APK be built, certificate-verified, installed on the tested device, and checked against the published Netlify domain.

## Stop conditions

Stop the release if the public host is unavailable, Firebase-backed candidate access fails, a permission prompt appears before a candidate action, the compatibility diagnostic reports a missing API, the wrapper has a non-production host, an unsigned artifact is selected, or the tester withdraws consent. Resolve and document the issue before continuing.
