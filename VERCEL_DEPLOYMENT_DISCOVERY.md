# Vercel Deployment Discovery

**Observed on 27 August 2026 through the authorized Vercel dashboard:**

| Project | Observed status | Relevance |
|---|---|---|
| `proctorx-web` | Git-linked to `tusharsolanki9845-dev/proctorx`; recent deployment labeled “Restore Vercel deployment and harden Firebase email actions.” | Existing deployment target to inspect and, if correctly configured, reuse. |
| `proctorx-assessment` | Newly created, no production deployment. | Do not create another duplicate project. |
| `proctorx` | Exists but is not Git-linked. | Do not change without an explicit need. |

The authenticated Vercel team is `Crocksy` on the Hobby plan. The dashboard showed existing free-tier usage within its displayed quotas at the time of observation. This record contains no credentials or environment-variable values.

The existing `proctorx-web` project is Git-linked to the private ProctorX repository and displayed a **Ready** production deployment for commit `4fef39d`, available at `https://proctorx-web.vercel.app`. Its environment-variable settings provide an “Add Environment Variable” control; values were neither inspected nor changed during discovery.

After the approved server-only variables were transferred and Vercel production was redeployed, the deployment was ready in 35 seconds for commit `4fef39d`. A direct request to `/api/trpc/system.health`, however, returned the SPA document rather than the tRPC response. The next corrective work is therefore limited to Vercel route/function discovery; Firebase credentials and Firestore data were not exposed or modified.

The authenticated Vercel build log for production deployment `5whVS1dpS7xUqQVbHxRUhQQHsPqR` recorded the expected command `vite build && esbuild server/vercelEntry.ts ... --outfile='api/[...path].mjs'` and a generated 124.5 kB bundle. The build completed successfully, but its API route still fell through to the SPA. This indicates function discovery or rewrite resolution rather than a compilation failure. The log also reported unset optional `VITE_ANALYTICS_*` placeholders, which do not affect the server-only Firebase configuration.

The Vercel deployment list subsequently confirmed the API-first routing commit `c3734b4` as a Ready production deployment. The active production alias still returned the SPA document for the tRPC health path, despite a successful build. This preserves the diagnosis that the function must be made discoverable to the Vite deployment output, rather than treating build readiness as proof of API availability.

The Firebase service-account console was opened for the approved `proctorx-production` project, but the active browser session remained under an unrelated Google account without project access. No Firebase project, IAM, or credential operation was performed from that account. Further Firebase console work is restricted to an authenticated `tusharsolanki9845@gmail.com` session.

The Google account chooser subsequently confirmed `tusharsolanki9845@gmail.com` as an available authenticated session. Selecting it opened the `ProctorX Production` Firebase project’s Service accounts page. The next approved operation is limited to generating one replacement Admin SDK key for the Vercel server-only runtime.

The authorized project page confirms the Firebase Admin SDK service account for `proctorx-production` and the project remains on the Spark plan. The “Generate new private key” action is visible and is the only pending credential action. No billing upgrade or other Firebase product was selected.

After the user-approved confirmation, Firebase generated the replacement Firebase Admin SDK private key. The key file must be treated as temporary secret material: it will be moved directly into the Vercel Production environment variable, validated through non-sensitive health checks, and deleted from the sandbox without being opened, committed, or attached.

The Vercel API route was corrected by committing the bundled ESM catch-all at `api/[...path].mjs` before the remote build, then retaining API-first rewrites. The active public `system.health` tRPC call now succeeds with the required batch input and confirms that Firebase Admin is configured. A configured-administrator session was also established without displaying credentials, and its `system.firebaseReadiness` response confirmed Firestore is both configured and reachable. The replacement key was supplied to Vercel only as a masked Production secret and then securely deleted from the sandbox.

The controlled Vercel verification-resend request returned the designed privacy-preserving `configuration_required` state. Sanitized Vercel runtime diagnostics identified the failure as an invalid Firebase Web API key. This is limited to the server-only Identity Toolkit configuration; Firebase Admin, Firestore, the Vercel public API function, and administrator-only Firestore readiness are working. No candidate email was sent by the failed request.

The authorized Firebase General settings page exposes the existing ProctorX Web app’s SDK configuration and a copy control. Its API key is treated as server-only deployment configuration for this implementation and is not reproduced in this repository, tracker, or validation record. The next action is to replace the invalid Vercel `FIREBASE_WEB_API_KEY` value through Vercel’s masked Production environment-variable controls.
