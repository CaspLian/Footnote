# Unfold — judge answers and proof notes

Reviewed October 10, 2026. Branch heads were fetched from CaspLian/claimpulse-ai. This is a rehearsal guide, not a production-readiness certification. Backend code and committed verification reports were inspected; no new live provider calls or backend tests were run for this review.

## The sentence to remember

**Unfold turns medical-billing documents into a verified case: understandable questions, an editable request, and a trail of follow-ups.**

Answer in this order: **direct answer → mechanism → limit**. Say “today” for inspected implementation, “the team’s report” for their runtime results, and “we plan” for proposed features. End after two sentences unless asked to elaborate.

## Fix these claims before rehearsing

| Avoid saying | Say instead |
|---|---|
| “ChatGPT gives advertisers your medical conversations.” | OpenAI says advertisers do not receive chats and ads do not appear near personal health conversations. Our differentiation is the dedicated case workflow. |
| “Everything stays local.” | The frontend-only build keeps its workspace locally. Connected branches upload documents to Gemini and save analyses in Tiger Data; voice also uses external services. |
| “Anonymous means the documents cannot identify you.” | No account is required, but a bill or recording can contain identifying information. |
| “Millions of historical regional prices across ZIP codes.” | The checked CSV has 7,745 reference rows, labeled CMS 2026 national Physician Fee Schedule. It has no ZIP column. |
| “Medicare proves what you should owe.” | Medicare is a reference payment schedule, not a commercial negotiated rate or a determination of patient responsibility. |
| “Tiger Data gives us Timescale indexing and immutable logs.” | The inspected schemas use ordinary PostgreSQL tables and indexes. The lifecycle branch appends timestamped events; no hypertable or database-enforced immutability was found. |
| “Ads will pay for unlimited voice.” | Revenue and costs are unvalidated; voice minutes need limits and a measured funding model. |
| “All languages / the live agent are working.” | Language selection is implemented. Backend language support and frontend choices differ; the inspected voice backend is STT → Gemini → TTS, not a persistent live-agent session. |
| “We have automatic cross-device recovery.” | Local state survives ordinary restarts. Cross-device transfer and recovery after deletion are not implemented. |
| “Face ID encrypts the case database.” | Face ID gates app access. The local case snapshot uses AsyncStorage; the lock preference uses SecureStore. These are different protections. |

