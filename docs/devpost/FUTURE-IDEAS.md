# Footnote: future ideas

Written 2026-10-11. **Ideas only: nothing in this file is built, scheduled or approved, and none of it should be
described to judges as a feature.** The only exceptions are the two "Status" lines under ideas 2 and 4, which record
work started today (in progress, confirm before submitting). When a judge asks "what's next", pick two or three and
say "we plan" or "we'd like to".

Today's in-progress work is not listed here: language-verified voices, live conversations about Guide terms, faster
document reading with accuracy checks, and the realistic demo documents (each in progress, confirm before
submitting). If one of them misses the 12:00 PM deadline, add it here instead.

The first four ideas are the ElevenLabs candidates named on 2026-10-11. Two were being built during the fact-check:
the example call (#2, committed locally at `802f2a1`) and keyterms for recorded questions (#4, `d1aa47a`). Neither is
pushed or checked on a device (in progress, confirm before submitting). If one ships and is pushed before the
deadline, keep its line in DEVPOST.md and remove it from this file.

Effort, for this four-person team part-time: **S** under a day, **M** a few days, **L** one to two weeks, **XL**
longer. Risk is the main way the idea could fail or cause harm.

## Summary

| # | Idea | Area | Effort | Risk |
|---|---|---|---|---|
| 1 | Read-along highlighting | Voice | M | Low-medium |
| 2 | "Hear an example call" | Voice | S-M | Medium |
| 3 | Practice-call role-play | Voice | M-L | Medium-high |
| 4 | Keyterm prompting for recorded questions | Voice | S | Low |
| 5 | Live captions of the user's own words | Voice | M | Medium |
| 6 | Native-speaker review program | Language | M, ongoing | Low (coordination) |
| 7 | Hebrew and Thai live conversations | Language | S once supported | Depends on provider |
| 8 | Line-by-line bill and EOB reconciliation | Documents | L | Medium |
| 9 | A labeled evaluation set, including injection tests | Accuracy | M-L | Low |
| 10 | Plan documents for cost-share checks | Documents | L | High |
| 11 | Hospital facility references, units and geography | Prices | L | Medium |
| 12 | Hospital price-transparency files | Prices | XL | High |
| 13 | Financial assistance screening | Getting help | M | Medium |
| 14 | Good-faith-estimate disputes for self-pay patients | Getting help | M | Medium |
| 15 | System reminders for follow-ups | Workflow | S-M | Low-medium |
| 16 | Calls on the user's behalf | Workflow | XL | Very high |
| 17 | Per-case authorization without accounts | Security | M-L | Medium |
| 18 | Deletion and retention across services | Privacy | M | Medium |
| 19 | Encrypted export and recovery | Privacy | M | Medium |
| 20 | A stricter privacy mode | Privacy | L-XL | High |
| 21 | Observability without bill content | Operations | S-M | Low |
| 22 | Hosted deployment and cost per case | Operations | M | Medium |
| 23 | Case timelines as time-series in Tiger Data | Data | M | Medium |
| 24 | Ideas we set aside | | | |

## Voice and language

### 1. Read-along highlighting (ElevenLabs candidate)

- **Problem:** people with low literacy or low vision lose their place when a long explanation is read aloud, and can't
  see which amount is being spoken.
- **Idea:** request readings from ElevenLabs' text-to-speech "with timestamps" endpoint, which returns character-level
  start and end times ([docs](https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps.md)),
  and highlight each word and amount on screen as it is spoken.
- **Why it matters:** it ties what you hear to what you see, which is the point of reading a bill aloud.
- **Effort / risk:** M / low-medium. The timings come for the original and for the normalized text (numbers spelled
  out), so mapping them back to the digits on screen needs care. ElevenLabs also offers a streaming version
  ("Stream speech with timing", `stream-with-timestamps`). Either way the audio arrives as base64 next to the timings,
  so caching and playback change.

### 2. "Hear an example call" (ElevenLabs candidate)

- **Problem:** many people don't know what to say when they call a billing office.
- **Idea:** turn the case's existing call script into a short two-voice example call (caller and billing office) with
  ElevenLabs Text to Dialogue (`POST /v1/text-to-dialogue`, `eleven_v3` by default, up to 10 voices and about 2,000
  characters per request; [docs](https://elevenlabs.io/docs/api-reference/text-to-dialogue/convert.md)).
- **Why it matters:** hearing a calm, specific call shows the questions and the order to ask them in.
- **Effort / risk:** S-M / medium. It must be labeled as an example, use only the confirmed case, and never sound like
  advice or a real representative. Language coverage and speed of `eleven_v3` would need checking.
- **Status:** in progress, confirm before submitting. `802f2a1` adds "Hear an example call" to the call-script
  screen: Gemini writes the call from the saved analysis, and Text to Dialogue performs it on Eleven v4 (the commit
  reports 8.5 s and 47 credits for 389 characters, against 171 credits on v3). Live English and Mexican Spanish calls
  took 15-21 s to make.

### 3. Practice-call role-play (ElevenLabs candidate)

- **Problem:** calling a billing office or insurer is stressful, and people forget their questions.
- **Idea:** a second private ElevenLabs agent plays a billing representative using the case's facts, so the user can
  rehearse; afterwards Footnote lists which planned questions were asked.
- **Why it matters:** rehearsal builds confidence, and the checklist makes the real call shorter.
- **Effort / risk:** M-L / medium-high. The role-play must never pretend to be the real provider or teach wrong facts.
  It needs its own prompt, limits and privacy notice, and it shares the account's agent call limits.

### 4. Keyterm prompting for recorded questions (ElevenLabs candidate)

- **Problem:** speech-to-text can mishear provider names, plan names and terms such as "coinsurance", exactly the
  words that matter.
- **Idea:** send Scribe's `keyterms` list, built from the confirmed case, with each recorded question
  ([docs](https://elevenlabs.io/docs/api-reference/speech-to-text/convert.md)). The live agent already passes
  recognition keywords (Footnote, Medicare, the provider's name, and in English calls a few billing terms).
- **Why it matters:** fewer wrong transcripts and fewer "please check what you said" prompts.
- **Effort / risk:** S / low. ElevenLabs adds a 20% surcharge for `keyterms` and allows up to 1,000 terms of under 50
  characters each. Measure on synthetic recordings before and after.
- **Status:** in progress, confirm before submitting. `d1aa47a` sends a fixed list of insurance keyterms with English
  recorded questions (only names in other languages), and adds Scribe's entity redaction, so identifiers such as
  Social Security, member and phone numbers reach Gemini and the database as placeholders. Keyterms built from the
  confirmed case, and a before-and-after measurement, are still open.

### 5. Live captions of the user's own words

- **Problem:** in a loud room, or for someone hard of hearing, there is no way to see what the agent heard until it
  answers. Today the orb streams the agent's words and shows the user's completed transcript.
- **Idea:** stream the user's words as they speak, with Scribe v2 Realtime (the integration handoff calls this "a
  future Scribe phase").
- **Why it matters:** the user can catch a misheard amount before the answer is built on it.
- **Effort / risk:** M / medium: another streaming connection, battery use and an updated privacy notice.

### 6. Native-speaker review program

- **Problem:** the interface's 31 language choices and the explanations (31 choices in the app, 42 locales in the
  backend) are machine-generated, and no native speaker has reviewed them.
- **Idea:** recruit reviewers per language, fix the glossary and the most-used screens first, and show which languages
  have been reviewed.
- **Why it matters:** the product exists for people who rely on these languages; a wrong term breaks trust.
- **Effort / risk:** M and ongoing / low technical risk, high coordination effort.

### 7. Hebrew and Thai live conversations

- **Problem:** Hebrew and Thai speakers get readings and recorded questions but no live conversation.
- **Idea:** add them when the ElevenLabs agent platform supports a suitable model for those languages; until then keep
  the current honest fallback.
- **Why it matters:** two of the app's languages are missing the most helpful feature.
- **Effort / risk:** S once supported / depends on the provider; check its current model and language docs first.

## Documents and accuracy

### 8. Line-by-line bill and EOB reconciliation

- **Problem:** today Gemini flags lines worth asking about and the review shows both documents' amounts, but nothing
  calculates which bill line matches which EOB line.
- **Idea:** match lines by service date, code, units and amount; compute repeated lines, lines missing from the EOB,
  and the gap between the statement balance and the EOB's responsibility after payments; show the arithmetic.
- **Why it matters:** a finding you can explain with arithmetic is stronger than a model's note.
- **Effort / risk:** L / medium. Bills and EOBs often use different codes and descriptions for the same service, and
  partial EOBs cause false matches.

### 9. A labeled evaluation set, including injection tests

- **Problem:** we have not measured reading accuracy, false findings or how faithfully the agent repeats numbers.
- **Idea:** 50 to 100 synthetic bills and EOBs with known answers (amounts, codes, pages), including blurry photos,
  multi-page files, other languages and documents with hidden instructions; score each release.
- **Why it matters:** no reliability claim is honest without it, and it catches regressions when models change.
- **Effort / risk:** M-L / low. Most of the work is making realistic documents and answer keys.

### 10. Plan documents for cost-share checks

- **Problem:** people can't tell whether the EOB applied their deductible and coinsurance correctly.
- **Idea:** read the plan's Summary of Benefits and Coverage and compare its cost-sharing with the EOB's fields, as
  questions.
- **Why it matters:** many disputes are about cost-sharing, not prices.
- **Effort / risk:** L / high. Plan rules are complicated, and Footnote must not present a coverage determination.

## Prices

### 11. Hospital facility references, units and geography

- **Problem:** 4,043 of our 7,745 reference rates cover only the doctor's part of a hospital service, so many hospital
  lines get no meaningful comparison; multi-unit lines and local price differences are also not handled.
- **Idea:** add Medicare's hospital outpatient and facility rates, per-unit comparison and geographic adjustment, each
  with its source, year and setting shown.
- **Why it matters:** more lines would get a reference that fits the charge.
- **Effort / risk:** L / medium. More data to load and explain, and the licensing of code descriptions needs checking.

### 12. Hospital price-transparency files

- **Problem:** Medicare's rate is not what the user's insurer agreed to pay.
- **Idea:** use the hospital's own published prices; CMS requires every US hospital to post "a comprehensive
  machine-readable file with all items and services" ([CMS](https://www.cms.gov/priorities/key-initiatives/hospital-price-transparency)).
  Show the hospital's negotiated rate for the user's plan where the file has one.
- **Why it matters:** it is the closest public number to the actual contract.
- **Effort / risk:** XL / high. The files are huge and inconsistent; a warehouse such as Snowflake would be the natural
  place to load them.

## Getting help

### 13. Financial assistance screening

- **Problem:** many patients never learn that the hospital has a financial assistance policy (the synthetic sample bill
  even says "Ask about our Financial Assistance Policy").
- **Idea:** notice the mention, explain it in the user's language, and prepare a request for the policy and the
  application. Tax-exempt hospitals must have a written policy and a plain-language summary
  ([IRS](https://www.irs.gov/charities-non-profits/financial-assistance-policies-faps)).
- **Why it matters:** it can be the largest help available, and it is often missed.
- **Effort / risk:** M / medium. Eligibility differs by hospital; Footnote must never promise approval.

### 14. Good-faith-estimate disputes for self-pay patients

- **Problem:** uninsured or self-pay patients can be billed far more than the estimate they were given.
- **Idea:** compare the bill with the good-faith estimate and explain the federal patient-provider dispute process,
  which applies when a provider bills $400 or more above its estimate
  ([CMS decision tree](https://www.cms.gov/files/document/nsa-ppdr-decision-tree.pdf)).
- **Why it matters:** it is a real, time-limited right that many people don't know about.
- **Effort / risk:** M / medium. Deadlines, fees and eligibility must come from current CMS guidance, not from the app.

## Workflow

### 15. System reminders for follow-ups

- **Problem:** follow-up reminders are saved on the timeline but don't notify the phone.
- **Idea:** optional system notifications for the dates the user chose, with the existing "not a legal deadline" text.
- **Why it matters:** disputes stall when nobody follows up.
- **Effort / risk:** S-M / low-medium: notification permissions, and never implying a legal deadline.

### 16. Calls on the user's behalf

- **Problem:** phone trees and hold times.
- **Idea:** an ElevenLabs agent that calls the billing office with the user's explicit consent, says it is an AI, and
  reports back. No code places calls today.
- **Why it matters:** it would save hours.
- **Effort / risk:** XL / very high: consent, call-recording laws, identity checks, impersonation risk and the
  provider's own rules. Much later, if ever.

## Privacy and security

### 17. Per-case authorization without accounts

- **Problem:** the API has no authentication; anyone who reaches it and knows a saved analysis ID can read it.
- **Idea:** a scoped credential per installation, per-case access tokens, limits per credential and HTTPS. The open
  app-key proposal (`docs/decisions/2026-10-10-proposal-app-key.md`) is only a first step.
- **Why it matters:** needed before the backend leaves a private network.
- **Effort / risk:** M-L / medium: key storage on the device and recovery after reinstalling.

### 18. Deletion and retention across services

- **Problem:** deleting a case on the phone does not delete its saved analysis, the cached reading audio (which has no
  expiry) or provider copies.
- **Idea:** one delete that removes the Tiger Data rows and cached audio and requests deletion from providers where
  their APIs allow; an expiry for cached audio.
- **Why it matters:** people need to know their records can actually be removed.
- **Effort / risk:** M / medium. Some retention, such as the agent's 7 days, is set on the provider side.

### 19. Encrypted export and recovery

- **Problem:** cases live on one installation; a new phone or a reinstall loses them.
- **Idea:** an encrypted case file protected by a passphrase, and an optional recovery-key sync.
- **Why it matters:** disputes can take months.
- **Effort / risk:** M / medium: a lost passphrase means lost data, and the cryptography must use standard libraries.

### 20. A stricter privacy mode

- **Problem:** some users cannot send medical records to third-party AI services at all.
- **Idea:** paid-tier and zero-retention provider settings where available, and on-device reading for simple bills.
- **Why it matters:** it opens the product to people and organizations with strict rules.
- **Effort / risk:** L-XL / high: cost, enterprise agreements (ElevenLabs' zero retention is an enterprise option) and
  lower on-device accuracy.

## Operations and data

### 21. Observability without bill content

- **Problem:** when a step is slow, we can't see which one.
- **Idea:** per-stage timings and error codes for reading, lookup, saving, speech and call setup, recorded without any
  document text.
- **Why it matters:** it turns "it's slow" into a fix, and supports honest latency claims.
- **Effort / risk:** S-M / low, as long as no personal data reaches the logs.

### 22. Hosted deployment and cost per case

- **Problem:** the backend runs on a laptop, and nobody knows what one finished case costs.
- **Idea:** one HTTPS deployment with concurrency tests and budgets; measure the tokens, voice minutes and storage for a
  completed case before choosing any pricing.
- **Why it matters:** sustainability claims need a measured cost.
- **Effort / risk:** M / medium; it needs idea 17 first.

### 23. Case timelines as time-series in Tiger Data

- **Problem:** there is no view of how cases progress over time.
- **Idea:** store case events in a hypertable and compute continuous aggregates for anonymous totals, such as the
  median days from import to resolution. Today the tables are ordinary PostgreSQL tables.
- **Why it matters:** it shows which steps stall, without reading anyone's bill.
- **Effort / risk:** M / medium: small counts can identify people, so aggregates need minimum group sizes.

## 24. Ideas we set aside

- **Solana escrow, micro-grants and on-chain receipts** (from the team whiteboard): no evidence they protect credit,
  stop collections or have legal standing, and they add financial and legal complexity without helping anyone
  understand a bill.
- **Ads that pay for voice:** one ad impression does not cover voice minutes (see answer 22 in
  `docs/judge-answers-20261010.md`), and ads conflict with a privacy-led product.
