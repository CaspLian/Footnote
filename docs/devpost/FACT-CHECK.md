# Footnote: fact-check of the Devpost drafts

Checked 2026-10-11 between 06:45 and 07:15 EDT by an independent reviewer, against `Backend-Frontend-Connection-V1`
at `802f2a1` (07:11, local, 50 commits ahead of `origin`) and the event's public pages. Paths are relative to the repo
root. The branch gained three commits during the check (`2e92a11`, `d1aa47a`, `802f2a1`), so re-check the
in-progress rows against the final pushed code. No code was changed; nothing was committed or pushed.

**Status labels**

- **Built:** in the code, with a recorded run on a real path (live, browser or device), cited in the evidence.
- **Built, unverified:** in the code and tests, but no recorded run on the path the claim describes.
- **In progress:** being built on 2026-10-11, committed locally at most. Say it only with "(in progress, confirm
  before submitting)".
- **Not built:** no code.

## 1. Product claims

| # | Claim, as now worded | Status | Evidence | Change made |
|---|---|---|---|---|
| 1 | Runs on iOS, Android and the web from one Expo codebase | Built | Web journey: `docs/handoffs/claude-resume-integration.md`. iPhone release build installed and launched: `docs/handoffs/aarush-merged-v1-iphone.md`. Android: emulator only (`docs/handoffs/footnote-rebrand.md`); no physical Android record | None |
| 2 | Camera (up to 10 pages), photo picker, PDFs | Web import built; native camera built, unverified | `mobile/src/screens/camera.tsx` (10-page limit), `screens/intake.tsx`, `native/documents.ts`. Aarush reports the camera refinements "verified live" on their iPhone; no capture-to-review run is recorded | None |
| 3 | Originals stay on the device and open from verification and from each finding | Built | `screens/verify.tsx` ("View original: ..."), `screens/finding.tsx` (evidence opens `/document`), `native/documents.ts`, `native/documents.web.ts` | Replaced "available at every step" with where they open |
| 4 | Gemini reads all pages in one request, labels each file, keeps statement and EOB amounts apart | Built | `backend/services/gemini_services/gemini_service.py` (prompt), `mobile/src/services/gemini-api.ts`; live run on two synthetic images in `docs/handoffs/aarush-document-evidence-fixes.md` | None |
| 5 | A missing amount stays blank, never shown as zero | Built | `screens/verify.tsx` (`amountMissing`), `screens/review.tsx` (rows only for known amounts), `docs/handoffs/frontend-ui-v3.md` | Softened "never turns into zero" to "never shown as zero" (an internal numeric slot exists) |
| 6 | Nothing is compared until you confirm | Built | `screens/verify.tsx` ("Confirm & review"), `screens/processing.tsx` | None |
| 7 | If confirmed amounts differ from the reading, the original reading and the live call's bill copy pause | Built, unverified on a device (unit tests) | `screens/review.tsx` (`analysisChanged`), `services/voice-agent-session.ts` (`CORRECTED_ANALYSIS_TEXT`) | Reworded from "correcting an amount pauses..." |
| 8 | Statement balance, EOB responsibility and payments shown separately; EOB figures feed the remaining balance only when the documents match | Built: the extraction ran live; the review rule is unit-tested | `screens/review.tsx` (`statementRemaining`, `documentsMatch`); live extraction with `documents_match=false` in `aarush-document-evidence-fixes.md` | None |
| 9 | Questions worth asking include lines Gemini flagged (repeats, vague fees) | Built; what Gemini flags on Set A is unverified | `gemini_service.py` ("Flag things that are worth asking about..."), `screens/review.tsx` | None |
| 10 | Medicare national rates, CMS 2026 Physician Fee Schedule: 7,745 rates, 4,043 doctor-only | Built | Counted by the fact-check in `backend/data/cpt_benchmarks.csv` (7,745 rows, 4,043 `facility`); live Snowflake lookups in `aarush-voice-and-review-polish.md` | None |
| 11 | Doctor-only references become a question, with no ratio, in the app and the readings | Built | `claude-resume-integration.md` (old ER card recovered); `mobile/src/services/backend-mapping.ts`; `docs/API_CONTRACTS.md` (speak route). The backend `PriceCheck` flags are unchanged | "now become a question" scoped to the app and readings |
| 12 | Snowflake gets only codes, times out after 15 s, falls back to a CSV; the API response names the source | Built | `snowflake_service.py` (`SNOWFLAKE_TIMEOUT_S = 15`, lookup by code, cached source kept). The app always shows the same label ("Medicare national rate (CMS 2026 Physician Fee Schedule)", `backend-mapping.ts`) | "the response says" became "the API response says"; DEMO-PLAN's Snowflake fallback no longer says the app shows the source |
| 13 | Tiger Data stores each analysis and the claim timeline; saving never fails a request | Built | `analysis_store.py`, `claim_routes.py`, live HTTP checks in `claude-resume-integration.md` | None |
| 14 | Listen reads the explanation and price findings; requested early; about 0.24 s when prepared | Built on web and Android emulator; iPhone unverified | `mobile/src/native/backend-voice.tsx` (label "Listen with the ElevenLabs voice"), `docs/decisions/2026-10-10-voice-prepared-early.md`, `footnote-rebrand.md` | Scripts now use the real label (see section 4) |
| 15 | Flash v2.5 default with number normalization; "$12,345.67" misread without it; 1.89 s against 8.49 s | Built (measured) | `text_to_speech/config.py`, `backend/services/audio_service/README.md` ("Speed"), `docs/decisions/2026-10-09-tts-default-model.md` | "read in 1.89 s" became "generated in 1.89 s" |
| 16 | v4 Turbo for Hebrew and Thai, 12-18 s | Built (measured) | `config.py` (`FALLBACK_MODELS`), `docs/API_CONTRACTS.md` ("Languages") | None |
| 17 | Translated price findings must keep their digits or are dropped | Built | `docs/API_CONTRACTS.md` ("now guarded") | None |
| 18 | Recorded questions: Scribe v2, language hint, confidence check, up to 30 s, no bill attached | Built (live over HTTP); the app control is unit-tested only | `speech_to_text/config.py`, `mobile/src/native/push-to-talk.tsx` | None |
| 19 | Live agent: private, Gemini 3.5 Flash, variables under 12 KB, fresh WebRTC token, two client tools, `end_call` and `language_detection`, 10-minute cap, ends after 2 minutes of silence, 4 at a time, 60 a day | Built | `voice_agent/definition.py`, `voice_agent/bill_context.py` (`MAX_VARIABLES_BYTES = 12000`), provider read-back in `docs/handoffs/backend-voice-agent.md` | None |
| 20 | A web call used the $3,200 CT charge and $106.55 reference, highlighted the card, and declined to call the ER charge high | Built | Two web calls on 2026-10-10 (40 s and 20 s) in `claude-resume-integration.md` | "recorded web test" became "web test on Oct 10" |
| 21 | On a physical iPhone the agent heard and answered | Built | Aarush's confirmation in `aarush-voice-and-review-polish.md` and `aarush-document-evidence-fixes.md`. Caption rendering on the phone still awaits a visual check | None |
| 22 | Live calls in 29 of the app's 31 language choices; agent configured for 32 languages | Built; no non-English bill call is recorded on any device | `definition.py` (`GREETINGS`: 32 languages, no Hebrew or Thai) against `mobile/src/domain/languages.ts` (31 choices, including Hebrew and Thai) | Corrected "(32 are configured)" and DEMO-PLAN's "the agent's 32" |
| 23 | Captions, line highlight, typed questions | Built on the web; typed questions on the iPhone not recorded | `components/agent-orb-control.tsx` ("Type a question" appears only while connected), `services/agent-tools.ts` | Fallbacks rewritten (section 4) |
| 24 | The agent treats a price difference as never proof a charge is wrong, and never tells you not to pay | Built | `voice_agent/system_prompt.md` ("Guardrails") | Reworded to match the prompt |
| 25 | Speech recognition gets a short keyword list | Built | `voice_agent/session.py`: Footnote, Medicare, the provider's name, plus four billing terms in English calls | Corrected "bill-specific keywords" |
| 26 | "The app shows that notice before every call" | **Not built as stated** | The notice sits under "Data use" in the long-press sheet, collapsed by default; one tap on the orb starts a call (`agent-orb-control.tsx`, `particle-orb.tsx`). `docs/API_CONTRACTS.md` ("before Start") and `docs/handoffs/frontend-live-agent.md` describe the earlier UI | Removed from DEVPOST and DEMO-PLAN; added a pre-paste check |
| 27 | Agent privacy: private, voice recording off, 7-day retention | Built | `definition.py` (`enable_auth`, `record_voice: False`, `retention_days: 7`); `session.py` (`check_agent` before each credential) | None |
| 28 | Readings and recorded questions use ElevenLabs' standard logging; zero retention is Enterprise-only | Built (a configuration fact) | Neither ElevenLabs provider sends `enable_logging` (`text_to_speech/elevenlabs_provider.py`, `speech_to_text/elevenlabs_provider.py`). ElevenLabs' API reference: `enable_logging` defaults to true, and false (zero retention) "may only be used by enterprise customers" | Added to the privacy text |
| 29 | Our Gemini key was on the free tier on Oct 10 | Not provable from the repo | The 429 "free_tier" message is in team notes; `docs/API_CONTRACTS.md` records only an exhausted quota | Kept with a "[confirm the tier]" marker; added a paid-tier replacement sentence |
| 30 | Google's free-tier terms allow product improvement and human review, and ask users not to send personal information | Verified | https://ai.google.dev/gemini-api/terms ("Do not submit sensitive, confidential, or personal information to the Unpaid Services") | Added the last point |
| 31 | The server keeps no uploads or recordings; it saves analyses (with transcripts) and caches reading audio with no expiry | Built | `backend/main.py` (no file writes), `speech_to_text/service.py` (transcript cache "memory only"), `docs/API_CONTRACTS.md` (tables), `docs/handoffs/backend-follow-ups.md` ("no expiry") | None |
| 32 | Profiles, drafts and original files are stored on the device; the app lock is not encryption | Built | `mobile/src/store/index.ts` (AsyncStorage), `store/index.web.ts` (localStorage), `native/documents.ts`, `components/privacy.tsx` | "stay on the device" became "are stored on the device", since files also go to Gemini |
| 33 | "AsyncStorage on phones and IndexedDB on the web" | **Partly wrong** | Cases: AsyncStorage on phones, localStorage on the web. IndexedDB holds only web document files (`native/documents.web.ts`) | Corrected |
| 34 | No API authentication; run on a private network | Not built (stated correctly) | `docs/API_CONTRACTS.md` ("Conventions"), `docs/decisions/2026-10-10-proposal-app-key.md` | None |
| 35 | Billing correction or insurer appeal; copy, PDF, share; "Mark submitted" | Built, unverified (unit tests; no recorded run of the mobile draft screen) | `screens/draft.tsx` | None; rehearse it before showing it |
| 36 | Follow-up reminders and notice dates on the timeline; no system notifications | Built (claim routes live over HTTP; reminders local) | `claim_routes.py`, `screens/timeline.tsx`, `PRODUCT.md` | None |
| 37 | Interface in 31 language choices (30 languages, Chinese in both scripts), offline NLLB, no native review | Built | `domain/languages.ts`, 30 non-English catalogs in `mobile/src/localization/`, `aarush-camera-localization-search.md` | "31 languages" became "31 language choices (30 languages)" |
| 38 | Right-to-left for Arabic and Hebrew | Built as right-to-left text, not a mirrored layout | `localization/translate.ts` (`languageDirection`), `components/ui.tsx` (`writingDirection`) | "layout" became "text" |
| 39 | "Explanations and readings in 42 locales" | **Backend only** | The app sends one locale per choice, 31 of the 42 (`domain/languages.ts`, `services/backend.ts` `backendLocale`); Spanish is `es-ES`, Portuguese `pt-PT` | Corrected in all four files |
| 40 | 12 locales checked live with spoken replies | Built, through the API | `docs/PROJECT_CONTEXT.md`; 9 of the 12 are app choices | Added "through the API" |
| 41 | Family profiles, biometric lock, searchable Guide, manual entry | Built | `screens/profiles.tsx`, `components/privacy.tsx`, `screens/guide.tsx`, `screens/intake.tsx` ("Enter details manually") | "manual entry when the app is offline" became "manual entry" |
| 42 | Voices verified for the language everywhere audio is made; a verified default per language; previews in that language; Voice Library voices | In progress | Committed locally at `2e92a11`; backend checks (235 clips transcribed back) in `docs/decisions/2026-10-11-native-voices-and-guide-conversations.md`. The picker's verified-language filter alone predates today (`git show 7dead79:mobile/src/services/voice-catalog.ts`, `voicesForLocale`) | "Native-accent" became "verified for your language": verification proves the language, not a native accent, and several defaults are voices with other native accents (`voices.json` `language_defaults`) |
| 43 | Live conversations about Guide terms | In progress | `2e92a11`: `voice_agent/session.py` (term branch), `definition.py` (`GUIDE_OPENERS`), `screens/term.tsx`; backend answers in 6 languages in 1.3-1.8 s | None |
| 44 | Faster reading: bill and EOB in 5.3 s instead of 16.7 s, same extraction | In progress | `d1aa47a`: `gemini_service.py` (thinking level "low" by default); numbers from the commit message's 30-call benchmark, whose script is not in the repo | Added with its marker |
| 45 | Recorded questions: identifiers redacted before Gemini and the database; English insurance keyterms | In progress | `d1aa47a`: `speech_to_text/config.py` (`DEFAULT_REDACTED_ENTITIES`, `DEFAULT_KEYTERMS`); one live check in the commit message | Added with its marker; FUTURE-IDEAS #4 updated |
| 46 | Example call with ElevenLabs Text to Dialogue | In progress | `802f2a1`: `backend/services/audio_service/example_call.py`, `mobile/src/native/example-call.tsx`, `screens/call-script.tsx`; live English and Mexican Spanish runs (15-21 s) in the commit message | Added with its marker; FUTURE-IDEAS #2 updated |
| 47 | Realistic demo documents (Set A) | In progress | `demo/documents/` (untracked); at 06:52 each PDF had 3 pages; planned findings in `ground-truth.json` | Live capture cut to two pages |
| 48 | Read-along highlighting; practice-call agent | Not built (candidates) | None | None |
| 49 | Tests: 196 app, 198 backend (2 skipped), 675 voice at `802f2a1`; 26 web at `3ad973c` | Reported in commit messages; not rerun by the fact-check | `git log` | Updated from 191/182/649 |
| 50 | First commit after hacking began | Verified | `3a561e2`, 2026-10-09 12:51:23 -0400 | None |
| 51 | Local commits not yet pushed | Verified | 50 at 07:12 (`git rev-list --count origin/Backend-Frontend-Connection-V1..HEAD`) | Updated from 47 |
| 52 | Repo private; `main` is the day-one skeleton | Verified | `gh repo view` (PRIVATE, default `main`); `origin/main` at `8c1a321` | None |
| 53 | iPhone build compiled with `http://192.168.1.28:8000` (the Mac) | Documented, not rechecked | `aarush-merged-v1-iphone.md`; `aarush-camera-localization-search.md` (the phone backend "still runs on the Mac's LAN address") | None |
| 54 | Team roles | Verified from git authors | `git log --all` at 07:15: Nimesh 51 commits; CaspLian (also "Megacrunch3000") 12, including repo setup, `Tiger-data`, `Camera-capture` and multi-photo reading; Aarush Kumar 10; null-007 4 (Gemini step, Snowflake check, timeouts, letter route) | Added CaspLian's camera and multi-page work |
| 55 | The agent was re-provisioned with a prompt that uses `guide_topic` | Verified | `git diff 7dead79 2e92a11 -- backend/services/audio_service/voice_agent/` and the `2e92a11` message | Added a DEMO-PLAN check: older backends do not send it |

