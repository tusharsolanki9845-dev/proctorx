# ProctorX Vercel Deployment Architecture

## Decision

ProctorX will replace its process-local Socket.IO notifications with **database-backed client polling** for Vercel deployment. Support messages, integrity events, and administrator notifications are already persisted in the relational database and protected by tRPC authorization procedures. Each client will refresh only the data it is already authorized to view, allowing the application to retain support and alert workflows without relying on a persistent server process.

## Transport Change

| Area | Current transport | Vercel-compatible transport | Authorization boundary |
|---|---|---|---|
| Candidate support chat | Socket.IO room notification | Refresh the existing attempt thread at a short client interval and after send | Candidate must own the attempt; administrator must be authorized |
| Administrator support inbox | Existing query refresh | Preserve short query refresh | Administrator-only procedure |
| Administrator alerts | Socket.IO room notification | Refresh the authorized notification list at a short client interval | Administrator-only procedure |
| Integrity event escalation | Process-local emitter | Persist the event and notification, then allow the authorized client query to refresh | Candidate attempt ownership; administrator review |

The polling interval is a user-interface refresh mechanism, not a background job. No audio, image, camera stream, voice data, or hidden browser history is introduced by this change.

## Serverless Entry Point

The Vercel deployment will use a dedicated serverless entrypoint that mounts the existing Express/tRPC routes without starting a process-local HTTP server, static-file server, Vite server, or Socket.IO server. Vercel will serve the built Vite site as static output and invoke the API function for `/api/*` requests.

## Downloads Distribution

The public website will provide a device-aware Downloads page. Android will show an APK link only after a production-domain build is signed and validated. Until then, it will display release-verification status. Desktop users will receive a web/PWA route because an Android APK cannot run on desktop operating systems.

## Environment Boundary

Vercel requires its own configuration for the database, session signing, owner context, and any optional email provider. Existing Manus project values are not copied automatically. The user must supply or connect the production-equivalent values before an external deployment is made live.

## References

[1]: https://vercel.com/docs/functions/websockets "Vercel Functions and WebSockets"
