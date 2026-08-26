# ProctorX Android Production Release Checklist

## Current Status

The Capacitor Android project has been generated, its camera and microphone permissions are declared, and a debug build completed successfully. It was synchronized on 2026-08-26 against the stable Vercel alias `https://proctorx-web.vercel.app`. The alias is reachable and its public web route plus unauthenticated tRPC route were verified. Production database, session, administrator-credential, and OAuth environment variables remain intentionally unconfigured in Vercel, so the wrapper is **not** ready for distribution or candidate use until those full-stack prerequisites are complete.

| Release gate | Status | Owner |
|---|---|---|
| ProctorX application checkpoint | Complete | ProctorX project |
| Stable Vercel HTTPS alias | Complete for host configuration | Development workflow |
| Production database, session, credentials, and OAuth configuration | Pending | Project owner |
| Capacitor sync against `https://proctorx-web.vercel.app` | Complete | Development workflow |
| Physical Android device permission matrix | Pending | Consenting tester |
| User-owned Android signing key | Required | Project owner |
| Signed release APK | Pending | Development workflow |

## 1. Publish the Web Application

The stable Vercel alias is `https://proctorx-web.vercel.app`. Do not substitute a temporary preview address, localhost address, or placeholder domain in the Android wrapper. Before release, configure and test the full production service using the environment requirements document; a reachable landing page alone is not sufficient for candidate use.

## 2. Synchronize the Android Wrapper

Set the real domain and synchronize:

```bash
export PROCTORX_ANDROID_SERVER_URL="https://proctorx-web.vercel.app"
pnpm android:sync
pnpm android:open
```

Confirm that `android/app/src/main/assets/capacitor.config.json` contains `https://proctorx-web.vercel.app` before installing the app.

## 3. Run the Consented Physical-Device Matrix

On a real Android device, a consenting tester must perform every row in `ANDROID_CAMERA_MICROPHONE_COMPATIBILITY.md`. The tester controls the system camera and microphone prompts. Record only the displayed compatibility state and configured integrity metadata—never retain audio, voice samples, images, or video.

## 4. Prepare Release Signing

Create and protect an Android signing keystore under the project owner’s control. Do not commit a keystore, alias password, or key password. Provide required values securely only after the physical-device matrix passes.

## 5. Build and Inspect the Release APK

After signing configuration is supplied, create a release build, verify the package identifier and signing certificate, install it on the tested Android device, and repeat a short consented camera/microphone smoke check against the published domain.

## Stop Conditions

Stop the release process if the published domain is unavailable, a permission prompt appears before the candidate action, the compatibility diagnostic reports a missing required API, the app loads a placeholder host, or a tester withdraws consent. Resolve and document the issue before continuing.
