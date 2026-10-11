# Footnote: pitch and demo scripts

Written 2026-10-11 for Hack Knight Fall 2026, where judging is "science fair style" in the Dining Hall from 12:30 PM
to about 3:00 PM ([Devpost rules](https://hack-knight-fall-2026.devpost.com/rules)). Fact-checked against the repo
at `802f2a1` (07:12); evidence is in [FACT-CHECK.md](FACT-CHECK.md). Anything marked **(in progress, confirm before
submitting)** was still being built on 2026-10-11: say it only if it works on the demo devices and was pushed before
12:00 PM. The station layout, roles and fallbacks are in [DEMO-PLAN.md](DEMO-PLAN.md).

**Timing.** Every script is timed at about 150 spoken words a minute (2.5 words a second). Each table gives its word
count. Say amounts the short way ("thirty-two hundred dollars"). Button names in quotes are the app's English labels.

## Cast

| Code | Role | Device |
|---|---|---|
| P | Presenter: talks to the judge, adapts the story | none (holds the printed bill and EOB) |
| C | Capture driver | Android phone on a stand over the printed documents |
| V | Voice driver | iPhone, with the same case read in the demo language |
| E | Evidence and operations | Laptop: web app, architecture and proof tabs; watches the backend |

With only two people at the table, P also drives C, and E also drives V. On the iPhone the working language must be
the demo language, so its whole interface is in that language. If only one teammate speaks it, that person stays V,
or V reads the question from an index card.

## Rules for every sentence

- Say "today" for what runs and "we plan" for the future.
- Answer in three steps: the direct answer, how it works, the limit. Stop after two sentences unless asked for more.
- Point at the screen instead of describing it. Let the judge hold the paper and ask the agent a question.
- Never say a charge is wrong, that someone is overcharged, that they will save money, or that they do not owe.

## The sentence to remember

**"Footnote reads your medical bill and EOB with you, checks each coded charge against Medicare's national rate,
and talks you through it in your language."** (25 words, about 10 seconds)

## Two document sets

- **Set A, the demo set:** a 3-page itemized statement from the fictional Linnet Valley Medical Center and the
  matching 3-page EOB from the fictional Pellridge Health Plan, in `demo/documents/out/` (final files once their
  review finishes). Read from the two PDFs in the web app on 2026-10-11 (Spanish), the review showed every planted
  issue: the statement asks $1,563.35 while the EOB says the patient's share is $808.85 (a $754.50 gap); the
  metabolic panel (80053, $268.00) appears twice and the EOB denied the repeat; $486.50 of miscellaneous supplies
  with no code that the EOB bundled (remark CO-97); IV and CT charges at 12-14 times Medicare's national rate; and
  the ER facility charge (99284) with a doctor-only reference. Photograph only two pages live (the bill's itemized
  charges and the EOB's claim detail); six photos are too slow at a table and can pass the 15 MB upload limit. Script
  only what the review shows in three rehearsal runs in a row on the phones.
- **Set B, the proven set:** `backend/samples/sample_bill.png`, a synthetic Metropolitan Medical Center bill. It has
  a CT head scan (70450) at $3,200, an ER visit (99284) at $1,200 and a $450 facility fee with no code: $4,850 total,
  $1,940 balance due. It was read correctly in live tests. In a live web conversation the agent used its $3,200
  charge and $106.55 Medicare reference correctly. It declined to call the ER charge high, because that reference
  covers only the doctor's part.

Lines below give the Set A wording first and the Set B wording in brackets.
If Set A is not ready and rehearsed by 10:30, use the Set B wording everywhere. Fill each [placeholder] from the
morning reading.

## 15-second hook (38 words, about 15 seconds)

| Time | Who | Says | In hand / on screen |
|---|---|---|---|
| 0-6 s | P | "A hospital bill, and the insurance letter for the same visit. They ask for different amounts." [Set B: "This bill charges $3,200 for a CT scan, and one fee has no code."] | Holds up the printed bill and EOB. All three screens show Footnote, not a terminal. |
| 6-13 s | P | "Footnote reads both with you, checks each coded charge against Medicare's rate, and explains it in your language." | Gestures across the three devices: camera, laptop, voice. |
| 13-15 s | P | "Want to try it?" | Hands the paper to the judge. |

## 30-second introduction (72 words, about 29 seconds)

For a judge who wants the overview before the demo, or for the line waiting at the table.

| Time | Who | Says | On screen |
|---|---|---|---|
| 0-9 s | P | "Bills and insurance letters arrive separately, with different totals and billing codes. That's hardest when English is your second language." | Laptop: the review of the demo case, with the original document. |
| 9-20 s | P | "You photograph the pages, Gemini reads them, and you confirm each value. Snowflake looks up Medicare's rate for each code, and Tiger Data saves the case." | Android: the camera screen, "Photograph bill". |
| 20-30 s | P | "ElevenLabs reads it aloud, and a live ElevenLabs agent answers questions about your bill in your language. A difference is a reason to ask, not proof." | iPhone: the orb with captions. |

## 90-second table demo (about 135 team words with the amounts, 54 seconds of speech, plus the agent's reply)

The default version for any judge. Start the live reading early so nobody waits on it, and show the morning copy of
the same documents while Gemini works. Rehearse it on the real devices and network three times in a row before
12:00 PM.

| Time | Who | Says | Does / on screen | If it stalls |
|---|---|---|---|---|
| 0:00-0:12 | P | "A hospital bill and the insurance letter for the same visit. They ask for different amounts. Footnote reads them with you, in your language." [Set B: "A hospital bill: $3,200 for a CT scan, and a fee with no code. Footnote reads it with you, in your language."] | Paper in the judge's hands. | |
| 0:12-0:32 | P, C | P: "Let's read the pages you're holding." | Android: the Home camera button, "Capture image" (the bill's charges page), "Add another", "Capture image" (the EOB's claim page), "Use photos", then "Use these documents" [Set B: one page, "Use photo", then "Use this document"]. The screen shows "Understanding your documents". | Camera won't open: C taps "Photos" and picks the same pages, photographed this morning. |
| 0:32-0:44 | P | "Gemini is reading both pages now. It labels the bill and the EOB, leaves missing amounts blank, and you confirm each value first." | E turns the laptop: the review of the same documents, read this morning, with the original. | Reading past 25 s: "It's still reading. This is the same paper, read this morning." Carry on with the laptop. |
| 0:44-1:04 | P, E | "The statement asks for [statement balance]. The EOB says your share is [EOB amount]. Footnote puts them side by side. This lab test appears twice. Each code is also checked against Medicare's national rate: a big difference is a reason to ask, not proof." [Set B: "The CT scan is about 30 times Medicare's national rate. That's a reason to ask for an itemized bill, not proof. The ER visit's reference covers only the doctor's part, so Footnote asks a question and shows no ratio."] | E opens one finding to show its "Source evidence", then a price finding's "Comparison reference". | Show only the findings that appeared in rehearsal. |
| 1:04-1:24 | V | "You can also just ask. This copy is in Spanish." After the Spanish greeting: "¿Por qué me cobran dos veces [nombre del cargo repetido]?" [Set B: "¿Por qué la tomografía cuesta tres mil doscientos dólares?"] | iPhone: V taps the orb once. The agent greets, then answers; captions stream above the orb, and a matching card may highlight. V taps the orb again to mute. | Greeting but no answer in 8 s: long-press the orb, "Type a question", "Send question". No greeting in 8 s: tap "Listen with the ElevenLabs voice". |
| 1:24-1:30 | P, C | P: "Prepare request drafts the letter; you send it yourself." C: "Your page, read just now." | Android: "Document details ready", then "Check the details" and "View original". | Fresh reading failed: say so plainly and show "Try again". |

Then offer the iPhone: "Ask it anything about this bill." Tap the orb to unmute for the judge. An English question
should switch the agent to English through its language detection; rehearse that once.

## 3-minute stage or video script (about 210 words, 84 seconds of speech)

For a finalist round, a sponsor who asks for "the full version", or the backup recording. Record the video on the
final pushed build, with synthetic documents and no keys, terminals or notifications on screen. Record each segment
on the device that passed rehearsal for it (DEMO-PLAN.md, section 3). Open with a title card reading "Footnote, Hack
Knight Fall 2026". In a video, cut the waits for Gemini and for "Reviewing your bill" (at least 6 seconds).

| Time | Who | Says | On screen |
|---|---|---|---|
| 0:00-0:15 | P | "Medical bills and insurance letters arrive separately, show different totals for the same visit, and describe care in codes. Footnote reads them with you and talks you through them in your language." | Close-up of the printed bill and EOB side by side. |
| 0:15-0:40 | C | "I photograph two pages in the app. Footnote sends them together. Gemini reads them and labels each one." | Android screen recording: "Photograph bill", two captures, "Use photos", "Use these documents", "Understanding your documents", "Document details ready". |
| 0:40-1:00 | C | "Before anything is compared, I check each value against the original. Anything not printed stays blank." | "Check the details", "Check before you continue.", "View original", "More amounts & adjustments" (blank amounts stay blank), "Confirm & review", "Open my review". |
| 1:00-1:30 | P | "The review keeps the statement's amounts and the EOB's amounts apart, and turns the differences into questions. Each billing code is looked up in a Snowflake table of Medicare's 2026 national rates. When the reference covers only the doctor's part, Footnote asks a question instead of showing a ratio." | "Bill summary": statement balance, EOB responsibility, a question worth asking, a price finding. |
| 1:30-1:45 | V | "Listen reads it aloud with an ElevenLabs voice, in Spanish. It was prepared while I checked the details." | Review, "Listen with the ElevenLabs voice": about 7 seconds of the Spanish reading, then stop it. |
| 1:45-2:25 | V | One spoken exchange in Spanish, for example "¿Qué le pregunto a la oficina de facturación?" Then one typed question, to show the quiet-room option. In the video, subtitle the answers in English. | iPhone recording: the orb, streaming captions, a highlighted card; then long-press, "Type a question", "Send question". |
| 2:25-2:40 | P | "Prepare request writes an editable billing correction or insurer appeal. You send it yourself. Footnote records it when you mark it, and keeps a follow-up date." | "Prepare request", "Billing correction", "Share PDF", "Mark submitted", "Open timeline", a reminder date. For an ElevenLabs judge, if the example call shipped (in progress, confirm before submitting), swap this beat: P says "Not sure what to say on the phone? Two ElevenLabs voices act out an example call, written from your bill." (20 words, 8 s), then "Open call script" and 6 seconds of "Play the example call". |
| 2:40-2:55 | P | "Gemini reads the documents and runs the agent. Snowflake holds the Medicare references. Tiger Data saves each case. ElevenLabs speaks, listens and holds the live conversation. We use synthetic documents only." | Architecture card (DEMO-PLAN.md, laptop tab 2). |
| 2:55-3:00 | P | "Footnote: understand the bill, ask the right question, in your language." | Footnote asterisk and name. |

**2-minute cut** (if a video limit applies): 0:00-0:40 as above, verification in 10 seconds, the review (30
seconds), one Spanish exchange (20 seconds), the architecture line (15 seconds) and the closing line (5 seconds).
Leave out Listen and the request.

## Answers to the 8 most likely questions

Direct answer, then how it works, then the limit. "Show me" points to proof on the table.

**1. Isn't this ChatGPT or Gemini with a camera?**
We use Gemini too. Footnote adds the case around it. You confirm every value against the original, prices come from
a reference table rather than the model, and the case, letter and follow-ups are saved so you can continue tomorrow.
Show me: "View original" in verification, then a finding's "Comparison reference".

**2. Does a high ratio mean I was overcharged?**
No. Medicare's national rate is what Medicare pays, not a fair hospital price or your insurer's contract. 4,043 of
our 7,745 reference rates cover only the doctor's part, so for those we show no ratio. A difference is a reason to
ask for an itemized bill.

**3. How do you know the reading is right?**
We don't assume it is. Gemini returns structured fields that we validate, blanks stay blank, and you confirm each
value before anything is compared. We have not measured accuracy on a labeled document set yet; that is next.

**4. Where does my data go?**
Pages go to Gemini for reading, and only billing codes go to Snowflake. The analysis is saved in Tiger Data. Live
calls go to our private ElevenLabs agent, which keeps them 7 days with voice recording off; readings and recorded
questions use ElevenLabs' standard logging. Keys stay on our server. The API has no user authentication yet, so we
run it on a private network with synthetic documents only.

**5. Why Snowflake and Tiger Data? Couldn't one Postgres do it?**
Yes, at this size. We kept the shared reference data (Medicare rates, looked up by code only) apart from each
person's case data (saved analyses and timelines). We would keep both in production only if a measured need
justified it.

**6. How does the voice agent know my bill, and can it make things up?**
For each call the backend builds a bounded summary of the saved analysis, under 12 KB, and issues a fresh
short-lived token for a private ElevenLabs agent running Gemini 3.5 Flash. The prompt treats bill text as data, keeps
amounts exactly as listed and says a price difference is never proof that a charge is wrong. Its two app tools only
highlight cards on screen. It can still be wrong, so the numbers on screen are the source of truth.

**7. What did you build this weekend, and what isn't done?**
All of it: the first commit is from Friday, after hacking began. Working today: photo and PDF reading,
verification, the Medicare comparison, saved cases, readings in the app's 31 language choices (9 of them checked
live), live conversation, letters and the timeline. Not done: authentication, accuracy measurement, native-speaker review and a hosted
deployment. Mention an in-progress item only if it shipped: language-verified voices, Guide conversations, faster
reading, the example call and identifier redaction in recorded questions (in progress, confirm before submitting).

**8. What happens when something is slow or fails?**
Each Gemini attempt has a 60-second limit. A slow, busy or malformed answer is retried, then a lighter fallback
model is tried. Snowflake falls back to a bundled copy, and the API response says so. A failed save never breaks the
analysis, and readings are cached. Measured: a 918-character reading took 1.89 s to generate on Flash v2.5, and a
prepared reading starts in about 0.24 s.

If asked: "Is it HIPAA compliant?" No, and we don't claim it; that needs a legal review and provider agreements.
"How would it make money?" We have not measured the cost of a finished case yet. We would price above that, and our
untested guess is per case rather than a subscription. "Do all languages work?" The app offers 31 language choices
for its interface, explanations and readings, and the backend supports 42 locales. 12 locales were checked live
through the API. Live calls work in 29 of the app's choices. No native speaker has reviewed them.

## Words to avoid

| Avoid | Say instead |
|---|---|
| "It finds overcharges" or "it saves you money" | "It shows what's worth asking about." |
| "The fair price" or "what you should pay" | "Medicare's national reference rate." |
| "Everything stays on your phone" | "Profiles and drafts stay on the phone; reading, saving and voice use the services I described." |
| "Secure", "HIPAA compliant", "anonymous" | "Keys stay on the server; there's no user authentication yet; a bill can identify you even without an account." |
| "Works in 42 languages" without qualification | "31 language choices in the app, 42 locales in the backend, 12 checked live, no native-speaker review yet." |
| "Native accent in every language" | "Voices ElevenLabs has verified for that language." (in progress, confirm before submitting) |
| "It predicts what billing will say" (about the example call) | "It shows how a calm call could go, from your bill's facts." (in progress, confirm before submitting) |
| "It knows your deductible" | "It uses only what the documents show." |
| "It files the appeal" | "You send it; Footnote records it when you mark it." |
| "Real time", "instant" | The measured numbers above. |
| "Time-series" or "immutable logs" about Tiger Data | "Ordinary PostgreSQL tables for saved cases and a timestamped timeline." |

## Out of date in docs/judge-answers-20261010.md

That file (written for the earlier name, Unfold) is still useful, but these answers are stale. Use the versions
above.

- Answer 29 and the "live agent" row of its first table call the live agent "planned". It is built: verified in a
  web test on 2026-10-10, and Aarush confirmed on 2026-10-11 that it hears and answers on their iPhone.
- Answer 43 says the interface labels are English and the backend lists 12 languages. The interface now has 31
  offline-translated language choices, and the backend serves 42 locales.
- Answer 44 cites 66 frontend tests. At `802f2a1`: 196 app, 198 backend and 675 voice tests (from the commit
  message).
- Answer 35: per-file classification and a check of whether the bill and EOB describe the same claim now exist;
  full line-by-line reconciliation still does not.
- Its judge table predates the current official lists (see DEMO-PLAN.md, "Judges").
- Still right: its privacy note that the repo cannot prove the Gemini billing tier.
