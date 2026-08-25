# ProctorX Design and Implementation Notes

The current landing page has been visually verified at desktop and 375px-wide mobile viewports. It uses the requested deep-black cyberpunk direction with a visible grid field, cyan system-signal accents, magenta primary-action and human-review accents, squared HUD panels, and a high-contrast assessment-telemetry presentation. The mobile composition collapses cleanly from the desktop split hero into a vertically ordered narrative without horizontal clipping.

The visual system deliberately assigns **cyan** to verified or active system states and **magenta** to primary actions, review states, and escalation attention. Product messaging explicitly distinguishes assistive integrity signals from automated misconduct decisions.

The browser proctoring hook requests camera access only after a student action, processes face-presence and multiple-face results locally using MediaPipe Face Landmarker, and sends only configured integrity-event metadata to the backend. Camera behavior, fullscreen requests, and backgrounding must still be tested on intended Android wrapper devices before high-stakes use.

Protected-route verification confirmed two intended states: the managed preview rendered the authenticated candidate dashboard without synthetic exam data, while a separate unauthenticated browser session was gated behind the administrator sign-in control. Administrator edit and review interfaces are intentionally role-gated and should be exercised with a promoted project-owner account during acceptance testing.
