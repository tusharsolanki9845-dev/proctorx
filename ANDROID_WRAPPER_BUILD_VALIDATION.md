# Android Wrapper Build Validation

## Validated Build

On 26 August 2026, the generated Capacitor Android project completed a local debug build using the API 36 Android SDK and Java development toolchain.

| Check | Result |
|---|---|
| Capacitor Android project generation | Passed |
| Capacitor asset and plugin synchronization | Passed |
| Android manifest `CAMERA` declaration | Present |
| Android manifest `RECORD_AUDIO` declaration | Present |
| Debug Gradle build | Passed |
| Debug APK output | Preserved outside the deployable project at `/home/ubuntu/webdev-static-assets/proctorx-android-debug-placeholder.apk` |
| Debug APK SHA-256 | `870e3686498bf781ef8255c0cc3d983374dec7524c6babb32e9653acf6fb9785` |

## Important Runtime Boundary

This validation used `https://proctorx.example.org` only as a placeholder HTTPS host in order to confirm native project generation and buildability. The generated debug APK is **not a deployable ProctorX release** and must not be distributed.

Before producing a release build, publish ProctorX, set `PROCTORX_ANDROID_SERVER_URL` to that real HTTPS domain, run `pnpm android:sync`, and build again. A physical Android device must then run the browser/Capacitor compatibility diagnostic and the consented camera-microphone matrix. The present validation demonstrates native wrapper build integrity, not real-device permission or camera behavior.
