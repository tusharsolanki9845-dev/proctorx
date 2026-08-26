# Android Wrapper Build Validation

## Validated Build

On 26 August 2026, the generated Capacitor Android project completed a local debug build using the API 36 Android SDK and Java development toolchain.

| Check | Result |
|---|---|
| Capacitor Android project generation | Passed |
| Capacitor asset and plugin synchronization | Passed |
| Android manifest `CAMERA` declaration | Present |
| Android manifest `RECORD_AUDIO` declaration | Present |
| Debug Gradle build against placeholder host | Passed |
| Debug APK output | Preserved outside the deployable project at `/home/ubuntu/webdev-static-assets/proctorx-android-debug-placeholder.apk` |
| Debug APK SHA-256 | `870e3686498bf781ef8255c0cc3d983374dec7524c6babb32e9653acf6fb9785` |

## Vercel-Host Synchronization Validation

On 26 August 2026, the Android project was synchronized with `PROCTORX_ANDROID_SERVER_URL=https://proctorx-web.vercel.app`. The generated `android/app/src/main/assets/capacitor.config.json` now contains that HTTPS alias, and an unsigned debug Gradle build completed successfully with the API 36 Android SDK. This proves that the stable remote-host configuration compiles; it does **not** prove that sign-in, exams, reports, or support operate in the wrapper because the necessary Vercel production environment variables remain unset.

| Check | Result |
|---|---|
| Capacitor sync against stable Vercel alias | Passed |
| Generated `capacitor.config.json` remote URL | `https://proctorx-web.vercel.app` |
| Unsigned debug Gradle build after Vercel sync | Passed |
| Physical Android permission and recovery test | Not performed; explicit consented tester required |
| Signed release APK | Not created; owner-controlled signing key required |

## Important Runtime Boundary

The earlier native validation used `https://proctorx.example.org` only as a placeholder HTTPS host in order to confirm native project generation and buildability. The wrapper is now pointed at the stable Vercel alias, but its debug APK is still **not a deployable ProctorX release** and must not be distributed.

Before producing a release build, configure and validate ProctorX’s production database, session, administrator-credential, and OAuth environment variables on Vercel; then repeat the protected flows against the stable domain. A physical Android device must run the browser/Capacitor compatibility diagnostic and consented camera-microphone matrix. The present validation demonstrates native wrapper build integrity, not real-device permission or camera behavior.
