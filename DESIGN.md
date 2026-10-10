---
name: "Unfold"
description: "A spacious editorial workspace for understanding medical documents."
colors:
  background: "#F5F2EB"
  surface: "#FFFEFA"
  ink: "#192D2A"
  muted: "#5E6B65"
  accent: "#176B5B"
  accent-soft: "#E8F0E9"
  line: "#DDDCD4"
  warning: "#8A5B22"
  warning-soft: "#F7F0E3"
  error: "#A13F35"
  error-soft: "#F9EEEB"
  dark-background: "#111C1A"
  dark-surface: "#1C2A27"
  dark-ink: "#F2F1E8"
  dark-muted: "#ABBDB5"
  dark-accent: "#91D7BF"
  dark-accent-soft: "#243F35"
  dark-line: "#3D5049"
  dark-warning: "#EBC58E"
  dark-warning-soft: "#3C3021"
  dark-error: "#F5B0A4"
  dark-error-soft: "#3D2523"
  dark-button-text: "#112C22"
  paper-start: "#E0EDE4"
  paper-end: "#F5EEDC"
  dark-paper-start: "#213E32"
  dark-paper-end: "#303627"
  info: "#315C99"
  info-soft: "#EAF0FB"
  success: "#306849"
  success-soft: "#E9F3EA"
  draft: "#76528D"
  draft-soft: "#F1EBF7"
  dark-info: "#AAC8F8"
  dark-info-soft: "#24344D"
  dark-success: "#A2D3AE"
  dark-success-soft: "#243C2C"
  dark-draft: "#D3B8EC"
  dark-draft-soft: "#382B45"
typography:
  display:
    fontFamily: "Geist_600SemiBold"
    fontSize: "36px"
    fontWeight: 600
    lineHeight: "42px"
    letterSpacing: "-0.8px"
  title:
    fontFamily: "Geist_600SemiBold"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: "34px"
    letterSpacing: "-0.4px"
  section:
    fontFamily: "Geist_600SemiBold"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: "26px"
  body:
    fontFamily: "Geist_400Regular"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "25px"
  label:
    fontFamily: "Geist_500Medium"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: "20px"
  caption:
    fontFamily: "Geist_400Regular"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "18px"
  heading:
    fontFamily: "Geist_600SemiBold"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: "30px"
    letterSpacing: "-0.25px"
  item:
    fontFamily: "Geist_600SemiBold"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: "24px"
  brand:
    fontFamily: "Geist_700Bold"
    fontSize: "30px"
    fontWeight: 700
    lineHeight: "36px"
    letterSpacing: "-0.7px"
  tab-title:
    fontFamily: "Geist_400Regular"
    fontSize: "22px"
    fontWeight: 400
    lineHeight: "28px"
