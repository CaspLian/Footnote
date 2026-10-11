# Service contracts

With `EXPO_PUBLIC_API_URL` unset, the adapters use local TypeScript implementations. Review/draft interfaces live in `mobile/src/domain/types.ts`; Guide's content interface lives in `mobile/src/services/guide-explanations.ts`. Implementations live in `mobile/src/services` and `mobile/src/native`.

## Connected build (`EXPO_PUBLIC_API_URL` set)

The root layout installs `native/backend-adapters.ts`. Confirmed imports use Gemini through `/api/v1/analyze`, saved answers reopen through `/audits/{id}`, and verified codes use `/benchmarks/{code}` with `ReviewResult.mode: 'connected'`. Claim actions mirror into `/claims` while the local trail remains available. Optional missing-date recovery uses `/analyze-image` once per case and reuses its claim.

The voice catalog maps Calm/Clear/Warm to real backend keys; previews, saved readings and audio use `/voice/voices`, `/voice/voices/{key}/sample`, `/voice/speak` and `/voice/audio/{id}`. The live adapter uses `/voice/agent/session` with form fields only, loading evidence on the server. A separate recorded-question fallback uses `/voice/analyze`. Settings and Languages read health and supported locales. Profiles, ZIP, insurer and preferences are not uploaded with bill/session requests. Provider keys stay on the server.

Drafts and Guide content remain local; the implemented HTTP contract is [API_CONTRACTS.md](API_CONTRACTS.md).

## App boundaries

| Boundary | Implemented behavior |
| --- | --- |
| Document understanding | Explicitly confirmed imports go to Gemini, with saved-audit reopening and bounded missing-date recovery. Offline imports support manual verification. |
| Bill review | Confirmed codes use national Medicare references and source-linked questions. Unknown amounts and absent references remain unknown. |
| Draft preparation | Local editable billing-request and insurer-appeal templates; submission is an explicit user action. |
| Saved reading | ElevenLabs clips prepared for a saved analysis and selected voice; audio supports byte ranges. |
| Live conversation | Private session credentials from the API, saved-bill context, Gemini answers, captions, mute and end controls. Corrected entries cannot use stale analysis. |
| Voice preview | Catalog slots resolve to provider voices. Previews download the clip and await native loading/playback confirmation; cancellation and playback errors close the player. |
| Household and documents | Local versioned metadata, app-owned copies, previews and export. User data is not uploaded by merely opening a picker or selecting a profile. |

The shared HTTP contract is `API_CONTRACTS.md`. Provider keys remain on the server. Native cancellation checks inspect `signal.aborted`; React Native's installed AbortSignal lacks the newer convenience method.

## Guide content and voice separation

`GuideExplanationRequest` carries `termId`, `language`, `depth`, `voice`, and optional `coverage`. The current term screen requests English content and does not pass coverage. The local implementation looks up the curated glossary; it does not personalize from coverage or synthesize a different explanation for a voice preference. Unknown terms reject with `term_not_found`.

`GuideExplanation` returns `termId`, `definition`, `example`, `question`, `narration`, `source: { title, url }`, and the literal `curated_local` provenance. The screen always offers the example and question. Simple narration reads the title and definition; Detailed narration also reads the example and question. Loading/retry is local asynchronous UI state, not evidence of a backend call. The screen guards against applying a prepared explanation after unmount or a depth/voice change.

The saved `voice` values remain `device`, `calm`, `clear` and `warm` for persistence compatibility; the live-agent UI maps legacy device to Calm. Current defaults use Calm. Guide and review now open a conversation control instead of device read-aloud. The old device narration boundary remains available to teammates, but it is not the orb's playback or a substitute for ElevenLabs.

A remote Guide adapter must validate sources and use explicit remote provenance. Keep curated content available as a fallback; no AI explanation service is currently connected.

## Confirmed documents and understanding

Intake copies documents first, then opens `/confirm-documents`. Photos and Files can gather at most 10 files per selection; camera takes one capture and confirmation offers Take another photo. All selected files are committed atomically to one case, with rollback of copies if cancellation or commit fails. Users can preview/remove/add documents before pressing Use this/these document(s). No understanding starts during capture or confirmation, and no bill/EOB pair is required.

