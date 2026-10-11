# Backend services for the web app

The Footnote backend adapters used by the earlier standalone web app. Intake sends uploaded files to analysis;
verification, review, letters and phone scripts use the returned document details. The app starts empty.
The complete shared app remains `mobile/`, including its Expo web build.

Setup: copy `web/.env.example` to `web/.env.local` (`VITE_API_URL=http://127.0.0.1:8000`) and run the backend. Without
it, `backend.configured` is false and no request is sent.

| Need | Call | Notes |
|---|---|---|
| Upload bill pages | `analyzeDocuments(files, language)` | Gemini reads them, Medicare's rates are checked, the analysis is saved. Resolves to a `ConnectedCase` (a `MedicalCase` plus `audit_id`, `analysis_language`, `price_checks`). Starts the ElevenLabs reading at once. |
| Saved ElevenLabs reading adapter | `readings.prepare(caseData.audit_id)` | Returns `{url, text, voice}` and deduplicates requests. The standalone web screen still uses its explicitly labelled device voice. Use `mobile/` for connected ElevenLabs playback. |
| Voice picker | `backend.voices()`, `backend.voiceSampleUrl(key)` | Pass the key as `readings.prepare(auditId, key)`. Without one, each language gets a suitable voice. |
| Medicare rate of a code | `backend.benchmark(code)` | Free, no Gemini call. |
| Track a confirmed bill | `backend.recordClaim(claimFromCase(caseData, isoServiceDate))`, then `backend.claim(id)` | Tiger Data: estimated deadlines and a timeline. Then `setClaimStatus`, `logClaimAction`. |
| Languages | `backend.languages()` | 42 locales; `LOCALE_FOR` maps the app's `en`/`es` to `en-US`/`es-MX`. |

**Upload, in `IntakeModal`:**

```tsx
const connected = await analyzeDocuments([...files], language);  // throws BackendError
onCaseParsed(connected);
```

**Saved-reading adapter** (available to a caller; not wired into this app's `AudioPlayer`):

```tsx
const reading = await readings.prepare(auditId);
const audio = new Audio(reading.url);
await audio.play();
```

**Unknown fields.** The backend does not extract these, so they stay null or empty:
`potential_savings`, `discrepancy_amount`, `statutory_rule`, insurer payments and adjustments (they need the bill
and its EOB compared), `account_number`, `patient_name`. A billed total never substitutes for an unknown patient
balance. Unknown line amounts are excluded from claim payloads; a documented zero remains zero. Findings come
from Medicare references as questions, and doctor-only references do not produce hospital price ratios.
The screens display actual values or "Not available" and do not infer savings, deadlines or collection holds.
Cases remain in memory for this browser session; native persistence and live conversations are in `mobile/`.

**Errors.** `BackendError.status` is the HTTP status, or 0 with `message` `backend_not_configured`, `unreachable` or
`timeout`. `stage` is `language` for an unsupported language, `text_to_speech` when a reading has no audio.

**Tests:** `npm test` (offline, with a stand-in `fetch`). Against a running backend:
`VITE_LIVE_API_URL=http://127.0.0.1:8000 npx vitest run src/services/live.test.ts`.