rounded:
  small: "12px"
  control: "16px"
  card: "20px"
  sheet-close: "24px"
  orb: "66px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  screen: "24px"
  xl: "32px"
  xxl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
    height: "56px"
    width: "100%"
  button-primary-dark:
    backgroundColor: "{colors.dark-accent-soft}"
    textColor: "{colors.dark-accent}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
    height: "56px"
    width: "100%"
  button-glass-fallback:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
    height: "56px"
    width: "100%"
  button-primary-solid:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
    height: "56px"
    width: "100%"
  button-primary-solid-dark:
    backgroundColor: "{colors.dark-accent}"
    textColor: "{colors.dark-button-text}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
    height: "56px"
    width: "100%"
  button-footer:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
    height: "48px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.accent}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
    height: "48px"
    width: "100%"
  button-quiet:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent}"
    typography: "{typography.label}"
    rounded: "{rounded.small}"
    padding: "12px 16px"
    height: "48px"
    width: "100%"
  button-link:
    backgroundColor: "transparent"
    textColor: "{colors.accent}"
    typography: "{typography.label}"
    rounded: "{rounded.small}"
    padding: "12px 0"
    height: "48px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
    padding: "{spacing.screen}"
  field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "{spacing.lg}"
  badge:
    backgroundColor: "{colors.warning-soft}"
    textColor: "{colors.warning}"
    typography: "{typography.caption}"
    rounded: "{rounded.small}"
    padding: "8px 12px"
  navigation-item:
    backgroundColor: "transparent"
    textColor: "{colors.accent}"
    typography: "{typography.label}"
    rounded: "{rounded.small}"
    padding: "{spacing.md}"
    height: "48px"
  navigation-item-selected:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent}"
    typography: "{typography.label}"
    rounded: "{rounded.small}"
    padding: "{spacing.md}"
    height: "48px"
  choice-selected:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.accent}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "{spacing.lg}"
    height: "48px"
  sheet-close:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sheet-close}"
    size: "48px"
  action-row:
    padding: "0px"
    width: "100%"
  footer-dock:
    backgroundColor: "{colors.background}"
    padding: "8px 24px"
    width: "100%"
  particle-orb:
    backgroundColor: "transparent"
    rounded: "{rounded.orb}"
    size: "132px"
  scroll-fade-top:
    height: "24px"
    width: "100%"
  scroll-fade-bottom:
    height: "28px"
    width: "100%"
  scroll-fade-bottom-search:
    height: "16px"
    width: "100%"
---

# Design System: Unfold

## Overview

**Creative North Star: "The Editorial Document Workspace"**

Unfold keeps the spacious editorial document workspace established in the approved design. Proportional Geist, generous page edges, grouped rows and softly raised paper make the original document and its explanation easy to scan. Warm ivory grounds Light; deep green neutrals carry the same hierarchy in Dark. Teal marks actions, selected states and source context.

Native iOS materials now join this world at the main-tab navigation controls, sheet close controls, primary actions. Liquid Glass belongs to controls, while reading surfaces remain paper. The app follows the system appearance by default and provides explicit Light and Dark choices. Android, web and devices without the glass API use the corresponding solid surfaces. System Reduce Transparency replaces custom glass controls with opaque fills.

**Key Characteristics:**

- Proportional Geist throughout.
- Spacious paper surfaces and grouped rows.
- Teal actions with explicit selected and focused states.
- Equivalent content hierarchy in Light and Dark.
- Native controls for navigation, search, preferences and dates.
- A folded-paper loader with a still reduced-motion state.
- A contextual voice action with a state-driven particle sphere.
- Deliberate scroll-edge fades around content, separate from native toolbar material.

## Colors

The palette pairs green-leaning ink and teal with warm paper; Dark preserves those roles through lighter text and accent colors on deep green surfaces. The frontmatter carries the exact values extracted from the shared palette.

The sidecar's synthesized tonal ramps are display aids, not additional runtime theme colors.

### Primary

- **Restrained Teal / Pale Mint:** accent and dark-accent identify actions, selected rows, source links and financial emphasis.
- **Soft Teal Ground:** accent-soft and dark-accent-soft group evidence, quiet actions and pressed rows.

### Secondary

- **Notice Amber:** warning and warning-soft, with their dark counterparts, identify sample and notice context.
- **Recovery Red:** error and error-soft, with their dark counterparts, identify validation and recoverable failures.

### Neutral

- **Warm Ivory / Deep Green Ground:** background and dark-background provide the page ground.
- **Paper / Raised Green Paper:** surface and dark-surface hold documents, cards and grouped settings.
- **Green Ink / Warm Light Ink:** ink and dark-ink carry reading text and titles.
- **Muted Green:** muted and dark-muted distinguish supporting text without changing its hierarchy.
- **Paper Rule:** line and dark-line separate rows and define input borders.
- **Dark Action Ink:** dark-button-text keeps text legible on the solid dark-theme primary action.
- **Paper Gradient:** the paper-start/end pairs form the localized welcome and review-action gradient; Dark has its own endpoints.

