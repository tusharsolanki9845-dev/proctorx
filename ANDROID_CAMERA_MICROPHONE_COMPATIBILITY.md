# ProctorX Android Wrapper and Device Compatibility

## Packaging Model

ProctorX uses a **remote-hosted Capacitor wrapper**. The Android app loads the published HTTPS ProctorX application, so the server-side assessment workflow, signed session behavior, and browser-local MediaPipe processing remain consistent with the web release.

The candidate dashboard includes a local **Device compatibility** diagnostic. It checks HTTPS context, camera API availability, microphone API availability, fullscreen availability, Android detection, and Capacitor-native runtime detection without requesting a permission or sending device data. This diagnostic complements—but does not replace—the physical-device matrix below.

Before adding or synchronizing Android, set `PROCTORX_ANDROID_SERVER_URL` to the published HTTPS application URL. Run `pnpm android:sync`, then open the generated Android project in Android Studio with `pnpm android:open`.

> Do not use the temporary development preview URL for an installed production wrapper. Use the published HTTPS address associated with the intended production deployment.

## Required Android Manifest Declarations

After creating the Android project, add the following declarations to `android/app/src/main/AndroidManifest.xml` before building:

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
```

Runtime permission is still candidate-controlled. The app must not request either permission until the candidate taps the relevant device-check action and reads the on-screen notice.

## Device Test Matrix

| Area | Test action | Expected result | Stored data |
|---|---|---|---|
| Camera permission | Tap **Begin device check**, approve/deny camera | Camera readiness becomes active, or a clear blocked state is shown | Integrity metadata only; no video file |
| Microphone check | Tap **Test microphone**, read the displayed line | Local level changes; no recording, transcription, or voice sample is retained | Coarse event metadata only if monitoring is enabled |
| Audio policy disabled | Complete camera check without microphone monitoring enabled | No microphone permission is requested automatically | None |
| Audio policy enabled | Complete local microphone check, then begin device setup | Local sustained sound policy activates only after candidate-initiated permission | Event type, duration, coarse level bucket |
| Fullscreen and focus | Enter fullscreen, then background once | Configured focus policy records one signal and applies the assessment rule | Event metadata and submission reason |
| Background recovery | Return from background after a non-strict assessment | Dashboard and device status refresh; no continuous history is exposed | None beyond any configured event |
| Permission withdrawal | Revoke camera or microphone permission during an active check | Local check stops and the candidate sees an actionable device state | Configured integrity event, if applicable |
| Model availability | Open device check on a production network | Face model loads and local face detection starts | No image or video upload |

## Build Commands

```bash
export PROCTORX_ANDROID_SERVER_URL="https://your-published-proctorx-domain"
pnpm android:sync
pnpm android:open
```

Use Android Studio to select a physical device, run the compatibility matrix, and generate a signed release only after the published domain, permissions, privacy notice, and institutional review process are approved.

## Recorded Native Build Validation

The generated Capacitor wrapper has completed a local Android debug build with the required camera and microphone declarations. See [Android Wrapper Build Validation](./ANDROID_WRAPPER_BUILD_VALIDATION.md) for the exact build record, artifact location, and the required production-host replacement before any release or physical-device test.
