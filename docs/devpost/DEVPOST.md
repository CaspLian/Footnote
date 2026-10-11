# Footnote: Devpost submission text

Written 2026-10-11 for **Hack Knight Fall 2026** (https://hack-knight-fall-2026.devpost.com/). Fact-checked against
the repo at `802f2a1` (`Backend-Frontend-Connection-V1`, 07:12 EDT) and the event pages at 06:50 EDT. Evidence for
every claim is in [FACT-CHECK.md](FACT-CHECK.md). The branch was still gaining commits during the check, so re-read
the in-progress lines against the final pushed code. Lines marked **(in progress, confirm before submitting)** describe
work still being built on 2026-10-11. Keep such a line only if the feature works on the demo devices and is pushed
before the deadline, and delete the marker when you paste it. Otherwise delete the line.

## Before you paste (do not paste this section)

Deadline: **Oct 11, 2026 @ 12:00pm EDT** (Devpost). Judging starts at 12:30 PM in the Dining Hall. Paste from
"Project name" to the end, and fill in the team names.

| Check | Why | Owner |
|---|---|---|
| Push all demo code before 12:00 PM EDT, then stop pushing | The rules say "any code pushed past the deadline or before the start of the hackathon will be disqualified". At 07:12 the local branch was 50 commits ahead of `origin`. The first commit (`3a561e2`, 2026-10-09 12:51 PM EDT) is after hacking began at 12:00 PM, so the start rule looks satisfied. | integration owner |
| Make the GitHub link work for judges | `gh repo view` reports `CaspLian/claimpulse-ai` as **private**. Its default branch, `main`, is the day-one skeleton (`8c1a321`). Either make the repo public after scanning the whole history for secrets, or ask an organizer how judges read private repos. Link the branch that holds the demo code, or merge it into `main` before noon. If the repo stays private, also delete the "Details: `docs/devpost/FUTURE-IDEAS.md`" line. | repo owner (CaspLian) |
| Remove or confirm every "(in progress...)" line | Only shipped, pushed features belong in the submission. If the example call ships, also add `elevenlabs-text-to-dialogue` to "Built with". | each feature owner |
| Confirm the Gemini key's tier | On 2026-10-10 the key returned 429 "generate_content_free_tier_requests, limit: 20". That message is in team notes, not in the repo; `docs/API_CONTRACTS.md` records only that the main model ran out of quota. If billing is enabled now, replace the tier sentences in "Privacy and safety" with: "Our Gemini key is on the paid tier, so Google does not use our prompts or responses to improve its products; it logs them for a limited time to detect abuse." | Gemini owner |
| Keep the live-call privacy sentence accurate | The app shows the provider notice only under "Data use" in the orb's long-press controls (`mobile/src/components/agent-orb-control.tsx`). One tap on the orb starts a call without showing it. If the team adds a notice before the first call, update the "Voice" item in "Privacy and safety". | app owner |
| Choose prize categories | See the table below. Whether Devpost limits how many you can select was not confirmed. | presenter |
| Video | Devpost asks for a video only for hardware projects. A short recording is still the best fallback at the table. | anyone |

Prize categories on the Devpost overview (checked 2026-10-11) and how well Footnote fits:

| Prize | Fit |
|---|---|
| Best Overall Hack, Best Runnerup Hack | Eligible. |
| Best Health Hack | Strong: medical bills and EOBs; Health is one of the event's listed themes. |
| Best Financial Hack (Diameter Capital) | Strong: exact amounts in cents, statement and EOB balances kept apart; Fintech is a listed theme. |
| [MLH] Best Use of ElevenLabs | Strong: text-to-speech, speech-to-text and a live ElevenLabs agent are core features. |
| [MLH] Best Use of Gemini API | Strong: through our API key, Gemini reads the documents, writes the explanations and translates the spoken price findings. The live agent also runs Gemini 3.5 Flash, but ElevenLabs hosts that model, not our key. |
| [MLH] Best Use of Tiger Data | Moderate: saved analyses and claim timelines live in Tiger Data, in ordinary PostgreSQL tables (no hypertables or continuous aggregates). The prize text asks for "performance-driven use". |
| [MLH] Best Use of Snowflake API | Weaker: Snowflake holds the Medicare reference table and answers code lookups through the Python connector. The prize text centers on LLMs through Snowflake's REST API, which we do not use. |
| Best Beginner Hack | Only if the team qualifies; criteria not published. |
| Best Environmental Hack, Solana, Presage | Not applicable. |
| [MLH] Best Domain Name from GoDaddy Registry | Not applicable unless the team registers a domain through GoDaddy Registry. |

MLH's own prize page also lists a "DEV Writing Challenge" ($100, chosen by DEV's editors). It is not a Devpost
category.