**The Appearance Pair Rule.** Resolve every shared surface, text and state color from the active palette; preserve semantic roles across Light and Dark.

## Typography

**Display Font:** Geist Semibold.
**Body Font:** Geist Regular.
**Label Font:** Geist Medium.

The loaded native font names and observed sizes are recorded in the frontmatter. Semibold gives titles presence without a different display face; regular body text keeps longer explanations open and readable. Proportional type is the established commitment.

### Hierarchy

- **Display:** screen introductions and term titles.
- **Title:** welcome actions, document introductions and compact loader titles.
- **Heading:** 24px section headings such as Recent bills and Questions worth asking.
- **Item:** 18px provider and question labels.
- **Brand / tab title:** 30px bold Unfold, followed by a 22px regular tab name.
- **Section:** 20px secondary groups and detail headers.
- **Body:** definitions, examples, source excerpts and draft content.
- **Label:** buttons, fields, settings and compact navigation.
- **Caption:** supporting context, provenance and tab labels.

**The Proportional Type Rule.** Use the Geist hierarchy for app content and labels; keep native platform typography inside native search, picker and calendar controls.

## Layout

Phone content uses the screen spacing token for page edges, xl between principal groups and lg within typical groups. Touch targets have a minimum height of 48; primary actions have a minimum height of 56. These are minimums, so text wrapping can expand controls.

Single standalone actions fill native and compact web rows. Related Buttons share available space equally inside ButtonRow, with an 88 minimum width and md gap; rows wrap when necessary. Links and explicit compact filters keep their content width. Review and Guide term actions stay full width; the orb floats separately over the scroll region.

Screen's footer stays outside the scrolling content, uses screen side padding and sm top padding, and pads its bottom by the greater of the safe-area inset and sm. Its content is centered at a default maximum width of 720, or the screen's narrower content width. Footer-context Buttons use the compact footer token instead of the regular primary height. A one-line caption hint can precede the actions. Intake uses document count, Verify uses provider and Draft uses save status.

Native and compact browser layouts use Home, Bills, Timeline and Guide tabs. Each mobile header begins with bold Unfold; Bills, Timeline and Guide append a larger regular-weight section name. There is no logo placeholder. Profile and Settings access appears only on the four main tabs. Detail screens use a minimal native back control and omit those shortcuts; app-owned sheets use an X close control. Top scroll-edge effects are hidden.

Desktop web begins at a width of 1080, uses a 220-wide left navigation rail and xxl workspace padding, and centers content within a maximum width of 1120. Reading screens narrow that container where needed. Original-document and confirmed-detail views can sit beside each other; compact widths stack content.

## Elevation & Depth

Soft paper shadows give document cards and selected choices modest separation. Explicit solid primary actions and glass fallbacks use a smaller control shadow; available native glass does not add it. Settings groups use tonal layering without card shadows. The colored paper gradient stays localized to the welcome document specimen and review-action surface.

Native iOS main-tab toolbar buttons and the document modal's X use the operating system's material. App-sheet X controls, primary actions, import source cards and explicitly glass secondary actions use a regular interactive GlassView only when the native API and Liquid Glass are available and Reduce Transparency is off. Action fallbacks use soft teal and a control shadow; sheet-close controls fall back to paper. The orb remains transparent with a page-colored radial fade and a soft shadow. Browser component specimens illustrate these fallbacks and cannot reproduce the native material.

App-owned scroll regions use background-to-transparent gradients at their top and bottom edges. These deliberate fades surround content and remain inside the scroll region; they do not add native toolbar blur or cover the footer. Overlay opacity follows scroll distance on the UI thread, with no looping edge animation.

### Shadow Vocabulary

- **Paper:** a diffuse resting shadow under paper cards and selected choices.
- **Control:** a smaller shadow under explicit solid primary actions and opaque glass-action fallbacks.
- **Focus:** a visible ring for keyboard-focused actions; web inputs and links also receive an accent outline.

