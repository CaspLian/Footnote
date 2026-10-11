# Native voices per language, and live conversations about Guide terms

- Status: accepted and live-tested
- Date: 2026-10-11, America/New_York
- Requested by: Nimesh ("only show voices supported by the language and speak in the accents of the selected
  language, not English"; "the orb explanation works for Guide terms as well, not just bills")

## Voices

A voice speaks a language only if ElevenLabs verified it for that language (`verified_languages` in
`voices.json`, with the accent it was verified with). The rule holds everywhere audio is made:

- **Backend:** `VoiceCatalog.choose()`, used by text-to-speech and the live agent. A chosen voice that isn't
  verified for the language gives way to that language's default voice.
- **App:** `resolveVoiceKey()` applies the same rule, and the voice picker lists only verified voices.

Before this change, 27 of the 42 locales had no default and fell back to Matilda. Matilda is not verified for most
of them, so they were read with an American accent. Hindi and Tamil defaulted to Saavi and Chinese to Andy, none
of them verified for those languages. Finnish, Hebrew and Thai had no verified voice at all.

Every locale now has a verified default. 18 native-speaker voices come from the Voice Library. They are verified
for the model that speaks the language (Flash v2.5, or v4 Turbo for Hebrew and Thai), cost the standard rate, are
not live-moderated, and have 180 to 730 days' notice:

| Locales | Voices |
|---|---|
| Finnish | Soili, Jaakko |
| Hebrew | Dana, Amit |
| Thai | Siriporn, Somchai |
| Taiwan Mandarin | Anna |
| Hindi | Zara |
| Tamil | Meera, Nila |
| Indonesian | Arunika |
| Bulgarian | Milena |
| Filipino | Pilar |
| Canadian English | Stephanie |
| Mexican Spanish | Ana María |
| Québec French | Jeanne |
| European Portuguese | Mariza, Tiago |

Spain now defaults to Patrick, who is verified with a Peninsular accent; it used to get Elio's Mexican accent.

Evidence (2026-10-11): 235 clips were generated, one per candidate voice and locale. Each spoke the
localized preview sentence through the production model routing, and Scribe v2 transcribed it back. Every
chosen default was transcribed in its own language. Voice Library voices play directly on paid plans and don't
use voice slots (ElevenLabs docs).

Voice previews now speak the listener's language (`GET /voices/{key}/sample?language=`, `sample_texts.json`), so
the accent heard before choosing is the accent used.

## Guide conversations

`POST /api/v1/voice/agent/session` accepts a Guide term (`term_title`, `term_definition`, `term_example`)
instead of `audit_id`:

- The agent receives the term as `guide_topic` data.
- It skips the bill greeting; instead the app sends a short request in the call's language once connected
  (`opening_message`).
- The agent's Gemini then explains the term with its usual guardrails.

Live checks in English, Mexican Spanish, Japanese, Finnish, Taiwan Mandarin and Québec French each answered in
1.3 to 1.8 seconds, in the right language, with the correct local term.

**Limitation:** ElevenLabs Agents accept language presets only from Flash's list. It refused "he" and "th"
presets on 2026-10-11, so live conversations stay unavailable in Hebrew and Thai. Readings and previews in both
work through v4 Turbo.