`UnderstandingRequest` carries case ID, available attachments, `workingLanguage`, local profile and personal context. `understand` receives `AbortSignal` and `onPhase('reading'|'organizing')`. It returns mode (`extracted`, `manual`, `synthetic`), optional provider/service date/financials/line items, and optional opaque `contextId`. The screen remains working until the actual promise settles, without percentages or fake timers. Failure exposes retry/manual recovery; navigation aborts and stale callbacks are ignored. The default adapter immediately offers honest manual entry for arbitrary documents. A connected adapter must upload actual bytes (local URIs are not remotely readable), validate its response, and retain source provenance.

`applyUnderstandingResult` validates confirmed amounts/calendar dates and attachment-linked line evidence before saving. Missing financial values are absent, including remaining balance and prior payment. `evidenceContextId` survives edits to confirmed amounts, but changing attachments invalidates it and previous findings. The later review uses all available evidence; EOB/bill reconciliation is only one possible evidence comparison. Imported files never receive seeded sample findings.

## Live agent and voice previews

`AgentContext` carries the selected working language and mapped provider language, voice preference, case ID/opaque Gemini context ID, confirmed amounts, findings, original attachment metadata, insurance/profile context and explanation preferences. Guide can provide its term definition/example instead. The backend must resolve actual Gemini evidence using the context ID and ground conversation in those sources.

`AgentAdapter.connect` takes an AbortSignal, status callback and streaming transcript callback (optional stable turn ID and final flag), returning `end()` and `setMuted(boolean)`. Statuses are idle, connecting, listening, thinking, speaking, unavailable and error. The controller disposes connections that finish after cancellation and ignores late callbacks. Navigation, context/voice/language changes, app background end the session. Minimizing the orb preserves the active conversation and shows compact captions. Mute/end and retry controls work through this contract. The default adapter opens no microphone and transmits no case data. Keep provider keys server-side and supply short-lived session credentials to a connected SDK.

`VoicePreviewAdapter.play` returns an asynchronous stop handle; its implementation must finish playback naturally, honor stop and reject unavailable samples. The carousel stops previews during selection/navigation and discards late handles. The default produces an explicit unavailable message. Named preferences must map to real voice IDs before use; language support varies by agent model. See [language and voice research](languages-and-voice.md).

## Data and evidence

- Money is **USD cents**, represented by finite, nonnegative safe integers. `49400` means $494.00. Optional missing amounts remain absent, not fabricated as zero. Both languages accept U.S. currency entry (`1,234.56`); invalid or negative entries fail validation.
- Keep billed charges, bill adjustments, post-adjustment subtotal, EOB allowed amount, insurer payment, EOB responsibility, patient payment and statement balance distinct. The derived remainder is `max(0, EOB responsibility − recorded patient payment)` and is not an adjudicated amount owed.
- `Evidence` identifies `attachmentId`, a one-based page, localized label and original excerpt. Findings carry source evidence and cautious questions. A `Comparison`, when available, needs its source, URL, amount, retrieval time and contextual limits.
- Imported attachments always have `origin: 'import'`. Synthetic findings require the explicitly marked sample bill/EOB sources. Changed sample entries are identified as user-confirmed values; original excerpts remain original.
- Dates use valid `YYYY-MM-DD` calendar values; timestamps use ISO strings. Date controls construct a local noon `Date` and read local year/month/day when returning a selection, avoiding UTC conversion drift. An empty picker value may display today's local date but does not save it automatically. iOS and web keep a calendar selection pending inside an app sheet/dialog until confirmed; closing discards it. Android's native dialog invokes the callback only for an accepted selection. Reminder and notice callbacks validate and persist directly from the control's Save action. Service-date callbacks update pending bill/line entries, which remain subject to the main verification action. Localized data carries `en` and `es`; the current UI is English-first. Drafts are separate by case, kind and locale.

## Errors, cancellation and persistence

Native imports return `success`, `cancelled`, `permission-denied` or an error with a stable code and localized message. Cancellation creates no attachment or case. Imports support PDF/JPEG/PNG/WebP/HEIC/HEIF, reject empty or oversized files (20 MiB maximum), inspect file signatures and only succeed after a checked copy exists outside picker cache. Signature validation is not proof that all PDF pages render; corrupt/encrypted PDFs have separate preview recovery. Passwords stay in preview component memory.