The exact shadow and focus values are recorded in the sidecar.

**The Control Material Rule.** Keep glass on navigation, close and primary controls; preserve opaque paper behind explanations and original evidence.

## Shapes

Small radii shape compact buttons, badges and row feedback. Control radii shape actions, fields and evidence notes; card radii shape paper and settings groups. Sheet-close controls use the circular sheet-close radius; the standalone orb uses circular interaction geometry without a button fill. Native components retain their platform geometry. Continuous corners are used by shared paper and action components where supported.

## Components

### Buttons

Single standalone primary, secondary and quiet actions span the available width on native and compact web. ButtonRow gives related Buttons equal flexible widths and can wrap; it can explicitly stack on desktop where the flow calls for it. Link actions and explicitly compact filters retain their content width; Guide's All terms and Saved controls are compact. Desktop web keeps supporting secondary and quiet actions content-sized. The frontmatter's button widths describe standalone compact/native actions; the sidecar carries the row and responsive rules.

Primary actions default to glass. The primary frontmatter colors describe the opaque fallback, since a native material cannot be encoded as a flat color token. Explicit solid primary actions use accent fills and a control shadow. The secondary Enter or verify details workflow action also requests glass. Other secondary actions use a paper fill and line border; quiet actions use soft teal; link actions use no resting fill.

Hover adjusts supporting-action fills. Focus adds a ring. Presses lower opacity on solid/fallback controls and scale to 0.98 when motion is allowed, using the shared press duration and easing. Loading and disabled states prevent activation and expose accessibility state.

### Chips

Badges are compact, noninteractive semantic labels. Needs details uses amber, Ready to review teal, Draft prepared purple, Marked submitted teal and Resolved green. Text always names the status. Filters in Bills and Guide use button variants rather than a separate chip system.

### Cards / Containers

Paper cards use card radius, screen padding and lg internal gaps. Evidence is an inset soft-teal note with control radius and lg padding. Settings groups are shadow-free paper containers with inset dividers between rows.

### Inputs / Fields

Shared fields pair a label with body text inside a paper surface and line border. A pencil cue marks editable fields, and tapping anywhere on their surface focuses the input. Focus uses a 2px accent border and reduces padding by 1px to hold the field's size steady; validation uses the error color and adds a recovery message. Read-only fields omit the pencil, lower opacity to 0.65 and provide a distinct accessibility hint. Selection and caret colors follow the active palette. iOS search uses the native stacked navigation search bar; Android and web use the shared search field and explicit clear action.

Date fields open a calendar control instead of accepting typed text. iOS hosts its inline calendar inside a native page sheet; Android opens its date dialog; the browser places its date input inside an app dialog. Reminder and notice-date confirmations persist from the calendar control; service-date confirmations update the pending verification form. Settings use platform pickers through @expo/ui and React Native switches. The iOS SwiftUI picker host has a fixed 152×48 frame, trailing alignment and theme tint from its first render. The web picker uses a semantic select.

### Navigation

The initial native tabs retain quiet labeled navigation, accent for the active tab and muted ink for inactive tabs. iOS uses native toolbar buttons with tintable Phosphor artwork for profile and Settings access only on Home, Bills, Timeline and Guide. The 30pt bold Unfold title sits left, followed by a 22pt regular section name where applicable. Detail screens and sheets omit those shortcuts; sheet navigation uses an X. Settings and profile navigation reuses those routes.

Desktop navigation uses grouped links on paper, a soft-teal selected background and accent labels. Keyboard focus stays visible.

### Contextual voice orb

Review and Guide term detail keep Prepare request and Copy question as full-width footer actions. A 132×132 transparent orb overlays the full scrolling viewport, 4pt above its bottom. The footer adds 8pt top padding, making 12pt of visual clearance to the CTA. It has a page-colored circular fade and an offset radial shadow; no idle helper text, rectangular reserve band or button fill. A separate 20pt fade softens the immediate CTA edge. Only trailing content padding reserves the measured overlay height, so the scroll viewport stays full height.

