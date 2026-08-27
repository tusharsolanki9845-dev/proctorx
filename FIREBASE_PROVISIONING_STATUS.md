# Firebase Provisioning Status

## Provisioned project and cost boundary

The user-approved Firebase project is **ProctorX Production** (`proctorx-production`) under `tusharsolanki9845@gmail.com`. It remains on Firebase’s **Spark no-cost plan**. No Blaze billing, Firebase SQL Connect, Cloud SQL, or paid Firebase service has been enabled.

| Resource | Status | Approved boundary |
|---|---|---|
| Cloud Firestore Standard | Active in `asia-south1` (Mumbai) | Used only through the server-side Firebase Admin SDK. |
| Firebase Authentication | Email/Password active | Used by the Netlify Function for candidate identity and Firebase-hosted verification/reset emails. |
| Firebase Web app | `ProctorX Netlify Authentication` | Registered only to obtain Firebase Authentication configuration; Firebase Hosting was not enabled. |
| SQL Connect / Cloud SQL / Blaze | Not enabled | Explicitly out of scope for the no-cost deployment. |

## Firestore authorization model

The Firestore database uses production-mode deny-all client rules. Browser and Android-wrapper code do not receive an Admin credential and cannot directly read or write identities, exam content, answers, reports, support messages, notifications, or integrity events.

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

The Netlify Function alone accesses Firestore through the Admin SDK after the application’s role-scoped tRPC authorization checks. Firestore document IDs preserve ProctorX numeric identifiers where its existing client and report contracts expect numbers. Exam creation and updates reserve counter ranges within one Firestore transaction so counter reads complete before the first atomic write.

## Authentication model

Production candidate registration creates a Firebase Email/Password account, then creates a Firestore-backed ProctorX user record that maps the Firebase UID to the existing ProctorX role and signed-session model. Candidate sign-in verifies the Firebase ID token on the server before ProctorX sets its own HTTP-only session cookie. Candidate passwords and Firebase ID tokens are never returned to the browser by the ProctorX API.

Firebase sends verification and password-reset actions through its hosted email workflows. A successful email verification is mirrored into the ProctorX Firestore user record at the next successful sign-in. Local password-hash and one-time-token code remains only as the non-Firebase local-development fallback; Netlify production selects Firebase when its server-only configuration is present.

The administrator continues to use the separately configured server-side administrator login. The configured administrator’s Firestore user record is role-scoped as `admin`; its password is not stored in Firestore or committed to the repository.

## Secret and deployment boundary

The Firebase Admin service-account JSON is stored only as Netlify’s masked Production secret `FIREBASE_SERVICE_ACCOUNT_JSON`. The Firebase Web API key is also stored as a masked Production secret `FIREBASE_WEB_API_KEY`; its value is not committed or delivered to the client. `JWT_SECRET`, `ADMIN_LOGIN_ID`, `ADMIN_LOGIN_PASSWORD`, and `PROCTORX_PUBLIC_ORIGIN` are configured in the Netlify production context with Builds, Functions, and Runtime availability.

The public health route reports only a Boolean Firebase configuration state. The administrator-protected readiness route has verified server-to-Firestore reachability without returning Firebase credentials or document data. The live public deployment is [proctorx-assessment.netlify.app](https://proctorx-assessment.netlify.app/).

## Privacy boundary and remaining release gates

Camera and microphone checks remain candidate-device processing only. The system does not introduce continuous audio/video storage, voiceprints, transcription, speaker identification, or diarization. Integrity signals remain review aids rather than standalone proof of misconduct.

No production candidate accounts or assessments have been created as part of the Firebase server-readiness test. The administrator identity is the only Firestore account created during the protected readiness validation. Before a signed Android APK is published, the Netlify host must remain stable, protected candidate and assessment flows must be tested with a consented test account, and the owner must supply and retain the Android signing key.

## References

[1]: https://firebase.google.com/docs/firestore "Cloud Firestore documentation"
[2]: https://firebase.google.com/docs/auth "Firebase Authentication documentation"
[3]: https://firebase.google.com/docs/admin/setup "Firebase Admin SDK setup documentation"
