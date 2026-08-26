# ProctorX Firestore Document Model

## Purpose and boundary

This model is the planned server-side replacement for the present MySQL/TiDB persistence layer. It preserves the existing numeric identifiers and relationship semantics so tRPC procedures, reports, and PDF generation can remain stable during a controlled migration. The Firestore rules baseline remains deny-all; the Vercel server uses Firebase Admin credentials to perform authorization through existing protected and admin tRPC procedures.

> **No direct client access is permitted.** Candidate browser code must never read or write Firestore collections directly, and it must not receive Firebase Admin credentials.

| Collection or document path | Primary identifier | Purpose | Query boundary |
|---|---|---|---|
| `meta/counters` | entity name | Transactional numeric-ID allocation for migrated entities | Server only |
| `users/{userId}` | preserved numeric user ID | Identity, role, profile, credential hash, and sign-in metadata | Server only |
| `userLookup/openId/{encodedOpenId}` | encoded OpenID | Maps identity provider IDs to numeric users | Server only |
| `userLookup/email/{sha256(email)}` | SHA-256 email digest | Enforces email uniqueness without a plaintext e-mail document ID | Server only |
| `accountTokens/{tokenHash}` | existing token hash | One-time verification and reset token state, expiry, and consumption timestamp | Server transaction only |
| `exams/{examId}` | preserved numeric exam ID | Assessment settings and configured integrity policy | Server only |
| `exams/{examId}/questions/{questionId}` | preserved numeric question ID | Questions, answer keys, points, and order | Server only; answer keys never reach a candidate before submission |
| `attempts/{attemptId}` | preserved numeric attempt ID | Candidate attempt lifecycle, score, integrity risk, and ownership | Server only |
| `attempts/{attemptId}/answers/{questionId}` | question ID | Candidate answer state, review flag, and final correctness | Server transaction only |
| `attempts/{attemptId}/events/{eventId}` | generated event ID | Coarse integrity signal metadata and severity | Server only |
| `attempts/{attemptId}/support/{messageId}` | generated message ID | Candidate/admin support conversation | Server only after attempt ownership or administrator checks |
| `auditLogs/{auditId}` | generated audit ID | Immutable business/audit record for actions and remediation | Server only |
| `adminNotifications/{notificationId}` | generated notification ID | Polling-backed administrator alerts and read state | Server only |

## Transaction and authorization rules

All mutations that previously depended on SQL uniqueness or atomic update counts must use Firestore transactions. This includes user-email registration, active-attempt creation, max-attempt checks, answer updates, one-time token consumption, submission scoring/finalization, reopening remediation, integrity event risk increments, and administrator notification read state.

The Firestore Admin adapter will preserve the current server-side access-control helpers. Candidate ownership is checked from the `attempts/{attemptId}` document before answer, report, proctoring-event, or support operations. Administrator-only actions remain behind the existing `adminProcedure`; Firestore itself does not grant roles to browser clients.

## Migration order

The server adapter will first support the identity, account-token, examination, attempt, answer, integrity-event, support, notification, and audit paths as a coherent transaction-aware surface. Existing MySQL data is not copied automatically. A separate, owner-approved migration/export plan is required before importing any existing candidate data to Firestore.

## Firestore indexes to create after adapter implementation

| Collection | Composite query | Planned index |
|---|---|---|
| `attempts` | `userId ==`, newest first | `userId ASC, startedAt DESC` |
| `attempts` | `examId ==`, `userId ==`, status | `examId ASC, userId ASC, status ASC` |
| `events` collection group | `attemptId ==`, newest first | `attemptId ASC, detectedAt DESC` if a collection-group query is retained |
| `support` collection group | newest administrative inbox messages | `createdAt DESC` with denormalized exam/student fields only if needed |

The Vercel server will use Firebase Admin only, so no client-side Firestore index or rule relaxation is required for the initial release.
