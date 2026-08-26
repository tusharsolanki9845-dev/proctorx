# ProctorX Android Production Release Checklist

## Current Status

The Capacitor Android project has been generated, its camera and microphone permissions are declared, and a debug build completed successfully. The build used a placeholder host, so it is not suitable for distribution. The final wrapper must be synchronized against the published ProctorX HTTPS domain.

| Release gate | Status | Owner |
|---|---|---|
| ProctorX application checkpoint | Complete | ProctorX project |
| Published HTTPS domain | Required | Project owner |
| Capacitor sync against published domain | Pending | Development workflow |
| Physical Android device permission matrix | Pending | Consenting tester |
| User-owned Android signing key | Required | Project owner |
| Signed release APK | Pending | Development workflow |

## 1. Publish the Web Application

Use the workspace **Publish** control to publish the current checkpoint. Record the resulting real HTTPS domain. Do not use a temporary preview address, localhost address, or placeholder domain for a release APK.

## 2. Synchronize the Android Wrapper

Set the real domain and synchronize:

```bash
export PROCTORX_ANDROID_SERVER_URL="https://your-published-proctorx-domain"
pnpm android:sync
pnpm android:open
```

Confirm that `android/app/src/main/assets/capacitor.config.json` contains the published HTTPS domain before installing the app.

## 3. Run the Consented Physical-Device Matrix

On a real Android device, a consenting tester must perform every row in `ANDROID_CAMERA_MICROPHONE_COMPATIBILITY.md`. The tester controls the system camera and microphone prompts. Record only the displayed compatibility state and configured integrity metadata—never retain audio, voice samples, images, or video.

## 4. Prepare Release Signing

Create and protect an Android signing keystore under the project owner’s control. Do not commit a keystore, alias password, or key password. Provide required values securely only after the physical-device matrix passes.

## 5. Build and Inspect the Release APK

After signing configuration is supplied, create a release build, verify the package identifier and signing certificate, install it on the tested Android device, and repeat a short consented camera/microphone smoke check against the published domain.

## Stop Conditions

Stop the release process if the published domain is unavailable, a permission prompt appears before the candidate action, the compatibility diagnostic reports a missing required API, the app loads a placeholder host, or a tester withdraws consent. Resolve and document the issue before continuing.
