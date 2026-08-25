# Research Notes: Online-Exam Integrity Rules

## Evidence Summary

University and peer-reviewed guidance supports a **proportionate, transparent, and human-reviewed** approach to remote assessment integrity. The University of Minnesota limits video proctoring to quizzes and exams, requires written advance notice and written consent, calls for practice opportunities, limits access to authorized personnel, and preserves a student’s ability to view evidence when accused of misconduct.[1] Rutgers similarly cautions that remote-proctoring flags can have false positives and recommends review of flagged incidents before an academic-integrity report, alongside accessibility alternatives, technical-failure contingencies, support, and advance student communication.[2]

Ohio State recommends designing and communicating assessments to reduce misconduct before relying on detection technology. Its guidance identifies explicit rules about permitted resources and devices, integrity acknowledgements, practice opportunities, and alternative arrangements where accessibility requires them.[3] The peer-reviewed review by Langenfeld concludes that security should be commensurate with the assessment’s consequences, must be balanced with privacy and equal opportunity to test, and should be complemented by assessment-design controls such as time windows, item randomization, multiple forms, and one-attempt rules.[4]

## Candidate Rules Supported by the Evidence

| Proposed ProctorX rule | Evidence-based rationale | Product boundary |
|---|---|---|
| Provide an assessment-specific integrity notice and affirmative acknowledgement before the attempt begins. | Advance notice, consent, and clear expectations are recommended by university guidance.[1] [2] [3] | The notice must state signals, submission consequences, retention, support route, and alternatives. |
| Treat focus loss, minimization, fullscreen exit, camera interruption, face absence, and multiple faces as **signals** with a recorded reason and timestamp. | Monitoring tools can identify irregularities, but automated detections are imperfect.[2] [4] | A signal is not a determination of misconduct or identity. |
| Allow an administrator to configure immediate submission for materially secure exams, including focus loss or minimization. | Security strength should reflect the consequence of the assessment.[4] | The rule must be disclosed in advance and require an appropriate accommodation or technical-failure path. |
| Protect students against technical harm with readiness checks, an accessible practice assessment, support during the assessment, and a documented incident/appeal path. | Practice, contingency planning, alternatives, and technical support are recommended.[1] [2] [3] | Automated submission must never block a subsequent human review or approved make-up process. |
| Use assessment design controls—strict time windows, item randomization, and one active attempt—before adding more invasive surveillance. | Assessment design reduces unauthorized behavior without relying only on monitoring.[3] [4] | ProctorX should not add audio recording, room scans, or biometric identity matching by default. |
| Keep camera analysis local where possible, persist only event metadata, restrict access, and document retention/deletion. | Video and identifying data create privacy obligations; access should be limited and purpose-bound.[1] [4] | Current ProctorX design must continue to avoid continuous-video storage. |
| Require human review before any academic-misconduct accusation or disciplinary action. | Universities explicitly advise flag review because false positives occur.[2] | Immediate submission is an assessment-control action, not a disciplinary finding. |

## Sources

[1] [University of Minnesota, *Privacy in Video Proctoring Guidelines*](https://teachingsupport.umn.edu/privacy-video-proctoring-guidelines)

[2] [Rutgers University, *Remote Proctoring Recommendations for Faculty*](https://academicaffairs.rutgers.edu/remote-proctoring)

[3] [Ohio State University, *Strategies and Tools for Academic Integrity in Online Environments*](https://teaching.resources.osu.edu/teaching-topics/strategies-tools-academic-integrity)

[4] [Langenfeld, *Internet-Based Proctored Assessment: Security and Fairness Issues*, Educational Measurement: Issues and Practice (2020)](https://pmc.ncbi.nlm.nih.gov/articles/PMC7404853/)