---

## Project name

Footnote

## Tagline (elevator pitch, 161 characters)

Footnote reads a US medical bill and its insurance EOB with you, checks coded charges against Medicare's national rates, and explains them aloud in 30 languages.

## Inspiration

A US medical bill and the insurer's Explanation of Benefits (EOB) arrive separately. They show different totals
for the same visit, and they describe the care in billing codes. To work out what you owe, you have to line the two
documents up, decode each charge and then call a billing office with the right question. That is hard for anyone.
It is harder if English is your second language, if you have low vision or low literacy, or if you are handling a
parent's or a child's paperwork.

We wanted a tool that does the tedious part with you. It reads both documents, shows where every number came from,
points out what is worth asking about, and lets you talk it through out loud in your language. It should never
pretend to know more than the paper says.

## What it does

Footnote turns a bill and its EOB into a case you can understand, check and act on. It runs on iOS, Android and the
web from one Expo codebase.

1. **Import.** Photograph pages with the in-app camera (up to 10 pages), pick photos, or choose PDFs. Footnote keeps
   the originals on the device. You can open them from the verification screen and from each finding.
2. **Read.** Gemini reads all pages in one request. It labels each file as a bill, an EOB or a plan document. It
   extracts the provider, dates, line items with billing codes, and the statement and EOB amounts separately.
   Anything not printed stays blank; a missing amount is never shown as zero.
3. **Verify.** You compare each value with the original, correct it and confirm. Nothing is compared until you
   confirm. If your confirmed amounts differ from the reading, Footnote pauses the original reading and the live
   call's copy of the bill, so neither describes old numbers.
4. **Review.** Footnote shows the statement balance, the EOB's patient responsibility and recorded payments
   separately. It lists questions worth asking, including lines Gemini flagged, such as repeated charges or vague
   fees. It compares each confirmed billing code with Medicare's national rate from the CMS 2026 Physician Fee
   Schedule. A difference is a question to ask, never proof of an error. When the reference covers only the
   doctor's part of a hospital service, Footnote asks a question and shows no ratio.
5. **Listen.** An ElevenLabs voice reads the explanation and the price findings in the chosen language. The app
   requests the reading while you verify, so Listen starts at once.
6. **Talk it through.** Tap the orb to talk with a private ElevenLabs agent that runs Gemini and knows the saved
   bill. It answers in 29 of the app's 31 language choices (not yet Hebrew or Thai). It shows live captions,
   highlights the line it is discussing and accepts typed questions when the room is loud. Its instructions say a
   price difference is never proof that a charge is wrong, and that it must never tell you not to pay.
7. **Act.** Prepare an editable billing-correction request or insurer appeal. Copy it, export a PDF or share it,
   and send it yourself. Footnote records a submission only when you mark it, and keeps follow-up reminders and
   notice dates on the case timeline.

Also:

- An interface in 31 language choices (30 languages, with Chinese in both scripts), with right-to-left text for
  Arabic and Hebrew. Explanations and readings come in the same 31 choices, from a backend that supports 42 locales.