## 2. Event facts

Re-checked 06:48-07:00 EDT. hackknight.org is a single-page app; its content comes from
`https://api.hackknight.org/api/judges`, `/api/schedule`, `/api/sponsors` and `/api/settings`, and the FAQ is in its
site code.

| Fact | Status | Source |
|---|---|---|
| Deadline Oct 11, 2026 @ 12:00pm EDT; "Queens College - Dining Hall" | Confirmed | Devpost overview |
| Hacking began Fri Oct 9, 12:00 PM | Confirmed | Devpost rules; site schedule |
| Judging 12:30 to about 2:30-3:00 PM (Devpost) or 12:30-3:00 PM (site); closing about 3:30-4:00 PM in Rosenthal Library (Devpost) or 3:00-4:00 PM (site) | Confirmed; the sources differ | Devpost rules; `/api/schedule` |
| "Live demo required to win a track (science fair style)" | Confirmed | Devpost overview and rules |
| Code via GitHub; "any code pushed past the deadline or before the start of the hackathon will be disqualified" | Confirmed | Devpost |
| Video only for hardware projects | Confirmed | Devpost "What to Submit" |
| Teams of 2-4, in-person check-in, Discord membership, current or recent students, no work before the start | Confirmed | Devpost rules; site FAQ |
| 13 non-cash prizes, as listed in DEVPOST.md; Best Overall includes 3 months of ElevenLabs Pro; the ElevenLabs track adds earbuds and 3 months of ElevenLabs Scale | Confirmed | Devpost overview |
| Tiger Data prize asks for "performance-driven use"; Snowflake prize centers on LLMs through its REST API | Confirmed | Devpost overview |
| Criteria: Creativity, Completeness, Presentation, Alignment With Track, Design (overview); Creativity, Alignment with Track, Completeness (rules); MLH rules weigh Technology, Design, Completion and Learning equally | Confirmed | Devpost; MLH rules |
| Themes Beginner Friendly, Fintech, Health; 262 participants | Confirmed | Devpost overview |
| Sponsors: Bloomberg Platinum; ElevenLabs and Diameter Capital Gold; WAGMI-Connect Silver | Confirmed | `/api/sponsors` |
| Judges: 13 on Devpost and 13 on the site. Nick Pisciotta only on Devpost; Angel (Kerlyn) Difo only on the site; the site shows no company for Raja Sharma and Diego Perez | Confirmed | Devpost overview; `/api/judges` |
| The site lists no tracks or prizes; its FAQ says prizes "will be announced soon" | Confirmed (new) | site code |
| MLH's prize page adds a "DEV Writing Challenge" ($100), not on Devpost | Confirmed (new) | mlh.com prizes page |
| MLH guide: judges "only have 3 minutes per team"; 2 minutes of presentation and demo in a 4-minute slot; at least 3 visits per project | Confirmed; wording corrected | guide.mlh.com judging plan |
| Devpost blog: problem "in a few sentences", demo "the most important part", "Skip mundane flows such as creating user credentials" | Confirmed; the draft's "most of the time on the product" was not in the article | info.devpost.com |
| JetBrains, kipply and ElevenLabs blog quotes | Confirmed | the three pages |
| Every cited URL resolves | 22 of the 23 public links return HTTP 200. The bare `api.hackknight.org/api/` returns 404, so DEMO-PLAN now cites the endpoints. The GitHub repo link was not counted: it is private, so a logged-out judge gets 404 | curl |

