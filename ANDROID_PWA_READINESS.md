# ProctorX PWA and Android Wrapper Readiness

ProctorX now supplies a responsive browser interface, mobile-safe viewport configuration, a standalone PWA manifest, and a camera workflow that begins only after explicit student action. The responsive web application is the source of truth; an Android package should embed this same web experience rather than duplicate the interface.

For Android distribution, use a wrapper such as Capacitor after the hosted web application has a stable public domain and HTTPS. Configure Android camera permission declarations, confirm camera preview behavior in the WebView, and test the MediaPipe Face Landmarker model download on a real device and connection. Do not assume that Android WebView behavior will exactly match desktop Chromium.

The pre-release test plan must cover portrait and landscape layouts, runtime camera permission denial and revocation, app backgrounding and resuming, weak-network model initialization, fullscreen behavior, timer continuity, and result submission after reconnecting. For high-stakes use, formal assessments should remain limited to explicitly supported device and browser combinations until this testing has been completed.

The PWA manifest enables installable presentation metadata, but offline exam attempts are intentionally not implemented. Answers and integrity events should continue to be persisted through the live server workflow to avoid ambiguous submission states.