- Local family profiles, a biometric app lock, a searchable insurance glossary (Guide) and manual entry.
- Voices ElevenLabs has verified for your language, wherever audio is made. Every one of the 42 locales has a
  verified default voice. 18 native-speaker voices from ElevenLabs' Voice Library fill the gaps, for example
  Finnish, Hebrew, Thai, Taiwan Mandarin, Mexican Spanish and Québec French. Each default was heard speaking its
  language and transcribed back by Scribe v2. Voice previews speak your language, and a voice chosen for one
  language never reads another.
- Live conversations about Guide glossary terms, not only about saved bills. Tap the orb on a term: the agent
  explains it in your language with an example, then answers questions. Checked live in six languages.
- Faster document reading. With Gemini's "low" thinking level, a bill and EOB took 5.3 s instead of 16.7 s in a
  30-call benchmark, with the same lines, amounts and financial fields. The backend now loads the Medicare
  reference table at startup, so the first bill after a restart took 7.7 s instead of about 21 s.
- Hear an example call. On the call-script screen, Gemini writes a short call to the billing office from the saved
  bill, and ElevenLabs Text to Dialogue (Eleven v4) performs it with two voices verified for your language. The
  script may only use the bill's own numbers, names nobody and promises nothing. With the demo bill in Spanish it
  was ready 17 s after the screen opened.
- Safer recorded questions. Scribe v2 replaces spoken identifiers (Social Security, member, account, card and
  phone numbers) with placeholders before Gemini or our database see the text. English questions also get
  insurance keyterms for better recognition. Checked live with a synthetic SSN, member ID and phone number.
- The features above were checked in the web app and through live API calls on 2026-10-11. Confirm each one on the
  demo phones before you show it there.

## Privacy and safety

Footnote is a prototype. We demo it with synthetic documents only.

- **Reading.** Imported pages and the chosen language go to our API and then to Google's Gemini API. Our
  development key was on Gemini's free tier on Oct 10 [confirm the tier before submitting]. Google's terms let it
  use free-tier inputs to improve its products and let human reviewers read them, and they ask users not to send
  personal information there.