Still unknown: judges per table and minutes per visit, who judges the MLH tracks and whether ElevenLabs staff attend,
how many prizes one project may select, Dining Hall Wi-Fi isolation and table power.

## 3. Script timing (150 words a minute)

| Script | Draft | Now | Fits? |
|---|---|---|---|
| 15-second hook | 61 words, 24 s | 38 words, 15 s | Yes |
| 30-second intro | 101 words, 40 s | 72 words, 29 s | Yes |
| 90-second table demo | 175 words, but the review row had 62 words (25 s) in a 20 s slot, the closing row 25 words (10 s) in 5 s, and the capture assumed two pages of a six-page set | About 135 words including spoken amounts (54 s), plus about 12 s of agent speech; every row fits its slot | Yes |
| 3-minute script | 234 words; the architecture row had 44 words (18 s) in 15 s; two spoken exchanges plus a typed question needed about 50 s in a 40 s slot | 209 words (84 s); one spoken and one typed exchange; video cuts the Gemini and 6-second review waits | Yes |
| 2-minute cut | Not timed | 40 + 10 + 30 + 20 + 15 + 5 = 120 s | Yes |

Counts come from the quoted text in each table's "Says" column, with [Set B] alternatives counted separately.

## 4. Demo moves checked against the app

| Move in the scripts | What the app has | File | Result |
|---|---|---|---|
| Home camera shortcut | Floating camera button, label "Photograph a bill" | `components/camera-shortcut.tsx`, `screens/home.tsx` | OK |
| "Capture image", "Add another", "Use photo(s)", "Photos" | Same labels; "Add another" disabled at 9 captured | `screens/camera.tsx` | OK |
| "Use this document" / "Use these documents" | Same | `screens/confirm-documents.tsx` | OK |
| "Understanding your documents", "Document details ready", "Check the details", "Try again" | Same | `screens/understanding.tsx` | OK |
| "Check before you continue.", "View original", "Add another amount", "Confirm & review" | "Add another amount" appears only after "More amounts & adjustments" | `screens/verify.tsx` | Script corrected |
| From "Confirm & review" to the review | "Reviewing your bill" lasts at least 6 s with a backend, then "Open my review" | `screens/processing.tsx` | Added to the 3-minute script |
| "Bill summary", "Prepare request" | Same | `screens/review.tsx` | OK |
| "Listen to the explanation" | Not reachable: only in `components/listening-control.tsx`, which no screen uses. The review's button is "Listen with the ElevenLabs voice" | `native/backend-voice.tsx` | Corrected everywhere |
| A finding's source and price | "Source evidence" and "Comparison reference" | `screens/finding.tsx` | Script names them |
| Orb: tap to start, tap to mute, double-tap to end, long-press for "Talk it through" | Same; the sheet has "End conversation", "Mute microphone", "Captions", "Choose voice", "Type a question" (only while connected), "Send question", "Minimize orb", "Data use" | `components/agent-orb-control.tsx`, `components/particle-orb.tsx` | Fallbacks corrected: typing needs a connected call |
| "Ask a recorded question" | Same; 30 s; no bill | `native/push-to-talk.tsx` | OK |
| "Billing correction", "Share PDF", "Mark submitted" | Same; on the web "Print / save PDF"; also "Open timeline" and "Open call script" | `screens/draft.tsx` | OK |
| "Play the example call" (in progress) | "Hear an example call" card on the call-script screen | `native/example-call.tsx`, `screens/call-script.tsx` | Added as an optional, marked beat |
| "Connected to Footnote" / "Connected · Document reading unavailable" | Same | `screens/settings.tsx` | OK |
| "Delete test clutter" | "Delete imported cases" removes every imported case on the device | `screens/settings.tsx` | Checklist now clears before seeding |
| A Spanish call on the iPhone | The call uses the phone's working language, which also sets the whole interface; the app's Spanish is `es-ES` | `components/agent-orb-control.tsx`, `domain/languages.ts` | Cast and station notes added |
| Live capture of Set A | 3 + 3 pages as built; six phone photos can pass the 15 MB upload limit | `demo/documents/out/`, `screens/camera.tsx` | Capture cut to two pages |

