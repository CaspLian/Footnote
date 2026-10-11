# Aarush: merged-v1 iPhone installation

- Date: 2026-10-10
- Working branch: frontend-aarush
- Integrated checkpoint: bb76fbb from origin/merged-v1, fast-forward from c04f38f; no UI conflicts.

## Configuration

Provider settings are in ignored backend/.env with restrictive file permissions. The ignored mobile/.env points to the Mac's Wi-Fi API at http://192.168.1.28:8000. No provider credentials are bundled in the app. The user explicitly approved the unauthenticated LAN backend and its provider data flows for synthetic phone testing. This address requires the Mac to be running and the phone to share a reachable network; it is not a hosted service.

## Executed checks

- Mobile TypeScript and lint passed; 166 tests passed.
- Expo Doctor: 21/21 passed.
- iOS, Android and web JavaScript exports passed.
- API health, language catalog and voice catalog returned HTTP 200 on loopback; LAN health returned HTTP 200.
- Gemini extracted the synthetic sample image successfully; no test analysis was saved.
- Tiger Data SELECT 1 and ElevenLabs private agent read-back passed.
- Snowflake returned the requested 70450 benchmark from the live warehouse.
- Generated the native Footnote iOS project and installed pods, preserving a backup of the previous generated Unfold project outside the repository.

## Device delivery

The signed Release native build succeeded and devicectl confirmed installation on iPhone 00008130-000435A82178001C. The standalone JavaScript bundle includes the configured LAN API URL; Metro is not needed. Physical upload, microphone, audible playback and live conversation remain unverified until exercised on the phone. Installed identity remains org.hackknights.unfold, preserving existing app storage.

devicectl also confirmed a successful app launch. This confirms installation and launch, not the physical end-to-end document or voice journey.