The deterministic Fibonacci sphere has 128 dots at medium weight: radius is (0.36 + front × 0.38) × perspective in a 56-unit viewBox. Three depth-grouped native SVG paths share one projection pass. Idle animation updates at 30fps on the UI thread and pauses offscreen, in the background and under Reduce Motion. Idle rotation is 0.22 radians/second, speaking 0.92; state color and activity transition over 240ms. The dark radial shadow uses deep ink rather than a white glow.

Horizontal dragging rotates the sphere. Downward dragging moves and fades the circular shadow continuously; distance or velocity commits minimization. Release carries decaying angular momentum and returns tilt with a spring. Tapping scales to 0.96 and gives a light haptic when enabled. Entrance waits 180ms, then rises and zooms over 420ms; Reduce Motion applies the visible state directly. Minimized controls show the upper half of a 120pt orb in a 64pt target. Restoring them brings back the full orb.

Live captions sit immediately below the orb, with up to three centered 15pt/22pt lines expanded and one 13pt/19pt line minimized. They fade and move with the drag using shared values, and the content reserve follows their measured height. Partial transcript updates replace the same turn; final messages remain in the transcript. Captions clear between agent turns and after ending. Final text is announced politely; partial chunks do not repeatedly interrupt a screen reader. The minimized conversation continues until explicitly ended or interrupted by navigation, context changes or backgrounding.

The orb opens Talk it through with start/mute/end, voice selection and a transcript. It represents a conversational agent, with confirmed case context or a Guide term at the service boundary. The default adapter reports unavailable and never substitutes device speech or opens a microphone. Speaking UI follows provider status and text, without fabricated audio activity.

### Document import actions

Take a photo is a full-width, 96px-minimum glass action with a purpose caption. Choose photos and Choose a PDF share a row with 140px-minimum source cards. All use Phosphor artwork, proportional 18px action labels and 12px purpose captions. Native glass falls back to raised paper, with soft teal on the camera action. Document type follows these actions and opens a focused sheet; Auto (Recommended) is the default. Current Auto metadata awaits a connected classifier rather than inventing a type.

Home’s 64px glass camera shortcut, raised 22pt above the tabs, goes directly to capture. A selected photo/PDF triggers the folding-paper preparation screen during actual validation and private copying, then opens confirmation. Users can add more captures and preview/remove documents before starting understanding, followed by verification. Picker cancellation or a cancelled preparation creates no new case; permission and import failures retain recovery controls.

### Case trail and cards

Timeline is the third main tab. It shows Gather documents, Confirm details, Review & prepare, Send request and Follow through as a connected trail, with named completed/current/upcoming states and the next workflow action. Recorded actions stay separately readable. A resolved card opens this history with Update case; marking a case resolved returns Home. A card’s follow-up control opens its own calendar sheet without navigation.

Bill cards use 18px provider labels beneath 24px section headings, paper shadows and semantic status borders/backgrounds. Status badges sit at the upper right, above the amount and document facts. Ready uses teal; resolved uses green. Mobile cards have press feedback and no hover effect. Home’s profile selector appears only when a family profile exists. Other relationships accept a locally saved label of 1–40 letters, numbers and spaces.

### Scroll-edge fades

Screen and AppSheet share SoftScrollView. Top and bottom fade heights are recorded in the frontmatter. Opacity ramps from 0 to 1 over the corresponding edge distance. The top clears at the start, the bottom clears at the end, and both clear when adjusted content travel is at most 1 or the viewport is not measured. The calculation includes native adjusted insets and clamps bounce/overscroll. Content and layout updates recalculate the edge state. Search uses a 16px bottom fade and compact 12px top/8px bottom padding. iOS keyboard clearance uses react-native-keyboard-controller automaticOffset to measure the visible screen frame; UIKit owns navigation-bar search transitions, while result/filter layout changes use a 220ms eased transition. Search hides the toolbar, page introduction and workflow CTA.