## 5. Edits made

**DEVPOST.md**

- Header and checklist: the commit checked (`802f2a1`), 50 unpushed commits at 07:12, a check for the live-call
  privacy note, a paid-tier replacement sentence, and the MLH DEV Writing Challenge note.
- Prize table: the agent's Gemini runs on ElevenLabs, not our API key; GoDaddy needs a registered domain.
- Tagline: "talks you through them in your own language" became "explains them aloud in 30 languages" (161
  characters).
- What it does: shorter sentences; originals, zero amounts, confirmation pausing, review rows and agent rules
  reworded to match the code; "32 are configured" became "29 of the app's 31 language choices"; the language line
  now separates the app's 31 choices from the backend's 42 locales; "right-to-left layout" became "text".
- In-progress lines: "native-accent" became "verified for your language"; faster reading, the example call and
  recorded-question redaction added, each marked.
- Privacy: split into labeled items; removed "the app shows that notice before every call"; added ElevenLabs'
  standard logging, Google's request not to send personal information, the audio cache's missing expiry, and the
  in-progress redaction sentence.
- How we built it: storage corrected; the keyword list described exactly; the 32-language agent separated from the
  29 the app reaches.
- Challenges: the Android finding is from the emulator; the iPhone audio fix worded as observed, not as a proven
  cause.
