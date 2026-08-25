# ProctorX Demo Assessment Integrity Audit

## Scenario

The audit uses a timed multiple-choice demo paper named **Integrity Foundations Demo**. A simulated enrolled candidate starts an in-progress attempt, answers questions, requests technical support, and then produces a sequence of browser-proctoring signals intended to represent cheating or exam-integrity violations.

| Test area | Simulated event | Expected behavior | Evidence source |
|---|---|---|---|
| Exam delivery | Candidate answers a correct and incorrect MCQ | Answers persist; server scoring returns score and maximum score only after submission | Exam scoring tests |
| Browser integrity | Camera interrupted, face absent, multiple faces, fullscreen exit, tab hidden | Events are persisted with increasing risk; warnings precede escalation | Proctoring tests and event records |
| Escalation | Event count reaches configured automatic-submission threshold | Attempt is submitted with `integrity_threshold` reason | Escalation test |
| Administrator alerting | Candidate sends support message; high-risk integrity threshold is reached | Notification record is created and real-time notification emitter runs | Support and notification tests |
| Candidate reporting | Submitted candidate opens own attempt report and PDF download flow | Owner-only attempt retrieval succeeds | Report authorization tests |
| Access control | Different candidate requests attempt report; candidate requests admin inbox/alerts | Request is denied or reported as not found | Procedure authorization tests |
| Account security | Verification link is used twice | First verification succeeds; repeated use is rejected | Token and procedure tests |

## Audit Boundaries

This audit validates the **application signals and escalation pipeline**. Browser camera and face detection can only be proven on a real candidate device with consent, camera hardware, and live MediaPipe input; therefore, automated coverage simulates the resulting events rather than claiming biometric detection from a synthetic video feed.
