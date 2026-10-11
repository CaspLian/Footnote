# Footnote

<!-- impeccable:product-schema 1 -->

## Platform
adaptive

## Stack
Approved by the user: Expo SDK 57, React Native, TypeScript and Expo Router; native iOS and Android development builds plus a responsive web app from the shared codebase. Zustand and AsyncStorage for local persistence.

## Users
Patients trying to understand a medical statement and its explanation of benefits, clarify discrepancies, and prepare a correction request or insurer appeal.

## Product Purpose
A complete local journey from document import through verification, evidence review, an editable draft and an explicitly recorded submission/follow-up.

## Capabilities and Constraints
Bundled offline UI catalogs cover the 31 working-language choices; connected document explanations and readings use 42 backend locales. Catalog prose is machine translated locally and has not received native-speaker review. No account is required. App theme follows System or an explicit Light/Dark preference. Camera pages, photos and PDFs are gathered and confirmed before document understanding. Unknown amounts remain blank. Gemini extraction, Medicare references, saved Tiger Data analysis and ElevenLabs readings are connected when the API is configured; offline imports use manual entry. Live conversations use a saved bill and the supported agent-language subset. Billing corrections and insurer appeals are separate. Submission is recorded only when the user marks it. Outbound calls and escrow remain outside the implemented journey.

## Brand Commitments
Footnote; calm clinical styling, proportional Geist and Phosphor icons. Warm ivory and paper in Light, deep green neutrals in Dark, and restrained teal in both. Soft shadows, subtle contextual gradients and meaningful motion are requested; no decorative gauges. Native iOS Liquid Glass is requested for the initial Home, Bills, Timeline and Guide header controls, primary actions and sheet close controls, with legible solid fallbacks where unavailable or Reduce Transparency is enabled. Vernato's hierarchy, spacing, selection feedback and restrained motion are the reference.

## Evidence on Hand
Verification records are kept in `docs/PROJECT_STATUS.md` and the feature handoffs. Confirmed document values and their source pages support each review. Benchmark differences are questions requiring clarification, never guaranteed savings or adjudicated liability.

## Product Principles
- Put original evidence beside the explanation.
- Separate charges, allowed amounts, insurer payments, patient payments and remaining responsibility.
- Give each screen one clear next action and retain drafts.
- Keep failures recoverable and communicate what was actually processed.

## Accessibility & Inclusion
A localized UI, a contextual live-agent interface with mute/end controls, optional streaming captions enabled by default and interruption on navigation, context/language/voice changes and backgrounding. Minimized conversations continue. The default adapter is explicitly unavailable, 48px targets, large text, screen-reader labels, reduced motion, reduced transparency and keyboard clearance. System accessibility settings remain effective when the app's Reduce motion switch is off.

## Approval
This record captures the user's explicit approved implementation plan. No additional product facts were inferred.

## Latest requested additions
Personal onboarding for first name, region, insurance context, explanation depth and goals. Locally saved self, partner, child and dependent profiles, with each bill associated with a profile. Optional Face ID / Touch ID / Android biometrics protects access on native devices. Airier screens, proportional Geist typography, varied actions and a signature paper loader.

Mobile tab headers place a 28pt bold Footnote title on the left, followed by a 22pt regular Bills, Timeline or Guide title. The Footnote asterisk accompanies the wordmark. Profile and Settings controls appear only on the main Home, Bills, Timeline and Guide tabs, using native iOS toolbar buttons. All detail screens and app-owned sheets omit those shortcuts. Each app-owned sheet has a Liquid Glass X close control, with a solid fallback where native glass is unavailable. Top scroll-edge blur is disabled. Opening Settings or Family profiles reuses an existing route rather than stacking another copy.

Settings provides household and personal-context access; Appearance contains only App theme (System, Light, Dark). Agent voice, explanation detail, haptics, reduced motion, bill sorting, resolved-bill visibility, native app lock and confirmed deletion of imported cases are functional local controls. Preferences survive restart. The voice chooser displays actual ElevenLabs names filtered by provider-verified language metadata. Legacy placeholder preferences migrate through the existing resolver. The default build does not substitute device speech.