- Accomplishments and team: current test counts; "web test on Oct 10"; CaspLian's camera and multi-page work.
- What's next: the example call left the "not built" list.

**PITCH-AND-SCRIPT.md**

- Every script retimed and trimmed (section 3); word counts in each heading.
- Set A: three pages per document, photograph two live, planned issues named, placeholders for the amounts.
- Real button labels throughout; fallbacks now distinguish "no greeting" from "no answer".
- Cast: the iPhone's working language and a plan when only one teammate speaks the demo language.
- Answers 1, 2, 4, 6, 7 and the language answer corrected (data flow, 31 choices, 29 for live calls, in-progress
  list); new "words to avoid" rows for accents and the example call; judge-answers staleness list updated.

**DEMO-PLAN.md**

- Event facts: quotes from the MLH and Devpost guides corrected; site and MLH-page facts added; API endpoints cited.
- Timeline: a safety push at the 9:45 freeze; the backend must run current code because the agent was re-provisioned;
  `npx expo prebuild --clean` before the Android build; a live call from each device.
- Device table: in-progress rows added; the bill-call language row narrowed; a `footnote.compare` install starts
  empty.
- Stations, language choice and rotation: two-page capture, 29 live-call languages, `es-ES`, the working-language
  rule, and the V rotation fix.
