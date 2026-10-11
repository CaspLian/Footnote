# Aarush: live voice and review polish

- Status: done; user confirmed physical microphone recovery
- Branch: frontend-aarush
- Last updated: 2026-10-11
- Starting commit: e003bb3

## Objective and acceptance criteria

Restore microphone capture after voice previews, start a conversation with one orb tap, reserve the controls sheet for a long press, and show listening/speaking feedback with haptics. Use actual provider voice names while keeping the picker header and confirmation button stationary. Confirm real review integrations, make the loading presentation deliberate, simplify document verification, and install the Footnote icon on the existing iPhone app identity.

## Implemented

- Native conversation startup now claims audio, switches Expo audio back to recording, activates a LiveKit play-and-record voice-chat session, and explicitly unmutes the connected microphone. Previews previously left Expo audio in playback-only mode. The user confirmed that the installed replacement build now hears them. This confirms recovery, rather than isolating which audio configuration change was necessary.
- A single orb tap starts the session, or toggles microphone mute during a connected session. A 500 ms long press opens “Talk it through.” The orb changes for listening, connecting/thinking and speaking, with level feedback. Haptics occur on speaking transitions and provider interruption events, respecting the saved haptics preference.
- The voice screen displays the backend's 20 named multilingual voices with the language's recommended voice first. Explicit provider keys persist locally; older device/calm/clear/warm values still resolve through the legacy migration. Only the orb, voice details and preview controls page horizontally. The working-language control and confirmation CTA stay outside the pager. Preview clips are labeled as English introductions; accents vary.
- Review already calls the benchmark API for confirmed service codes. It now also awaits claim tracking instead of launching it in the background. Connected review has a six-second minimum presentation duration, measured alongside actual work. Slow requests add no further delay; errors surface immediately and cancellation cannot navigate to a completed review. This is client presentation pacing, not a measurement of provider latency.
- The extraction notice now follows the line items. Unknown optional financial fields are hidden initially, but can be entered through “Add another amount.” Missing values remain undefined. EOB detection considers both attachment classification and extraction document type.
- Removed the document-loading disclosure paragraphs and static em-dash separators from both frontend source trees. Original imported evidence is preserved.
- Expo app configuration now uses the provided Footnote light/dark iOS icon assets. Generated iOS files were recreated through Expo, rather than edited by hand. Bundle identity remains org.hackknights.unfold to preserve local storage.

## Integration evidence

- The running LAN backend log contained twelve successful benchmark requests and fourteen successful claim-route requests at the final count. Benchmark lookups can reuse cached results, which explains why they can be much faster than Gemini extraction.
- A final read-only lookup for service code 92507 returned source snowflake, rate 76.15 and no error. Snowflake's live warehouse lookup was also verified during the preceding installation task. Tiger Data connectivity and the app's claim routes were verified then; the current frontend continues using those existing endpoints. CSV fallback and nonfatal tracking failures retain their existing behavior. Missing comparison data is never fabricated.
- Read-only ElevenLabs metadata for the two recent phone calls showed an agent greeting and zero user turns, consistent with the reported microphone failure. No transcript, credentials or provider identifiers were copied into this handoff.

## Tests and delivery

- Mobile TypeScript and lint: passed without warnings.
- Mobile tests: 173 passed, including duplex-start ordering/unmute, interruption events, persisted provider voice choices, review timing/cancellation and awaited claim tracking. These are automated tests with controlled service doubles, not a physical microphone test.
- Expo Doctor: 21/21 checks passed.
- iOS, Android and web JavaScript exports: passed.
- Earlier web frontend: 19 tests passed, 3 live tests skipped; production build passed.
- Browser review at compact phone width confirmed real names and stationary picker chrome. Screenshot: /private/tmp/footnote-voice-picker-20261011.png.
- Signed iOS Release build succeeded; devicectl confirmed installation and launch on the user's iPhone on 2026-10-11. This build bundles JavaScript and does not require Metro.
- The user's physical microphone retry succeeded: “Yes, it hears me now.”
- Expo web is running at http://localhost:8082. The phone uses the previously approved LAN backend, which still requires the Mac and phone to share a reachable network.

## Remaining validation and interfaces

Physical microphone input was confirmed by the user. Audible interruption behavior and haptic timing were not separately confirmed. Android runtime validation was not performed for this change. No HTTP route, database schema, dependency or provider credential changes were made. No paid test conversation was initiated by the assistant.