The overlays ignore pointer events and accessibility and stay inside the scrolling region. Native toolbar scroll-edge effects remain hidden. The sidecar shows static edge states; the app computes their live opacity with Reanimated.

### Calendar sheets

The app-owned sheet presents a section title, a 48-wide circular glass X, scrollable content and a confirmation footer. iOS uses the native page-sheet presentation. Web uses a centered dialog with a maximum width of 560 and maximum height of 90% of the viewport, paper content and a dimmed backdrop. The browser fallback keeps the close control opaque. Reduced motion removes the sheet's entrance animation.

Reminder confirmation reads Save reminder inside the calendar sheet. Closing leaves the pending calendar choice unapplied; the next open starts from the existing value. Bill-level and line-level service dates reuse this pattern.

### Folded-paper loader

Two offset paper leaves and a folded corner indicate actual local work. The loop lasts 1800ms; reduced motion or a settled state removes looping. Onboarding cross-fades use the shared transition duration. Reduced motion disables press scale, disables onboarding entry/exit effects and asks the native stack for a fade.

## Do's and Don'ts

### Do:

- **Do** resolve shared colors through the active appearance palette.
- **Do** preserve proportional Geist and the established type hierarchy.
- **Do** keep reading content on opaque paper with generous spacing.
- **Do** use native iOS search, main-tab toolbar, settings and calendar controls where implemented.
- **Do** give app-owned sheets a glass X close control with an opaque fallback.
- **Do** retain solid action fallbacks and system accessibility preferences.
- **Do** show clear selected, focused, loading and recovery states.
- **Do** fill standalone compact action rows and split related actions with ButtonRow.
- **Do** make the full editable-field surface focusable by tap and keep its focus border from shifting layout.
- **Do** keep the main review/term action full width in the safe-area-padded footer and the orb separate over the scrolling content.
- **Do** drive orb state from agent status and pause its frame loop when inactive or reduced motion is requested.
- **Do** clear edge fades at their respective scroll endpoints and when content fits.

### Don't:

- **Don't** add top scroll-edge blur to these navigation stacks.
- **Don't** place Profile or Settings shortcuts outside the main Home, Bills, Timeline and Guide tabs.
- **Don't** use typed text fields for bill, line-item, reminder or notice calendar dates.
- **Don't** turn opaque reading surfaces into glass or spread the colored paper gradient across them.
- **Don't** use monospace for app content or decorative gauges.
- **Don't** imply microphone access or a connected live service until a real agent adapter is configured.

Editable design authority: [Unfold mobile and web prototype](https://www.figma.com/design/rZ1cdq02M7Q3CS9S9qQ8kC?node-id=51-934). Runtime tokens are extracted from mobile/src/theme and shared components; the code is the reference for this update.

### Language selection and required setup

Onboarding uses a two-column grid of equal-height 76pt language tiles with 16pt corners, with compact flags, single-line truncated native names and English explanations. The selected pill has teal fill/border and a check, plus a checked radio accessibility state. Fresh setup waits for explicit selection. Continue/Finish setup appear only once required values are entered; optional context is never invented. Language sheets use 20/27 native titles and 15/22 secondary names. The Settings language row uses the standard 14/20 label and 12/18 detail hierarchy with a 26×19 flag. Native iOS errors use alerts, and recovery controls remain available after dismissal.

Portuguese is a single Portugal-dialect choice at the end of the grid; legacy Brazil selections normalize to Portugal while retaining local records. Minimized orbs retain the circular page softening and offset radial shadow. Bills and Guide use 32pt dynamic scroll-edge fades (24pt during search), anchored to the actual viewport/keyboard boundary. In Choose voice the orb has hit testing disabled; a screen-wide horizontal gesture owns selection, yields to vertical scrolling, carries drag velocity into a spring and retains explicit arrows/preview controls.