- Noise plan, fallbacks and checklist: real labels; Snowflake and Tiger Data triggers that the app actually shows;
  "Type a question" needs a connected call; clear imported cases before seeding; the 60-calls-a-day cap; Metro for
  an Android development build; admin rights for the hotspot profile; example-call and price warm-up notes.
- Tailoring: the security row points to "Data use"; the ElevenLabs row lists in-progress features with markers;
  "right-to-left text".
- Speeds and tests: in-progress measurements added with markers; streaming marked as unused by the app; test counts
  updated.

**FUTURE-IDEAS.md**

- #1: ElevenLabs does document a streaming version with timestamps.
- #2 and #4: status lines for the example call and keyterms (in progress, confirm before submitting).
- #6: language counts corrected. Intro: "language-verified voices".

## 6. Open questions for the team

1. **Gemini tier.** Is billing enabled on the key now? Pick the matching privacy sentence in DEVPOST.md.
2. **GitHub access.** Public after a full-history secret scan, or organizer guidance for a private repo? Which branch
   will the link name, and will it be merged into `main`?
3. **Backend host and network.** Which machine hosts the backend at the venue? The iPhone build points at the Mac
   (`192.168.1.28`). A backend on older code, such as `merged-v1`, sends no `guide_topic`; a live check at 07:25
   showed such a bill call still starts and answers correctly, but Guide-term calls need `2e92a11` or later. Test a
   call through every backend you use.
