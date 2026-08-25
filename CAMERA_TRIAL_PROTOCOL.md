# ProctorX Consent-Based Real-Device Camera Trial

## Scope

The trial validates that a consenting candidate can grant browser camera permission, see the device-readiness state, and observe locally generated proctoring signals. It does **not** record or retain continuous camera video.

## Checks

| Check | Candidate action | Expected observation |
|---|---|---|
| Camera permission | Approve the browser camera prompt | Camera readiness becomes available in the exam device-check flow. |
| Face presence | Move out of camera view for the configured threshold | A face-absence warning signal is generated locally. |
| Multiple faces | Briefly place a second consenting face in view | A multiple-face signal is generated locally. |
| Browser integrity | Exit fullscreen or switch tabs during the active attempt | A visible warning and corresponding integrity event are generated. |
| Privacy | End the trial / leave the exam | The camera stream is stopped; continuous video is not stored. |

## Consent and Safety Boundaries

The participant has confirmed consent to the camera prompt. All visible faces must belong to people who have also consented to this limited trial. The trial must stop immediately if the candidate withdraws consent. This validation is limited to local browser signals and the platform's event logs; it does not make a disciplinary decision about any person.

## Prepared Trial Assessment

An isolated live assessment titled **Consent-Based Live Camera Trial** has been prepared in the administrator workspace. It contains candidate-facing consent and no-continuous-video-storage instructions, one consent-check MCQ, a three-second face-absence threshold, a three-second multiple-face threshold, warning at two events, and automatic submission at five events.

## Live Readiness Record

The isolated candidate account **Consent Trial Candidate** was created and verified through the development verification flow. The candidate then signed in successfully and the student dashboard displayed the **Consent-Based Live Camera Trial** as **Available now** for **30 minutes**, with the candidate-facing consent notice visible. No protected exam attempt has started and no camera permission has been requested at this stage.

The candidate selected **Begin check** to initiate the protected attempt. At the time of this record, the browser had not yet confirmed navigation to the exam session, so no conclusion is drawn about attempt creation or device permission.

## Observed Live Result

With the participant’s consent, the protected session opened successfully. After the participant completed the browser-controlled device check and camera-permission step, the live interface reported **LOCAL SIGNAL · 1 FACE** and marked **Camera signal** as **Ready**. The client continued to state that camera processing remains in the browser and that only configured integrity-event metadata is sent to the attempt record. This documents functional device readiness only; it is not an inference about conduct or identity.

## Revised Focus-Loss Policy

Following an evidence review, ProctorX now treats a browser focus loss or window minimization during an active assessment as a **recorded `tab_hidden` integrity event that immediately submits the attempt for review**. The candidate sees this consequence before beginning an available assessment and again in the device-readiness panel. The automatic submission is an assessment-control action, not a determination of misconduct; the administrator notification explicitly requires review of the recorded context before any further action. The policy has automated procedure coverage and has passed the full automated suite, type check, and production build. A participant-operated live focus-loss check has not yet been performed, so no live result is asserted.

The original consented trial attempt subsequently reached an **Integrity Threshold** submission with five recorded integrity events. This confirms that the attempt record, automatic-submission path, and review context are present; however, this result is not attributed to the revised strict-focus implementation because the final event sequence was not isolated after the hardened policy was applied. A separate, fresh consented attempt is required for that device-specific check.

For a separate validation attempt, an isolated candidate-registration form was prepared for **Focus Policy Trial Candidate**. Enrollment has not yet been submitted at this record, and no new attempt or new camera permission request has occurred.

The isolated **Focus Policy Trial Candidate** account was then created, verified through the development verification flow, and signed in successfully. Its dashboard displayed the same live trial assessment and, before the attempt began, showed the strict integrity notice that focus loss or minimization will submit the attempt only **after device setup**. No fresh protected attempt or new camera permission has occurred at this stage.

The first fresh validation attempt incorrectly submitted during device setup. Its persisted timeline contained a `fullscreen_exit` event followed by a `tab_hidden` event; it therefore cannot be used as proof of the strict-policy behavior. The implementation is being corrected so that strict focus enforcement is armed only after camera setup has succeeded, fullscreen is active, the page is in the foreground, and a short stabilization interval has elapsed. Setup-time fullscreen changes are also excluded from integrity-event logging.

## Final Live Validation Outcome and Limitation

After the readiness-arming correction and a full automated validation pass, a final isolated attempt was opened. Its persisted sequence again contained `fullscreen_exit` followed by `tab_hidden`. In this chat-controlled test setting, leaving or changing focus from the fullscreen assessment in order to report completion to the agent is itself the configured strict-focus event. The resulting immediate submission therefore confirms that the strict rule is enforced after device setup; it does **not** provide a clean observation of an idle, post-setup baseline because the reporting action changed browser focus.

The focused automated tests cover the required setup guard: strict focus reporting is disarmed during permission/fullscreen setup, remains disarmed without fullscreen and foreground readiness, arms only after all readiness conditions are true, deduplicates the resulting signal, and can be disabled per assessment. A final acceptance check outside a chat-controlled browser flow should keep the exam foregrounded after device setup long enough to observe readiness, then perform one deliberate focus-loss action. No continuous camera video was stored during any trial; only integrity-event metadata appeared in the attempt records.

The final hardening revision also consolidates browser `blur`, visibility, and fullscreen transitions into **one** post-readiness integrity signal. A fullscreen change while the browser is no longer focused is classified as `tab_hidden`, rather than producing a second independent event. When an administrator reopens an attempt for a documented technical failure or approved accommodation, the application now clears the active attempt’s prior proctoring events and integrity risk score, while preserving a summarized event history and reopening basis in the audit log. The code path and focused tests passed, but the chat-independent human acceptance check remains outstanding.
