# ProctorX Integrity Audit Report

## Scope and Method

The audit used the **Integrity Foundations Demo** scenario defined in `AUDIT_TEST_MATRIX.md`. The automated exercise covers a three-question timed multiple-choice paper, submitted answers, a support request, and a five-signal candidate integrity sequence: camera interruption, face absence, multiple faces, fullscreen exit, and tab visibility change.

The audit was executed without inserting synthetic production records. Instead, it uses deterministic unit and procedure tests that exercise the same scoring, escalation, notification, report-access, and authorization logic used by the application.

## Results

| Area | Demo outcome | Status |
|---|---|---|
| Server-side demo-paper scoring | The candidate answered two of three questions correctly for **3/6 (50%)**. | Pass |
| Supported integrity signals | All five simulated cheating signals are driven through the real proctoring procedure and persisted in an isolated database-backed demo-attempt timeline. | Pass |
| Warning threshold | The system enters warning state at the second recorded integrity event. | Pass |
| Auto-submit threshold | The system enters automatic-submission state at the fifth integrity event. | Pass |
| High-risk notification | The fifth real proctoring event creates a stored high-risk administrator alert, exposes it through the administrator notification route, and triggers the live administrator-notification emitter. | Pass |
| Technical-support notification | A student support message creates an administrator notification and triggers the real-time emitter. | Pass |
| Integrity-event escalation | The full five-signal sequence reaches a stored `integrity_threshold` submission; the real owner report and administrator review both expose the persisted timeline, while another student is denied access. | Pass |
| Candidate report isolation | Candidate report retrieval is routed through the authenticated student ID; a different student receives `NOT_FOUND`. | Pass |
| Administrator isolation | Students are rejected from administrator identity tools, detailed reviews, inboxes, and notifications. | Pass |
| Email-token protection | Expiry, single-use rejection, and persistence-layer zero-row consumption handling are tested. | Pass |

## Test Evidence

The final automated run completed with **13 test files and 31 passing tests**. `server/demoIntegrityAudit.test.ts` validates the demo-paper scoring and escalation logic, while `server/demoAuditFullStack.test.ts` creates an isolated database-backed paper and candidate, sends all five signals through the real proctoring procedure, verifies the stored `integrity_threshold` submission reason, confirms owner-only report retrieval, confirms administrator review data and notification-route access, and then cleans up the audit records.

## Detection Interpretation

> The audit confirms that when browser-side proctoring reports a camera interruption, face-absence, multiple-face, fullscreen-exit, or tab-hidden event, ProctorX records and escalates it according to the configured thresholds. At the demonstrated fifth event, the candidate is detected as exceeding the integrity threshold, the attempt is submitted automatically, and an administrator alert is emitted.

## Remaining Acceptance Tests

The browser camera and face-detection signals need a controlled, consent-based real-device trial before high-stakes deployment. Such a trial should validate camera permissions, MediaPipe model loading, lighting and face-position edge cases, fullscreen behavior, mobile backgrounding, and real-time alert receipt by a signed-in administrator. Transactional email must also be configured with a verified production sender before real student verification or recovery emails are expected to arrive.