4. **Privacy notice.** Should the app show the ElevenLabs notice before the first call, as the API contract and the
   earlier handoff describe? Today it is only under "Data use". This is a code decision for the app owner, then
   update DEVPOST.md.
5. **Android phone.** Development build (needs Metro on port 8081) or release build? Which API address was it built
   with? Nothing on the physical phone is recorded yet.
6. **Set A.** Which two pages will C photograph? Will the morning copy be read from the PDFs (1.3 MB together) or from
   six photos, which can pass the 15 MB limit? Which findings did Gemini actually show in rehearsal?
7. **Demo language.** Who speaks Spanish (Spain's Spanish in the app), or which of the 29 live-call languages will V
   use? Does that person stay V all afternoon?
8. **Call budget.** About how many live calls will rehearsal and judging use? The agent stops at 60 a day unless the
   limit is raised in the ElevenLabs dashboard.
9. **In-progress items.** Which of these ship and get checked on the phones by 9:45: verified voices, Guide calls,
   faster reading, recorded-question redaction and keyterms, the example call, Set A? Each needs a rebuild of the
   phone apps except the backend-only ones (faster reading, redaction).
10. **Draft screen.** No run of "Share PDF" or "Mark submitted" on a device is recorded. Rehearse them before showing
    them.
11. **Devpost details.** How many prize categories can be selected? Who are the two team members listed only by
    GitHub name? Is the team eligible for Best Beginner Hack?
12. **Judging.** How many judges visit each table and for how long, who judges the MLH tracks, and will ElevenLabs
    staff be there? Ask at the MLH table.

## 7. Sources consulted

- Repo: `README.md`, `PRODUCT.md`, `docs/PROJECT_CONTEXT.md`, `docs/PROJECT_STATUS.md`, `docs/API_CONTRACTS.md`,
  `docs/IOS_TESTING.md`, `docs/judge-answers-20261010.md`, all of `docs/handoffs/` and `docs/decisions/` (including
  the new `2026-10-11-native-voices-and-guide-conversations.md`), `backend/services/audio_service/README.md`,
  `voice_agent/definition.py`, `session.py`, `bill_context.py`, `limits.py`, `system_prompt.md`, `gemini_service.py`,
  `snowflake_service.py`, `speech_to_text/` and `text_to_speech/` providers and configs, `backend/main.py`, the
  screens in `mobile/src/screens/`, `components/agent-orb-control.tsx`, `particle-orb.tsx`, `camera-shortcut.tsx`,
  `document-import.tsx`, `privacy.tsx`, `native/backend-voice.tsx`, `push-to-talk.tsx`, `example-call.tsx`,
  `domain/languages.ts`, `services/backend.ts`, `backend-mapping.ts`, `voice-agent-session.ts`, `store/`, `demo/documents/`,
  and `git log` for commits `2e92a11`, `d1aa47a` and `802f2a1`.
- Event: https://hack-knight-fall-2026.devpost.com/ and its `/rules` and `/resources` pages; https://hackknight.org/
  and its API endpoints above; https://www.mlh.com/events/hack-knight-3d/prizes;
  https://github.com/MLH/mlh-hackathon-rules/blob/master/Rules.md;
  https://guide.mlh.com/general-information/judging-and-submissions/judging-plan.
- Providers: https://ai.google.dev/gemini-api/terms; ElevenLabs API reference pages for text to speech (and with
  timestamps), text to dialogue, speech to text, and dynamic variables; https://elevenlabs.io/docs/llms.txt.
- Guidance quoted in DEMO-PLAN.md: the Devpost, JetBrains, kipply and ElevenLabs blog posts; CMS, IRS and CMS
  dispute-resolution pages cited in FUTURE-IDEAS.md.