Sources: [OpenAI ads policy](https://help.openai.com/en-us/articles/20001047-ads-in-chatgpt), [CMS PFS overview](https://www.cms.gov/medicare/physician-fee-schedule/search/overview), and the source inventory below.

## Short answers to memorize

### Product and differentiation

**1. Why not just use ChatGPT or Gemini with a camera and voice?**

They can explain a bill, and we use Gemini ourselves. Unfold adds a structured workflow: verify the reading, connect questions to evidence, prepare a request, and keep the follow-up trail without rebuilding the case through prompts.

**2. Is this just an AI wrapper?**

The model is one component. Our product work is the verified case structure, financial calculations, reference lookup, editable actions and persistent trail; the value should remain even if we change the model provider.

**3. Who is the first user?**

A patient or family member who has a confusing bill and does not know what to ask next. We focus on billing clarification and organizing the next action, rather than diagnosing conditions or replacing a professional advocate.

**4. What is the memorable demo moment?**

Show the original line, the question it raises, and the editable request that uses that evidence. Then record the next follow-up so the explanation becomes a case the person can continue tomorrow.

**5. Why an app rather than another chatbot?**

Billing disputes involve documents, amounts, drafts and several follow-ups. A case workspace makes those explicit and editable, instead of requiring the user to manage them inside a conversation.

**6. How is it different from existing patient advocates?**

We offer a self-service starting point for understanding and organizing a bill. We have not proved that we outperform professional advocates; complex cases should still be escalated to qualified help.

**7. Why mobile and web?**

Mobile makes photographing documents and returning to a case convenient; web makes larger documents and longer drafts easier to work with. Expo shares the core case logic while allowing native mobile controls.

**8. What is your moat?**

We do not claim a defensible moat yet. The potential is a trusted, evaluated billing workflow and well-maintained comparison data; a polished interface or access to Gemini alone is easy to copy.

### Privacy, persistence and security

**9. If users distrust Google or OpenAI, why would they trust your app?**

They should judge us by the data flow we disclose and the controls we implement. The local build avoids uploads, but connected AI still uses providers; no-account access is not a guarantee of anonymity or local-only processing.

**10. Are you keeping everything local?**

Only in the frontend-only mode. Connected analysis sends documents to Gemini and stores returned analyses in Tiger Data, so we must describe the product as a local workspace with cloud processing, not as fully local AI.

**11. How do you retain a multi-day dispute without an account?**

Cases, drafts and recorded actions persist locally through restarts. That works on the same installation; no-account access does not currently provide identity-based synchronization across devices.

**12. What happens if someone clears storage, reinstalls or changes phones?**

We cannot promise recovery today. Encrypted export/import and optional recovery-key sync are proposed next steps; exporting a letter PDF is not a backup of the entire case.

**13. Does Face ID protect everything?**

It protects entry to the native app, using the operating system’s authentication. It does not by itself encrypt the AsyncStorage case database or protect a copy already sent to a backend.

**14. How will you protect cloud cases without requiring accounts?**

We plan scoped anonymous credentials with per-case authorization, rather than treating knowledge of an audit ID as permission. The inspected backend does not enforce that yet, so it remains a private-network prototype.

**15. Can users delete their data?**

The frontend can delete local cases. Complete cloud deletion still needs a backend lifecycle covering stored analyses, transcripts and generated audio; local deletion currently does not establish deletion from every provider.

**16. Is it HIPAA compliant?**

We do not claim HIPAA compliance. Applicability depends on our role and partnerships; a consumer app may also face FTC health-data requirements, so production needs a proper legal and security review.

Reference: [HHS covered entities and business associates](https://www.hhs.gov/hipaa/for-professionals/covered-entities/index.html), [FTC health breach guidance](https://www.ftc.gov/business-guidance/resources/complying-ftcs-health-breach-notification-rule-0).

**17. How will you stop anonymous users from exhausting your credits?**

We plan server-enforced document and voice quotas, concurrency limits and a global spending cap. IP limits can supplement scoped installation credentials or attestation, but an IP address is not a reliable user identity.

**18. What about family and children’s records?**

Family profiles organize cases locally under the adult’s workspace. That is not a child account or independent sharing permission; any upload must be explained to the adult, and access controls must cover each family case.

### Revenue and costs

**19. How can it be sustainable if state is local?**

Local storage reduces hosting needs, but AI and voice still cost money. We propose limited free reviews, paid case credits and optional family or voice plans; pricing comes after measuring the cost of a completed case.

**20. Why not force users to watch an ad before every use?**

That adds friction when someone is already stressed and conflicts with a privacy-led pitch. If ads are tested, they should be optional and unrelated to medical content; we should not assume one ad funds a voice session.

**21. What would Pro actually sell?**

Additional reviews, a defined voice-minute allowance and useful family workflow features. Because medical disputes are episodic, a one-time case pack may fit better than requiring a recurring subscription; this is still a business hypothesis.

**22. What is your unit economics answer?**

We have not measured cost per resolved case yet. We would track document tokens, retries, voice minutes, database usage and support, then price above that cost with a clear allowance rather than promise unlimited use.

Illustration, not an ad-revenue forecast: a hypothetical $20 CPM earns $0.02 per impression. Current ElevenAgents additional hosting minutes are $0.08/minute, so five additional minutes are $0.40 before LLM usage. One ad therefore does not demonstrate viable coverage. This is future live-agent pricing, not a measurement of the current STT/TTS pipeline. [ElevenAgents pricing](https://elevenlabs.io/pricing/agents).

**23. How do you keep costs low?**

Validate files before paid work, bound retries, cache public reference lookups and reuse an analysis for follow-up explanations. Voice needs explicit minute limits; sensitive caches also need retention controls, not indefinite storage to save money.

### Architecture and sponsor choices

**24. Why Snowflake?**

It hosts the reference table and answers code-based price lookups, separating retrieved prices from model-generated explanations. Today the dataset is small enough for Postgres; Snowflake demonstrates the analytical data boundary, not a proven scale requirement.

**25. Why Tiger Data?**

It provides PostgreSQL storage and transactions for saved analyses and line items. A separate branch adds case status, deadlines and timestamped events; those operational records have a different purpose from the benchmark reference table.

**26. Why both? Could Postgres do everything?**

Yes, Postgres could serve this MVP. We separated analytical reference data from operational case records, but two services add cost and complexity; we would keep both in production only if measured benefits justify the split.

**27. Are you actually using TimescaleDB features?**

Not in the inspected implementation. We use ordinary PostgreSQL tables and indexes hosted by Tiger Data; timestamps alone do not mean we use hypertables or time-series acceleration.

**28. Are the event logs immutable?**

They are an application-generated chronological trail, not proven tamper-proof records. Database permissions, append-only enforcement and stronger verification would be needed before calling them immutable.

**29. Why ElevenLabs rather than device speech or Gemini voice?**

Voice can make billing explanations easier to access, and ElevenLabs supplies speech services in the backend. The current flow is transcription, Gemini and generated speech; the persistent conversational agent is a planned integration, not a completed claim.

**30. Why Gemini?**

It reads photos or PDFs and returns structured billing information and explanations. We selected it for the document step, but provider choice is replaceable; schema validation and user verification still matter because the model can be wrong.

**31. What is the hardest technical work?**

Keeping an uncertain document reading usable across verification, reference comparison, saved state and voice. The frontend and backend must preserve missing values and provenance, recover from partial failures, and avoid turning a tentative observation into a claim of savings.

### Accuracy, evidence and failure behavior

**32. Does a high price mean the bill is wrong?**

No. A Medicare payment reference is not the patient’s obligation, and physician fees differ from hospital facility charges; the useful result is a question to ask, not a declaration of overcharging or guaranteed savings.

Reference: [CMS PFS overview](https://www.cms.gov/medicare/physician-fee-schedule/search/overview), [CMS insurance terms](https://www.cms.gov/initiatives/your-patient-rights/medical-bill-rights/get-help/medical-bill-guides-resources/health-insurance-terms-you-should-know).

**33. How do you make a comparison valid?**

The target is a match on code, units, setting, geography and effective date, with the source visible. Today’s national reference and ratio thresholds are limited; they do not establish a fair-market or insurance-contract entitlement.

**34. What if the user only has a bill, or only an EOB?**

Either can start a case. We should explain what the available document supports, leave missing values unresolved, and request more evidence only when needed; a missing EOB is not proof that a charge is incorrect.

**35. Can you really compare multiple pages or documents?**

The camera branch sends ordered pages together to Gemini, and the Gemini branch has multi-page extraction work. Reconciling a separate bill with an EOB requires reliable document identity and field mapping; page upload alone does not prove that reconciliation.

**36. How do you avoid hallucinations?**

Structured output and validation catch format problems, while verification lets the user correct the reading. They do not prove factual accuracy; we need an annotated document set measuring amounts, codes, page references and false findings before claiming reliability.

**37. How will you evaluate the AI?**

Measure extraction accuracy and the false-positive rate of billing questions against labeled documents, including blurry pages, repeats, missing amounts and multiple languages. Workflow tests are useful, but they do not establish medical-billing accuracy.

**38. What if a document contains malicious instructions?**

We have not demonstrated adversarial robustness. Documents must be treated as evidence rather than instructions, model output must be validated, and consequential tools must remain restricted; document-injection tests are part of the next evaluation.

**39. What if a provider or database goes down?**

The backend has bounded Gemini attempts, a CSV reference fallback and a nonfatal save result. The UI should preserve the case and offer retry, while showing when a comparison used fallback data or a cloud save did not succeed.

**40. How are reminders and deadlines determined?**

A follow-up reminder is a user-selected date, not a legal deadline. The Tiger branch contains 120/180-day estimates; authoritative appeal dates must come from the applicable notice or plan, and estimates must never be presented as universal rules.

Reference: [CMS medical-bill dispute guidance](https://www.cms.gov/initiatives/your-patient-rights/medical-bill-rights/get-help/dispute-bill).

**41. Billing correction or insurer appeal: what is the difference?**

A billing correction asks the provider to reconcile charges or payments. An insurer appeal challenges a coverage decision; the recipient, evidence and deadline are different, so the app keeps them as distinct actions.

**42. Does Unfold submit an appeal or stop collections?**

No. It prepares material for the user to review and submit, and records submission only when they confirm it. Creating a draft does not send it, pause collections or change their legal obligations.

**43. Do all those language choices work?**

The current frontend offers 31 working-language choices, while its labels remain English. The backend lists 12 text languages, and reports do not verify all of them or multilingual speech; selection is not proof of full translation support.

**44. What has actually been tested?**

Our latest frontend passed 66 tests, typecheck, lint, Doctor and three platform bundles, and a signed iPhone build installed. Committed backend reports describe live provider and connected-web checks; I have not independently rerun those backend results.

**45. How much money have you saved users?**

We have not measured real patient savings. For now, the outcome is whether users can identify a supported question and prepare the right next action; savings claims require verified before-and-after case outcomes.

**46. What would you do next?**

Unify the working branches, fix comparison and extraction assumptions, and protect cloud access. Then run a connected phone journey and a small labeled-document/user study before expanding automation or claiming financial impact.

## Judges: likely angles, not predictions

The affiliations below are from the [official judge list](https://hackknight.org/#judges). Questions are our inference from those roles, not statements about what any judge will ask.

| Judges / published role | Prepare to explain |
|---|---|
| Raja Sharma and Diego Perez — Bloomberg engineering | Why two databases? How are money, source data and failures handled? |
| Nick Pisciotta — Boardable lead engineer | Who benefits first? Does the workflow reduce effort? Can the product be maintained? |
| James Oh — Outtake; Ehab Abdalla — Baselayer; both listed as hackathon winners | Show the distinctive working moment. What was built versus planned? |
| Sad Adib — JPMorgan Chase engineering | Case authorization, financial correctness, audit trail and abuse limits. |
| Omobolaji Alabi — Google engineering | Model choice, structured output and value beyond a model call. |
| Will Pelech — Datadog engineering | Latency, observability, timeouts, retries and diagnosing failures without logging bills. |
| Moses Parente — FedEx cloud engineer | Deployment, concurrency, operating cost and dependency outages. |
| Arvind Majumder — Northwell engineering | Valid comparisons, patient responsibility and correction versus appeal. |
| Dr. Shweta Jain — John Jay professor | Security boundaries and evidence integrity; her faculty page lists cybersecurity expertise. |
| Avijit Roy — AI/cybersecurity researcher | Privacy, adversarial evaluation and language limitations; these align with his described research. |

Additional background: [Jain’s faculty profile](https://www.jjay.cuny.edu/faculty/shweta-jain), [Roy’s own profile](https://avijitroy.com/). Do not imply every judge specializes in medical billing, AI or compliance based on their employer.

## Branch inventory and proof map

All nine remote branch heads below were inspected without checking out or modifying them. Shared files were grouped by Git blob identity; distinct routes, service implementations, mappings and reports were read. These branches are not one unified release.

| Branch / inspected head | Contribution and limit |
|---|---|
| `main` · `8c1a321` | Early skeleton; frontend starter and root backend route. |
| `frontend-aarush` · `c04f38f` | Latest polished local frontend, cases/family profiles, drafts/trail, loading and conversational-agent interface. No live backend adapters in this build. |
| `backend-gemini` · `7061b38` | Expanded extraction, ordered multipage input and a letter route. Letter code uses placeholders for personal fields, but initial documents still go to Gemini. |
| `nimesh/audio-service` · `60d279b` | STT, TTS, voice catalog, cache and voice routes. Older branch; integrated versions moved the services into importable folders. |
| `Tiger-data` · `134d491` | Ordinary Postgres audit/status/action/deadline tables and APIs. Estimate calculations exist; they are not authoritative credit/appeal rules. |
| `Gemini-Tiger-Snow-Integration-V1` · `d1753db` | Gemini → Snowflake reference → Tiger saved analysis; mounted voice routes and developer console. |
| `Gemini-Tiger-Snow-ElevenLabs-V2` · `24f315b` | Integration checkpoint, null-text normalization and reports. No persistent live conversation or full frontend here. |
| `Backend-Frontend-Connection-V1` · `82af536` | Connects an earlier frontend to upload, code lookup and saved-analysis speech. Reports live web testing; latest frontend polish and separate lifecycle work are not automatically included. |
| `Camera-capture` · `b90966c` | Native multiphoto capture, ordered uploads, optional source-page field; docs say physical runtime validation remained pending. |

### Evidence to have open during Q&A

| Claim | Exact evidence |
|---|---|
| Small national benchmark table, not millions of regional prices | [Checked CSV](https://github.com/CaspLian/claimpulse-ai/blob/24f315bcd299ce6155a540a5fc79452ef8aa3aca/backend/data/cpt_benchmarks.csv): counted 7,745 rows; columns include code, description, category, rate, setting, source and year. No ZIP/geography column. |
| Snowflake’s actual role and fallback | [Reference service](https://github.com/CaspLian/claimpulse-ai/blob/24f315bcd299ce6155a540a5fc79452ef8aa3aca/backend/services/snowflake_services/snowflake_service.py): CPT lookup, cached connection, local CSV fallback, 3x/6x thresholds. |
| Connected cloud persistence | [Pipeline](https://github.com/CaspLian/claimpulse-ai/blob/24f315bcd299ce6155a540a5fc79452ef8aa3aca/backend/main.py) and [analysis store](https://github.com/CaspLian/claimpulse-ai/blob/24f315bcd299ce6155a540a5fc79452ef8aa3aca/backend/services/analytical_services/analysis_store.py): save response JSON and lines, including optional transcript. No per-user authorization shown. |
| Operational lifecycle on a separate branch | [Tiger lifecycle](https://github.com/CaspLian/claimpulse-ai/blob/134d491223b38eadd9fd7d24f9189c987c3f7112/backend/services/tigerdata_service.py), [date estimates](https://github.com/CaspLian/claimpulse-ai/blob/134d491223b38eadd9fd7d24f9189c987c3f7112/backend/services/timeline.py). Ordinary tables and indexed events; not hypertables. |
| Voice is an STT/TTS pipeline | [Mounted voice routes](https://github.com/CaspLian/claimpulse-ai/blob/24f315bcd299ce6155a540a5fc79452ef8aa3aca/backend/services/audio_service/voice_routes.py): recorded question analysis and saved-analysis speech. No saved-case conversational follow-up route. |
| Teammate’s live/backend evidence | [Integrated report](https://github.com/CaspLian/claimpulse-ai/blob/24f315bcd299ce6155a540a5fc79452ef8aa3aca/BACKEND_VERIFICATION_REPORT.md), [connected-client checkpoint](https://github.com/CaspLian/claimpulse-ai/blob/82af5368c47adfc3b0600143bf4efbf1357ca514/docs/PROJECT_STATUS.md). Reported results, not independently rerun in this review. |
| Current local frontend proof | [Recovery and validation record](https://github.com/CaspLian/claimpulse-ai/blob/c04f38f0d87f020ac68491ec8e1b2b80cb0679b7/docs/recovery-20261010.md). The subsequent standalone Release build installed on the specified iPhone; launch was blocked because the phone was locked. |

### Privacy wording must match provider configuration

Google’s [current Gemini API terms](https://ai.google.dev/gemini-api/terms) say unpaid-service inputs may be used to improve products and may be reviewed by people; sensitive information should not be submitted there. Paid-service prompts/responses are not used for improvement, but limited safety/legal logging remains. The inspected repository does not prove the team’s billing tier, retention configuration or compliance arrangements. Use synthetic documents for the demo and do not promise zero retention.

## Material issues to acknowledge and prioritize

These are preparation findings, not new implementation fixes:

1. **Comparison validity:** the integrated price code’s 3x/6x labels are heuristics. Professional/facility portions, units and provenance need correct treatment before “overcharge” claims. The committed report itself flags this issue.
2. **Case authorization and retention:** current integrated routes save and retrieve sensitive analyses without per-user authorization. Rate limiting, scoped access and deletion across database/audio caches are not demonstrated. An app-wide embedded key alone would not solve case ownership.
3. **Extraction mapping:** the connected-client adapter assigns `units: 1`, `page: 1` and missing line amounts to zero. The camera branch has separate page-reference work. Do not claim complete source-page accuracy or reliable automatic bill/EOB reconciliation across all branches.
4. **Branch coherence:** polished frontend, connected services, letter endpoint, camera changes and lifecycle endpoint are distributed. Select and test one demo commit rather than presenting their union as one running app.
5. **Measurement:** automated checks and a few reported live requests do not demonstrate AI accuracy, concurrent scale, patient savings or profitability. Those need their own measurements.

Suggested ownership: extraction/benchmark owner for item 1 and 3; backend owner for item 2; integration owner for item 4; presenter/product owner for item 5. Assign named teammates during rehearsal rather than inventing assignments here.

## Rehearsal order

Each presenter should know 1, 10, 12, 19, 24–26, 32, 36 and 44. Drill them in random order, then ask “Show me” and open the corresponding proof. Replace any proposed control described in the present tense with “we plan.”

Verdict: useful prototype and defensible workflow; current privacy/scale/savings claims need the corrections above.

Gate status: this is a scoped Q&A review. Official rubric weights, prize rules and submission readiness were not verified; timed pitch/demo rehearsal was not run. No full-readiness gate is claimed.

Strongest evidence: fetched branch code, counted benchmark data, the frontend checks performed in the preceding work, and clearly attributed backend verification reports.

Open blockers: benchmark interpretation, cloud authorization/retention, branch integration and connected-phone validation.

Next highest-value action: run one agreed demo commit with synthetic evidence and rehearse the ten priority answers with their proof visible.

Files/artifacts changed: this guide only. No app code, cloud service or GitHub branch was changed.

Validation performed: nine branch snapshots reviewed; source/report distinctions checked; official judge profiles, provider policies, pricing and CMS/HHS/FTC guidance consulted. No new backend runtime or model-accuracy test claimed.
