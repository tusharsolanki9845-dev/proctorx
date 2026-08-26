# Firebase Provisioning Status

## Provisioned Project

On 26 August 2026, a Firebase project named **ProctorX Production** was created under the user-confirmed Google account. The Firebase project identifier displayed by Firebase Console is `proctorx-production`. Optional Gemini in Firebase and Google Analytics were disabled during creation to avoid unnecessary processing and telemetry.

The project is currently on the **Spark** plan, shown by the console as no-cost. Firebase SQL Connect is available as the relational PostgreSQL option, but its own setup and pricing terms must be reviewed and confirmed before a database instance, schema, or billing-enabled service is created.

## Firestore Database

The default Cloud Firestore database was created on 26 August 2026 in **`asia-south1 (Mumbai)`**, the selected India location for nationwide delivery. It uses the Standard edition and production-mode rules that deny all client reads and writes by default. The Firebase Console confirms that the database is ready and its location is `asia-south1`.

The Rules tab was verified after creation. Its deployed policy is:

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

This locked baseline permits no direct browser or mobile-client data access. Any later change must be reviewed with the server-side authorization model and recorded before publication.

No candidate, administrator, exam, attempt, report, support, or audit data has been inserted. Direct browser access remains blocked until the server-side integration is deliberately implemented and security rules are reviewed.

## Firebase Authentication

Firebase Authentication is initialized for the ProctorX Production project. The **Email/Password** provider was explicitly enabled on 26 August 2026. Passwordless email-link sign-in remains disabled. Firebase Console confirms the provider status as **Enabled**.

This step does not migrate, create, or expose any existing ProctorX candidate or administrator identities. Existing local credential sessions remain the current application behavior until a reviewed server-side Firebase integration and account-transition strategy are implemented.

## Server Credential Boundary

The Firebase Admin service-account credential was generated with explicit user confirmation and stored in Vercel Production as the masked secret `FIREBASE_SERVICE_ACCOUNT_JSON`. It is not committed to the repository, included in client code, or shown in this document. The temporary key file supplied for configuration was removed from the sandbox after the secret was saved.

## Compatibility Decision

ProctorX currently uses a MySQL/TiDB schema through Drizzle and exposes server-side tRPC procedures. Firebase Firestore is a document database and would require a substantial application data-model rewrite. Firebase SQL Connect is PostgreSQL-backed and relational, but it also uses a Firebase-defined GraphQL schema and predefined operations. It is therefore **not a drop-in connection-string replacement** for the existing Drizzle/MySQL service layer.

The selected safe sequence is to review Firebase SQL Connect’s billing and service terms, obtain explicit confirmation before enabling a paid resource, then decide whether to perform a deliberate data-layer migration or retain the present relational service behind a separately provisioned MySQL/TiDB database. No production database schema, candidate records, or authentication provider has been enabled yet.

## References

[1] [Firebase SQL Connect documentation](https://firebase.google.com/docs/sql-connect)

[2] [Cloud Firestore documentation](https://firebase.google.com/docs/firestore)

[3] [Firebase Authentication for web documentation](https://firebase.google.com/docs/auth/web/start)