Bills and Guide use native iOS search controls. Guide supports searchable curated terms, saved terms, definitions, examples, a useful question to copy, source links and contextual agent controls. Definition, example and suggested question form the context for a future two-way conversation. These are general explanations; plan documents determine actual coverage. The default agent adapter is explicitly unavailable.

Follow-up reminders, separately confirmed notice dates, the bill's service date and per-line service dates use the same calendar-sheet pattern instead of typed date fields. iOS opens a native calendar sheet; Android retains its native calendar control; web uses the browser's date input inside an accessible dialog. Save reminder lives inside the reminder sheet and persists the selected calendar value. Explicit close/cancel discards a pending choice. Follow-up reminders remain local timeline records; no notification service is connected, and a reminder is not a legal deadline.

Single standalone action rows span native and compact web layouts. Related actions share an equal-width, wrapping ButtonRow; link actions and intentionally compact Guide filters retain their content width. Desktop secondary and quiet supporting actions remain content-sized. Primary actions default to glass, and Enter or verify details is also explicitly glass. The fallback is an opaque soft surface with a control shadow. Editable fields focus when their whole surface is tapped, show a pencil cue, and use an accent focus border without moving surrounding content. Read-only values have distinct accessibility hints. Icons, text selection and caret colors follow the active theme.

Screen footers keep compact, safe-area-padded workflow actions visible while content scrolls. Intake shows the document count, Verify shows the provider and Draft shows local save status in a compact hint where applicable. Bills keeps Add documents in its footer when cases exist.

Review and Guide term explanations keep a full-width workflow action in the footer and a separate transparent, draggable 132pt conversational-agent orb over the scroll view. Its 128 medium-weight dots render in three depth paths, with a circular page-colored radial softening that follows its downward drag and remains in the minimized half-orb. The orb stays close to the CTA; a separate 20pt CTA-edge fade softens the scroll boundary. Streaming agent captions sit above the orb, limited to two expanded lines or one minimized line, and follow the drag. Long-press opens a compact control sheet with a saved captions toggle and optional typed questions. Typing signals user activity to ElevenLabs to reduce interruptions. Orb projection follows the display refresh rate without the former 30 fps cap. Minimized conversations continue; navigation and context changes end them. The default adapter is explicitly unavailable. The UI-thread frame driver pauses offscreen, in the background and with Reduce Motion.

App-owned Screen and calendar-sheet scrolling uses deliberate top/bottom background-gradient fades. The top fade clears at the start, the bottom clears at the end, and both clear when content fits. These overlays do not intercept input or cover fixed actions. Native toolbar scroll-edge blur remains hidden.

Latest polish: Timeline is a fourth main tab with a five-step case trail. Resolved cards open Timeline with Update case; marking resolved returns Home. Reminder controls open a case-specific calendar sheet without navigating. Import source actions precede document type, whose Auto default lets Gemini classify confirmed imports. Actual private copying/validation has a preparation loader and advances to document confirmation before understanding and verification. Home has an instant glass camera shortcut. Family workspace appears only with another family profile; Other relationships allow a validated local label. Section headings and row labels have distinct sizes, and Bills cards carry semantic status colors without mobile hover feedback. Bills/Guide search hides page chrome and CTA, uses compact content spacing and native iOS search navigation with animated content reflow and keyboard-controller avoidance. Settings pickers use a fixed, trailing, theme-tinted host.

Onboarding displays all 31 working languages in a two-column pill grid. First-time users explicitly choose a language; returning setup retains the saved selection. Continue and Finish setup remain visible and disabled until the current required language/name fields are valid. Insurance and ZIP context remain optional. The language sheet uses larger 20pt native names and 15pt English names with native iOS search. Settings uses a compact 26×19 flag and the same label/detail hierarchy as adjacent rows. Error feedback presents native alerts on iOS, with recovery actions retained after dismissal; web and Android retain inline feedback.

Language tiles have equal 76pt heights, modest corners and single-line truncated names; Portuguese uses the Portugal dialect with one option at the end. Legacy Brazil preferences recover to Portugal. The minimized agent orb keeps its circular shadow. Bills and Guide soften both scroll edges dynamically. Choose voice disables orb hit testing and pages the orb, voice name and preview controls while its header and confirm button stay stationary, with vertical scrolling and explicit preview/selection controls preserved.
