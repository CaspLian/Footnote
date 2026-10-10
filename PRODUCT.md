# Unfold

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
English-first for this iteration; Spanish is no longer a required flow. No account. App theme defaults to System and supports explicit Light and Dark preferences. Camera, photos and PDF imports. Imported documents are previewed and manually entered; no fabricated extraction. Synthetic paired bill/EOB supports the full demonstration. Billing corrections and insurer appeals are separate. Submission is recorded only when the user marks it. Sponsor services are interfaces, not connected integrations. Solana escrow and outbound calls are outside v1.

## Brand Commitments
Unfold; calm clinical styling, proportional Geist and Phosphor icons. Warm ivory and paper in Light, deep green neutrals in Dark, and restrained teal in both. Soft shadows, subtle contextual gradients and meaningful motion are requested; no decorative gauges. Native iOS Liquid Glass is requested for the initial Home, Bills, Timeline and Guide header controls, primary actions, listening controls and sheet close controls, with legible solid fallbacks where unavailable or Reduce Transparency is enabled. Vernato's hierarchy, spacing, selection feedback and restrained motion are the reference.

## Evidence on Hand
HackKnights Google Doc and Excalidraw context reviewed during planning. Fictional Northline Medical Center bill and EOB: $494 statement balance; $294 EOB responsibility; $50 recorded patient payment; $244 derived remaining. The $250 difference and repeated laboratory line are questions requiring clarification, never guaranteed savings. No live OCR, medical advice or adjudicated liability claims.

## Product Principles
- Put original evidence beside the explanation.
- Separate charges, allowed amounts, insurer payments, patient payments and remaining responsibility.
- Give each screen one clear next action and retain drafts.
- Keep failures recoverable and communicate what was actually processed.

## Accessibility & Inclusion
Complete English-first UI, narration with play/stop and interruption on navigation, language, voice or reading-speed changes and backgrounding, 48px targets, large text, screen-reader labels, reduced motion, reduced transparency and keyboard clearance. System accessibility settings remain effective when the app's Reduce motion switch is off.

## Approval
This record captures the user's explicit approved implementation plan. No additional product facts were inferred.

## Latest requested additions
Personal onboarding for first name, region, insurance context, explanation depth and goals. Locally saved self, partner, child and dependent profiles, with each bill associated with a profile. Optional Face ID / Touch ID / Android biometrics protects access on native devices. Airier screens, proportional Geist typography, varied actions and a signature paper unfolding loader. ClaimPulse source at commit 8c1a321 contains a starter app, health endpoint, mock claim and empty service files; transcript pipeline informs the walkthrough without pretending sponsor APIs are connected.

Mobile tab headers place a 30pt bold Unfold title on the left, followed by a 22pt regular Bills, Timeline or Guide title. There is no logo placeholder. Profile and Settings controls appear only on the main Home, Bills, Timeline and Guide tabs, using native iOS toolbar buttons. All detail screens and app-owned sheets omit those shortcuts. Each app-owned sheet has a Liquid Glass X close control, with a solid fallback where native glass is unavailable. Top scroll-edge blur is disabled. Opening Settings or Family profiles reuses an existing route rather than stacking another copy.

Settings provides household and personal-context access; Appearance contains only App theme (System, Light, Dark). Voice, reading speed, explanation detail, haptics, reduced motion, bill sorting, resolved-bill visibility, native app lock, sample reset and confirmed deletion of imported cases are functional local controls. Preferences survive restart. Calm, Clear and Warm are explicitly labeled ElevenLabs placeholders: saving them records a future voice preference, while current playback and previews use device speech.

Bills and Guide use native iOS search controls. Guide supports searchable curated terms, saved terms, definitions, examples, a useful question to copy, source links and listening with stop/retry states. Simple listening reads the definition; Detailed listening also includes the example and question. These are general explanations; plan documents determine actual coverage, and no AI explanation service is connected.

Follow-up reminders, separately confirmed notice dates, the bill's service date and per-line service dates use the same calendar-sheet pattern instead of typed date fields. iOS opens a native calendar sheet; Android retains its native calendar control; web uses the browser's date input inside an accessible dialog. Save reminder lives inside the reminder sheet and persists the selected calendar value. Explicit close/cancel discards a pending choice. Follow-up reminders remain local timeline records; no notification service is connected, and a reminder is not a legal deadline.

Single standalone action rows span native and compact web layouts. Related actions share an equal-width, wrapping ButtonRow; link actions and intentionally compact Guide filters retain their content width. Desktop secondary and quiet supporting actions remain content-sized. Primary actions default to glass, and Enter or verify details is also explicitly glass. The fallback is an opaque soft surface with a control shadow. Editable fields focus when their whole surface is tapped, show a pencil cue, and use an accent focus border without moving surrounding content. Read-only values have distinct accessibility hints. Icons, text selection and caret colors follow the active theme.

Screen footers keep compact, safe-area-padded workflow actions visible while content scrolls. Intake shows the document count, Verify shows the provider and Draft shows local save status in a compact hint where applicable. Bills keeps Add documents in its footer when cases exist.

Review and Guide term explanations keep a full-width workflow action in the footer and a separate transparent, draggable 144px listening orb over the scroll view. Its 128 medium-weight dots render in three depth paths, with a page-colored radial fade and soft shadow. Play/stop/retry maps to device narration status. The UI-thread frame driver pauses offscreen, in the background and with Reduce Motion.

App-owned Screen and calendar-sheet scrolling uses deliberate top/bottom background-gradient fades. The top fade clears at the start, the bottom clears at the end, and both clear when content fits. These overlays do not intercept input or cover fixed actions. Native toolbar scroll-edge blur remains hidden.

Latest polish: Timeline is a fourth main tab with a five-step case trail. Resolved cards open Timeline with Update case; marking resolved returns Home. Reminder controls open a case-specific calendar sheet without navigating. Import source actions precede document type, whose Auto default awaits a future AI classifier. Actual private copying/validation has a preparation loader and advances directly to verification. Home has an instant glass camera shortcut. Family workspace appears only with another family profile; Other relationships allow a validated local label. Section headings and row labels have distinct sizes, and Bills cards carry semantic status colors without mobile hover feedback. Bills/Guide search hides page chrome and CTA, uses compact content spacing and an animated measured iOS keyboard frame. Settings pickers use a fixed, trailing, theme-tinted host.