Exports fail without discarding the editable draft. Sharing reports sheet completion, not delivery. Narration exposes loading/speaking/unavailable/error states, chooses a language-matching device voice, and uses generation guards to prevent a cancelled asynchronous start. Navigation, language, voice and reading-speed changes and backgrounding stop narration.

The store writes version-1 snapshots under `footnote-local-v1`. Unreadable saved data produces a recovery state rather than silent deletion; failed writes remain visible and retryable. Review results are discarded if the case changed, disappeared or a reset occurred while processing. The older review/draft interfaces have no transport cancellation; understanding and live-agent controllers now provide `AbortSignal`. Connected adapters honor these signals and transport timeouts while retaining those stale-result guards. Do not convert a timeout into a successful empty result.

`preferences` and `savedTermIds` are now fields in that same version-1 snapshot, stored in AsyncStorage natively and localStorage on web. Older snapshots without them recover defaults while preserving cases and drafts. Preference normalization accepts System/Light/Dark, the four supported voice slots, rates 0.75/0.92/1.1, haptics/reduced-motion booleans, recent/balance/follow_up bill sorting, and resolved visibility. Unsupported values recover independently to their supported defaults. Defaults are System theme, Calm voice, rate 0.92, haptics on, app Reduce motion off, recent sort and resolved bills shown.

Explanation depth remains in `personalContext` and is shared by Settings, voice preferences and review/Guide screens. Saved term IDs are deduplicated strings of at most 80 characters; the stored collection is not a remote glossary cache. The live glossary determines which saved IDs are shown. Device/system motion preferences are ORed with the app switch, and iOS Reduce Transparency disables custom glass action surfaces. Appearance's native override uses unspecified/system when System is selected.

For the proposed HTTP adapter, map transport/validation failures to stable error codes with localized recovery text and an explicit `retryable` flag. Cancellation must remain a separate outcome, and retry must preserve confirmed entries and drafts. This remote error envelope is not implemented yet.

## Idempotency and recorded actions

- Concurrent reviews of the same case share one in-flight operation. A later completed review can create another verification event; this is not permanent request deduplication.
- Draft preparation reuses `(caseId, kind, locale)`. Saving unchanged text is a no-op; editing a submitted draft clears its submission state and increments its revision.
- Submission is an explicit user confirmation. Repeated confirmation of the same revision is a no-op; its event ID is `${draft.id}:submitted:${draft.revision}`. Copy/export/share never call `markSubmitted`.
- Saving the same follow-up or confirmed notice date is a no-op. Removing them records separate removal events. Reminders are local case/timeline records, with no scheduled notification or legal-deadline determination.

A future server should accept an idempotency key for mutations, return the same operation result for repeated keys, and retain separate draft revision/submission records. Those HTTP guarantees are proposed, not implemented by the local interfaces.

## Auto classification and local household additions

Attachment.kind now permits auto in addition to bill/eob/policy. Auto is the default user intent for the next import and remains awaiting classification; the client must not infer policy or extraction from an unknown type. A future Gemini classification adapter must return a validated document kind with provenance and preserve manual correction. It is a separate boundary from the current review service.

Import preparation exposes choosing/preparing/idle and stable cancellation/error recovery. Preparing begins after selection and paints the loader before private validation/copying. A successful batch is committed once and opens document confirmation; a late result after cancellation is discarded and all copied attachments are cleaned up. This stage is not live OCR.

Relationship permits other with relationshipLabel: 1–40 Unicode letters, numbers and spaces. Values trim and collapse spaces; symbols, empty labels and embedded non-space whitespace fail validation. These profiles and labels remain in the local snapshot.

Timeline is a main tab derived from current case status plus recorded events. Marking resolved is explicit and then returns Home; viewing a resolved card only opens Timeline. Follow-up edits remain case-local and never imply notification delivery.

## Identity and compatibility

Footnote writes new metadata to `footnote-local-v1`, with a validated fallback from the earlier key. Existing document URIs remain valid, and the web attachment reader can open the earlier IndexedDB database. Explicit empty-data recovery clears both keys. The installed application ID remains stable at the user’s request, preserving the device sandbox and existing bills. Earlier fixture cases remain stored for recovery but have no public entry point and are excluded from visible bill lists.
