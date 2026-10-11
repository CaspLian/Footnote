# Backend services for the web app

Everything the screens need from the Footnote backend. Nothing here changes a screen: the screens still use
`data/mockCases.ts` until they call these. The routes are in `docs/API_CONTRACTS.md`; the mobile app makes the same
calls (`mobile/src/services/`).

Setup: copy `web/.env.example` to `web/.env.local` (`VITE_API_URL=http://127.0.0.1:8000`) and run the backend. Without
it, `backend.configured` is false and no request is sent.

| Need | Call | Notes |
|---|---|---|
| Upload bill pages | `analyzeDocuments(files, language)` | Gemini reads them, Medicare's rates are checked, the analysis is saved. Resolves to a `ConnectedCase` (a `MedicalCase` plus `audit_id`, `analysis_language`, `price_checks`). Starts the ElevenLabs reading at once. |
| Listen | `readings.prepare(caseData.audit_id)` | `{url, text, voice}`: play `url` with an `<audio>` element, show `text` as captions. The same call twice is one request. Cases without an `audit_id` (the samples) keep the browser voice. |
| Voice picker | `backend.voices()`, `backend.voiceSampleUrl(key)` | Pass the key as `readings.prepare(auditId, key)`. Without one, each language gets a suitable voice. |
| Medicare rate of a code | `backend.benchmark(code)` | Free, no Gemini call. |
| Track a confirmed bill | `backend.recordClaim(claimFromCase(caseData, isoServiceDate))`, then `backend.claim(id)` | Tiger Data: estimated deadlines and a timeline. Then `setClaimStatus`, `logClaimAction`. |
| Languages | `backend.languages()` | 42 locales; `LOCALE_FOR` maps the app's `en`/`es` to `en-US`/`es-MX`. |

**Upload, in `IntakeModal`:**

```tsx
const connected = await analyzeDocuments([...files], language);  // throws BackendError
onCaseParsed(connected);
```

**Listen, in `AudioPlayer`** (pass `auditId={caseData.audit_id}` from the review):

```tsx
const reading = await readings.prepare(auditId);
const audio = new Audio(reading.url);
await audio.play();
```

**What a real case does not have.** The backend never invents these, so they are 0 or empty for real bills:
`potential_savings`, `discrepancy_amount`, `statutory_rule`, insurer payments and adjustments (they need the bill
and its EOB compared), `account_number`, `patient_name`. Findings come only from the Medicare price check, with the
backend's wording: "a reason to ask questions, not proof of an error". Screens that show the sample's numbers in
fixed text (the review summary card, the call script's two questions, the verification totals) need to read them
from the case before real bills can be shown there.

**Errors.** `BackendError.status` is the HTTP status, or 0 with `message` `backend_not_configured`, `unreachable` or
`timeout`. `stage` is `language` for an unsupported language, `text_to_speech` when a reading has no audio.

**Tests:** `npm test` (offline, with a stand-in `fetch`). Against a running backend:
`VITE_LIVE_API_URL=http://127.0.0.1:8000 npx vitest run src/services/live.test.ts`.
