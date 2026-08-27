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