- **Prices.** Only billing codes go to Snowflake.
- **Saving.** Our server keeps no uploaded files or recordings. It saves each analysis (the extracted details, the
  explanation and any spoken question's transcript) in a Tiger Data PostgreSQL database, so the case can be
  reopened and read aloud. Confirmed claim lines, dates and follow-up events are saved there too. The server caches
  each reading's audio on its disk, with no expiry yet.
- **Voice.** Readings and recorded questions go to ElevenLabs with its standard API logging. Its zero-retention
  mode is for Enterprise customers, and we do not have it. A recorded question's identifiers, such as Social
  Security or member numbers, are replaced by placeholders before Gemini or our database see the transcript. A
  live call sends a bounded summary of the saved bill,
  and everything said in the call, to our private ElevenLabs agent, which uses Google's Gemini. Voice recording is
  off, and ElevenLabs keeps the conversation for 7 days. The app states this under "Data use" in the orb's
  controls.
- **Keys and the device.** Provider keys stay on our server. The app gets a short-lived token for each call.
  Profiles, drafts and the original files are stored on the device. The app lock controls access; it does not
  encrypt files.
- **Not built yet.** Authentication on our API (we run it on a private network), deletion across every provider,
  expiry for cached audio, and any HIPAA or zero-retention arrangement.

Footnote prepares questions and drafts. It does not decide what you owe.

## How we built it

```
Footnote app: Expo SDK 57, React Native, TypeScript (iOS, Android, web)
   |  pages, confirmed codes, saved-analysis IDs            live audio + captions (WebRTC)
   v                                                                  |
FastAPI backend (Python) ----> Gemini API: read, explain, translate   |
   |----> Snowflake: Medicare national rate per billing code          |
   |----> Tiger Data (PostgreSQL): saved analyses, claim timeline     |
   '----> ElevenLabs: readings (TTS), questions (Scribe STT),         |
          short-lived agent tokens ---------------> ElevenLabs agent (Gemini 3.5 Flash) <-'
```

- **App.** Expo Router and Zustand. Cases are saved with AsyncStorage on phones and in browser storage on the web;
  imported files are app files on phones and IndexedDB entries on the web. Money is stored in integer cents.
  Statement amounts, EOB amounts, insurer payments and patient payments are kept apart. A remaining balance comes
  from the statement's own adjustments and payments. The EOB's figures are used for it only when Gemini reports that
  the two documents describe the same claim.
- **Gemini** (`google-genai`). We run `gemini-3.5-flash` with `gemini-3.5-flash-lite` as the fallback. Gemini
  returns structured JSON that Pydantic validates. The prompt treats each upload as its own document, keeps missing
  values null and asks Gemini to flag duplicate charges, vague fees and uncoded lines as questions. Each attempt has
  a 40-second limit.
- **Snowflake** holds 7,745 national rates from the CMS 2026 Physician Fee Schedule. Lookups send only the codes,
  time out after 15 seconds and fall back to a bundled CSV. The API response says which source answered.
- **Tiger Data** stores each analysis (`bill_analyses`, `bill_analysis_lines`), so it reopens without calling
  Gemini again. It also stores claim status, deadlines and actions. Saving never fails a request; the response says
  whether it saved.
- **ElevenLabs text-to-speech.** `eleven_flash_v2_5` by default, with number normalization on (without it, Flash
  misread "$12,345.67" in our test). It sends the language code for non-English locales and uses `eleven_v4_turbo`
  for Hebrew and Thai. Voices come from a catalog that carries ElevenLabs' verified-language metadata. Audio is cached
  on disk, keyed by the text and every setting, and served with byte ranges for iPhones.
- **ElevenLabs speech-to-text.** Scribe (`scribe_v2`) transcribes recorded questions, the fallback when a live call
  is unavailable. It gets a language hint, and a low confidence score asks the user to check the transcript.
- **ElevenLabs Agents.** One private agent with Gemini 3.5 Flash as its LLM. For each call the backend builds a
  small set of bounded variables from the saved analysis (under 12 KB in total) and issues a fresh WebRTC token. Two
  client tools, `show_line_item` and `show_price_check`, highlight existing cards in the app. The built-in
  `end_call` and `language_detection` tools are on. Speech recognition gets a short keyword list: Footnote,
  Medicare, the provider's name and, in English calls, a few billing terms. The agent is configured for 32
  languages. Typed questions use `sendUserMessage`. Calls last at most 10 minutes and end after 2 minutes of
  silence.
- **Interface translations** for 30 non-English choices were generated offline with a local NLLB model, so no
  interface text went to an online translation service. Native speakers have not reviewed them yet.
- **AI coding assistants.** We worked with Claude Code and Codex. The repo's `AGENTS.md`, task handoffs and decision
  records kept four people and their assistants working from the same facts.

## Challenges we ran into

- **Numbers are the hardest part of voice.** Flash v2.5 misread money and codes until we turned on ElevenLabs'
  number normalization. When Gemini translated the spoken price findings into Traditional Chinese, "about 30 times"
  once became 31 or 3 times. The backend now checks that a translation keeps the same digits, and drops it if not.
- **Reference data that looks wrong.** 4,043 of the 7,745 Medicare rates pay only the doctor's part of a hospital
  service. That made ordinary emergency visits look many times "too expensive". The app and the readings now turn
  those comparisons into a question, with no ratio.
- **A bill and an EOB are different documents.** Our first reading format treated separate uploads as pages of one
  document, and it had no place for most EOB amounts. We added per-file classification, separate statement and EOB
  amounts, and a check of whether the two documents describe the same claim.
- **Provider constraints we did not expect.** The configured Gemini model did not answer for our key, so we moved to
  `gemini-3.5-flash` with a fallback. ElevenLabs requires English agents to use Flash v2 or Turbo v2, so the English
  agent uses Flash v2 and the other languages use Flash v2.5. Flash v2.5 does not speak Hebrew or Thai, so those
  readings use v4 Turbo and take 12 to 18 seconds.
- **Mobile audio.** On the Android emulator, voice previews were silent because React Native's AbortSignal lacks a
  method our code used. On the iPhone, the agent stopped hearing the user after a voice preview had switched the
  audio to playback only. After we set the audio back to recording and voice chat when a call starts, it heard the
  user again.
- **Phones reaching a laptop.** On a phone, `127.0.0.1` is the phone itself. Windows blocks incoming connections on
  a "Public" Wi-Fi profile. Release builds carry the API address they were built with.
- **Nine branches from four people.** We merged the UI, the backend services, the voice agent and the languages
  work into one branch, and wrote handoffs so each step could be checked.

## Accomplishments that we're proud of

- One working journey on the web, checked end to end with synthetic documents: import, Gemini reading,
  verification, Medicare comparison, saving, an ElevenLabs reading and reopening the case.
- A live voice agent grounded in the saved bill. In a web test on Oct 10 it used the saved $3,200 CT charge and its
  $106.55 Medicare reference correctly and highlighted the matching card. It declined to call an emergency-room
  charge high when the reference covered only the doctor's part. On a physical iPhone it heard and answered spoken
  questions.
- Readings that start quickly. Flash v2.5 generated a whole 918-character explanation in 1.89 s, against 8.49 s on
  Multilingual v2, and a prepared reading starts playing in about 0.24 s.
- Full analyses with spoken replies, checked live through the API in 12 locales, including right-to-left Hebrew and
  both Chinese scripts. No native speaker has reviewed them yet.
- At our latest commit, 196 app tests, 198 backend tests and 675 voice-service tests passed; the separate web app's
  26 tests passed at the last merge.

## What we learned

- Check model and voice availability against the provider's current docs and a live call; ours changed during the
  weekend.
- A reference rate means nothing without its source, year, geography and setting.
- "Unknown" needs its own state everywhere: in the database, on the screen and in the spoken reply.
- Mobile audio sessions (playback versus recording) need explicit handling on both platforms.
- Shared written context (handoffs, decisions, API contracts) let four people and several coding assistants
  integrate quickly without overwriting each other.

## What's next for Footnote

- Match bill and EOB lines automatically (by date, code, units and amount), so repeated charges and balance gaps are
  calculated, not only flagged by the model.
- Measure accuracy on a labeled set of synthetic documents, including blurry photos, repeated lines and
  document-injection attempts, before claiming reliability.
- Better references: hospital (facility) rates, units and geography, not only national physician rates.
- Protect cloud data: per-case authorization without forcing accounts, deletion across providers, and limits on
  cached audio.
- More voice help, as candidates we have not built: read-along highlighting and a practice call with a role-play
  agent.

Details: `docs/devpost/FUTURE-IDEAS.md` in the repository.

## Built with

expo, react-native, typescript, expo-router, zustand, python, fastapi, pydantic, google-gemini, elevenlabs,
elevenlabs-agents, elevenlabs-scribe, elevenlabs-text-to-dialogue, elevenlabs-voice-library, livekit, webrtc,
snowflake, tiger-data, postgresql, cms-physician-fee-schedule, nllb, figma

## Try it out

- GitHub: https://github.com/CaspLian/claimpulse-ai (fix access and the branch first, then delete this note)
- Video: add the link if you record one

## Team (fill in names before pasting)

- Nimesh: ElevenLabs voice (readings, recorded questions, live agent), backend wiring and integration
- Aarush Kumar: the Footnote app and its design
- (name, GitHub CaspLian): Tiger Data storage and claim timeline, camera capture, multi-page reading
- (name, GitHub null-007): Gemini document reading and the Snowflake price check
