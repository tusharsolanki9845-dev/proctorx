# ProctorX Focus and Microphone Policy

## Purpose

ProctorX presents **browser focus** and **microphone readiness** as transparent device-state signals. They are not identity claims, voiceprints, behavioral profiles, or independent findings of misconduct.

## Focus Status

The dashboard reports one of three local browser states: **Active** when the document is visible and focused, **Backgrounded** when the document is hidden, and **Focus lost** when the visible document is not focused. This indicator is a local readiness aid; it does not transmit a continuous activity history.

During an assessment, the pre-existing per-assessment strict-focus option may record `tab_hidden` and submit an attempt after device setup. The candidate receives notice before starting the assessment, and the resulting event remains subject to human review.

## Microphone Check

The candidate must initiate microphone access themselves. The check displays a short line for the candidate to read aloud, solely to confirm that browser permission and a local sound-level signal are working. The implementation does not retain audio, create a transcript, identify a speaker, compare a voice sample, or generate a voiceprint.

When an assessment enables audio monitoring, browser-local level analysis may record one `audio_activity` event after a configured sustained sound threshold. The event metadata is limited to duration and coarse level information. The audio stream and analyser are stopped when the assessment ends, device check stops, or permission is withdrawn.

## Escalation and Review

Each assessment controls whether audio monitoring is enabled, the sustained activity threshold, and whether a recorded audio-activity event immediately submits the active attempt. Immediate submission is an assessment-control action—not a conclusion about the source or meaning of a sound. The administrator review screen retains the event context and supports a documented technical-failure or accommodation reopening path.

## Explicit Non-Goals

ProctorX does not implement speaker recognition, voice identity matching, speaker diarization, transcription, background-audio recording, or voice-sample retention. These features are outside the product’s privacy boundaries.
