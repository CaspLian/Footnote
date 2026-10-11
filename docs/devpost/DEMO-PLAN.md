# Footnote: science-fair demo plan

Written 2026-10-11 (America/New_York) for Hack Knight Fall 2026. Scripts are in
[PITCH-AND-SCRIPT.md](PITCH-AND-SCRIPT.md); the submission text is in [DEVPOST.md](DEVPOST.md). Fact-checked against
the repo at `802f2a1` (07:12) and the event pages at 06:50 EDT; evidence is in [FACT-CHECK.md](FACT-CHECK.md). Items marked
**(in progress, confirm before submitting)** were still being built this morning. Handoff items described as
"unverified" are treated here as not proven.

**The three rules for today**

1. Push every line of demo code before **12:00 PM EDT**, then stop pushing. The event's rules disqualify code pushed
   after the deadline.
2. Demo only what passed three timed rehearsal runs in a row on the venue network.
3. A difference from Medicare is a reason to ask, never proof of an error. Never say "overcharge" or "you'll save".

## 1. Event facts

Checked 2026-10-11 between 06:00 and 06:20 EDT, and again between 06:48 and 07:00 EDT for the fact-check.

| Fact | Source | Status |
|---|---|---|
| Hack Knight Fall 2026, Queens College (CUNY), Flushing NY. Hacking Oct 9 12:00 PM to Oct 11 12:00 PM. | [Devpost rules](https://hack-knight-fall-2026.devpost.com/rules); [hackknight.org](https://hackknight.org/) schedule (read from the site's public API, `api.hackknight.org/api/schedule`) | Confirmed |
| Devpost deadline: Oct 11, 2026 @ 12:00pm EDT. | [Devpost overview](https://hack-knight-fall-2026.devpost.com/) | Confirmed |
| Judging 12:30 PM to about 2:30-3:00 PM in the Dining Hall; winners and closing ceremony about 3:30-4:00 PM in Rosenthal Library. | Devpost rules. The hackknight.org schedule shows judging 12:30-3:00 PM and closing 3:00-4:00 PM. | Confirmed; the two sources differ slightly on the closing time |
| "Live demo required to win a track (science fair style)". | Devpost overview and rules | Confirmed |
| "For software, all code must be submitted via a GitHub link (any code pushed past the deadline or before the start of the hackathon will be disqualified)". | Devpost rules | Confirmed |
| Eligibility: students, teams of 2-4, in-person check-in, "Must not have worked on the project before the start of the hackathon". | Devpost rules | Confirmed. Our first commit is 2026-10-09 12:51 PM EDT, after hacking began. |
| Judging criteria: Creativity, Completeness, Presentation, Alignment With Track, Design (overview page); Creativity, Alignment with Track, Completeness (rules page). No weights published. | Devpost | Confirmed; the two pages differ |
| Participants agree to the [MLH hackathon rules](https://github.com/MLH/mlh-hackathon-rules/blob/master/Rules.md): stop hacking at time (small fixes allowed), demos over pitches, and default criteria Technology, Design, Completion and Learning weighed equally. | Devpost rules link | Confirmed that they apply; how judges combine them with Hack Knight's own criteria is not stated |
| 13 non-cash prizes: Best Overall, Runner-up, Financial (Diameter Capital), Health, Environmental, Beginner, and MLH's ElevenLabs, Gemini API, Solana, Tiger Data, Presage, Snowflake API and GoDaddy Registry categories. Best Overall includes 3 months of ElevenLabs Pro; the ElevenLabs category adds 3 months of ElevenLabs Scale. | Devpost overview; [MLH prize page](https://www.mlh.com/events/hack-knight-3d/prizes) | Confirmed |
| A video is required only for hardware projects. | Devpost "What to Submit" | Confirmed |
| Themes listed: Beginner Friendly, Fintech, Health. 262 registered participants. | [Devpost overview](https://hack-knight-fall-2026.devpost.com/); [Devpost API listing](https://devpost.com/api/hackathons?search=hack%20knight) | Confirmed |
| ElevenLabs is a Gold sponsor; Bloomberg Platinum; Diameter Capital Gold. | hackknight.org sponsors (site API) | Confirmed |
| hackknight.org lists no tracks or prizes. Its FAQ says prizes and certificates go to "the top teams in each track" and that prizes "will be announced soon". The track list is on Devpost. | hackknight.org site code (FAQ) | Confirmed |
| MLH's prize page also lists a "DEV Writing Challenge" ($100, chosen by DEV's editors). It is not on the Devpost list. | [MLH prize page](https://www.mlh.com/events/hack-knight-3d/prizes) | Confirmed |

Not confirmed (ask an organizer or at the MLH table, or find out at the venue):

- How many judges visit each table and for how long. MLH's organizer guide says judges "only have 3 minutes per
  team", budgets 2 minutes of presentation and demo in a 4-minute slot per project, and aims for each project to be
  seen at least 3 times ([MLH judging plan](https://guide.mlh.com/general-information/judging-and-submissions/judging-plan)).
  Hack Knight has not published its own numbers.
- Who judges the MLH categories (including ElevenLabs) and when; MLH's prize page does not say.
- Whether ElevenLabs staff judge at the venue.
- How many prize categories one project may enter on Devpost.
- Whether judges can open a private GitHub repo. Ours is private (see DEVPOST.md).
- Whether the Dining Hall Wi-Fi lets a phone reach a laptop, and whether tables have power outlets.

**What the research says, and how this plan uses it**

- Judges walk to each table and get only a few minutes; MLH's guide gives 2 minutes of presentation and demo in a
  4-minute slot, and says judges "only have 3 minutes per team"
  ([MLH judging plan](https://guide.mlh.com/general-information/judging-and-submissions/judging-plan)).
  So the default demo is 90 seconds, which leaves time for questions.
- MLH's rules favor showing what was built over pitching
  ([MLH rules](https://github.com/MLH/mlh-hackathon-rules/blob/master/Rules.md)), and judges quoted by JetBrains want
  something working within about 90 seconds and one flow, not a feature tour
  ([JetBrains](https://blog.jetbrains.com/ai/2026/06/how-to-win-a-hackathon-notes-from-the-judging-table/)). So the
  demo is one loop: paper, reading, review, voice.
- Devpost advises explaining the problem "in a few sentences", calls the demo "the most important part", and says to
  "Skip mundane flows such as creating user credentials"
  ([Devpost](https://info.devpost.com/blog/how-to-present-a-successful-hackathon-demo)). So profiles and demo cases
  are prepared before judging, and onboarding is never shown.
- How you answer judges' questions can matter more than the first demo, and the talk and the demo should happen
  together ([kipply](https://kipp.ly/p/hackathon-tips)). So every role carries the 8 answers, and the script talks
  over the live screens.
- Venue and guest Wi-Fi often isolate devices, which breaks phone-to-laptop demos (section 9 sources). So the plan uses
  a network the team controls.

## 2. Today's timeline (EDT)

| Time | What | Who |
|---|---|---|
| Now to 9:45 | Finish or drop each in-progress item: language-verified voices and Guide conversations (committed locally at `2e92a11`), faster reading and identifier redaction in recorded questions (`d1aa47a`), the example call (`802f2a1`), demo documents (each in progress, confirm before submitting). None of these is pushed or checked on a device yet. Merge an item only with its tests passing. | Each owner |
| 9:45 | **Feature freeze.** Push what exists now, as a safety copy. Choose the backend host and the API address (section 9). | Everyone |
| 9:45-10:30 | Run the backend host on the frozen code. The live agent was re-provisioned at `2e92a11` with a prompt that uses a new `guide_topic` variable. A backend on older code (for example the Mac's, if it still runs `merged-v1`) does not send it; a live check showed its bill calls still start and answer, but Guide-term calls need `2e92a11` or later. Test a call through each backend you use. Build to the chosen address: iPhone release build (Mac and Xcode), Android build (run `npx expo prebuild --clean` first, because the app ID changed to `footnote.compare`; a clean build is slow, so start it first), web build. Install, clear old cases, seed the demo cases, warm the caches, start one live call from each device, print the documents. | Suggested: Aarush (iPhone), Nimesh (Android, backend), the other two (printing, props) |
| 10:30-11:15 | Three timed runs in a row of the 90-second demo on the real network. Trigger each fallback once. Record the backup video. | Everyone |
| 11:15-11:35 | Final push of every branch the demo needs. Fix GitHub access and the linked branch. Check that no secret is in the repo or its history. | Repo owner (CaspLian) |
| 11:35-11:50 | Paste DEVPOST.md, select prizes, add the video link, submit. Open the submitted page logged out. | Presenter |
| 12:00 | Deadline. No more pushes. If a small fix seems necessary after noon, ask an organizer first. | |
| 12:00-12:30 | Set up the table, check each phone's connection, one warm-up run, eat in shifts. | Everyone |
| 12:30-3:00 | Judging. Rotate roles every 30 minutes (section 6). | Everyone |
| About 3:30-4:00 | Winners and closing ceremony, Rosenthal Library. | Everyone |

## 3. What is proven on each device

From the handoffs and status docs. "Not recorded" means no repo document shows it working.

| Path | Laptop (Expo web) | iPhone | Android phone |
|---|---|---|---|
| Import, Gemini reading, verify, review | Verified 2026-10-10 with a synthetic bill | Camera refinements "verified live on Aarush's iPhone" (2026-10-11); a full capture-to-review run is not separately recorded | Not recorded on a physical phone; the emulator only built, installed and showed the screens |
| Listen (ElevenLabs reading) | Verified | Not recorded (iPhone playback is listed as unverified) | Emulator: "Plays and stops correctly" (Nimesh) |
| Voice preview | Verified | Not recorded | Emulator: audible after the fix |
| Live conversation | Verified 2026-10-10 in Chrome with a synthetic microphone: captions, card highlight, mute, End | Aarush confirmed the agent hears and answers (2026-10-11); caption rendering on the phone still needed a check | Not recorded natively |
| Typed question in a call | Verified (second web call) | Not recorded | Not recorded |
| Live call about a bill in a language other than English | Not recorded | Not recorded | Not recorded |
| Reopen a saved case | Verified | Not recorded; saved cases survived the earlier reinstalls, but a `footnote.compare` install starts empty | Emulator only |
| Language-verified voices, previews in the language, Guide-term calls | Backend live checks on 2026-10-11: 235 voice clips transcribed back in their languages; Guide-term answers in 6 languages in 1.3-1.8 s. Web app (headless Chrome, Spanish, 2026-10-11): the voice list and Spanish previews, a Guide-term call that explained "deducible" in Spanish, the Set A bill and EOB read and reviewed with every planted question, and the example call played (59 s) | Not recorded; needs a rebuild | Not recorded; needs a rebuild |
| Faster reading, example call, identifier redaction | Backend live checks on 2026-10-11 (commit messages of `d1aa47a` and `802f2a1`). Web app: the example call was ready 17 s after the call-script screen opened and played; redaction was checked through the API only | Not recorded; the example call needs a rebuild | Not recorded; the example call needs a rebuild |

**Go/no-go rule.** A device does a job at the table only after three passing runs in a row today, on the venue
network. If the Android capture fails, the iPhone takes the capture and Android shows saved cases. If a phone's live
call fails, run the conversation on the laptop with a headset.

## 4. Station layout

```
                        JUDGES' SIDE
 +--------------------------------------------------------------------+
 |  [sign: Footnote + one line + table number + QR code to Devpost]    |
 |                                                                     |
 |  1. CAPTURE (left)      2. EVIDENCE (center)      3. VOICE (right)  |
 |  Android on a stand     Laptop facing judges:     iPhone on a stand |
 |  over the printed       web app review with the   at chest height,  |
 |  bill and EOB on a      original beside it;       case read in the  |
 |  clipboard              tabs: architecture,       demo language,    |
 |                         proof, backup video       captions on       |
 |                                                                     |
 |  back edge: power strip, chargers, battery pack, hotspot, earbuds   |
 +--------------------------------------------------------------------+
                         TEAM SIDE
```

| Station | Device | What it shows | Why this device |
|---|---|---|---|
| 1. Capture | Android phone | Live photos of two printed pages (with Set A, the bill's itemized charges and the EOB's claim detail), read while the judge watches; then "Check the details" with "View original" | The strongest proof that it's live is reading paper the judge just held. A phone camera is how real users would start. |
| 2. Evidence | Laptop (also the backend host) | Tab 1: the Footnote web app on the review of the same documents, read this morning. Tab 2: the architecture card. Tab 3: proof (latency table, tests, a live Snowflake lookup, the API's `/docs`). Tab 4: the backup video, as a local file. | Large screen for groups of judges; technical judges can inspect; nothing waits on Gemini. |
| 3. Voice | iPhone | A live call (one tap on the orb) about the same case in Spanish, or in a language a teammate speaks well, with captions; "Listen with the ElevenLabs voice" as the quiet fallback | The iPhone is the only phone with a confirmed live microphone conversation. A second language is the ElevenLabs moment. |

The demo language: use Spanish only if a teammate speaks it comfortably. Otherwise pick a language someone speaks
well from the 29 app language choices that live calls support (all 31 except Hebrew and Thai, which have readings but
no live calls). The app's Spanish is Spain's Spanish (`es-ES`), and its Portuguese is Portugal's. A call uses the
phone's working language, which also sets the whole interface, so read the iPhone's demo case with that language
already chosen. Keep English ready for judges.

## 5. Order of moves

**One judge (default, 90 seconds):** hook with the paper in the judge's hands, then live capture at Station 1, then
the morning copy's review at Station 2 while Gemini reads, then one question to the agent at Station 3, then close and
let the judge ask their own question. Log the visit.

**Two judges at once:** P takes the first through capture and review. V starts the second at the voice station
("let's start with the conversation"), then they swap.

**A line forms:** E gives the 15-second hook to the people waiting and hands them the printed documents to look over.

**A judge with more time (3 minutes):** add Listen, Prepare request (draft, Share PDF, Mark submitted), a follow-up
reminder on the Timeline, and the deep-dive for their background (section 12). If the example call shipped (in
progress, confirm before submitting), an ElevenLabs judge gets "Open call script" and "Play the example call".

**A judge in a hurry (60 seconds):** hook, straight to the voice station, one sentence on how it is built.

**A judge who wants to drive:** let them take the photo and ask the agent anything. Offer: "Ask it about any line."

## 6. Roles and rotation

| Role | Job |
|---|---|
| P, Presenter | Greets, gives the hook, picks the version for the judge's background, takes questions first and hands deep ones to the owner. |
| C, Capture driver | Runs the Android capture, keeps the paper stacked, resets Station 1. |
| V, Voice driver | Runs the iPhone call: unmute to ask, mute to talk to the judge, typed fallback, End between judges. |
| E, Evidence and operations | Laptop tabs, backend window, network, quotas, fallback switches, the judge log, scouting for MLH or sponsor judges. |

Rotate one step every 30 minutes (P to C, C to V, V to E, E to P) so all four present. Each person runs each role once
during rehearsal. If only one teammate speaks the demo language, either keep that person as V and rotate the other
three, or let each V read the demo-language question from an index card. Questions go to the owner of the part:
voice and backend wiring, Nimesh; the app and design, Aarush; Tiger Data and camera capture, GitHub CaspLian; Gemini
and Snowflake, GitHub null-007. Start with the strongest speaker as P, someone fluent in the demo language as V, and
the backend host's owner as E.

| Slot | P | C | V | E |
|---|---|---|---|---|
| 12:30-1:00 | Teammate 1 | Teammate 2 | Teammate 3 | Teammate 4 |
| 1:00-1:30 | Teammate 4 | Teammate 1 | Teammate 2 | Teammate 3 |
| 1:30-2:00 | Teammate 3 | Teammate 4 | Teammate 1 | Teammate 2 |
| 2:00-2:30 | Teammate 2 | Teammate 3 | Teammate 4 | Teammate 1 |
| 2:30-3:00 | Teammate 1 | Teammate 2 | Teammate 3 | Teammate 4 |

Fill in names. Whoever is E is also on call for the network, whatever the slot.

## 7. Props and packing list

- Printed documents: Set A, the planned itemized bill and matching EOB (in progress, confirm before submitting), three
  copies in sheet protectors. As built at 06:52 each has 3 pages; mark the two pages C photographs live. Set B,
  `backend/samples/sample_bill.png` (it already reads "SAMPLE BILL - FOR TESTING ONLY - NOT A REAL PATIENT"), two
  copies as the proven fallback.
- A clipboard or plain dark mat under the paper, for camera contrast. Good light; avoid glare on sheet protectors
  when photographing (slide the page out).
- Two phone stands, or one stand and one small tripod for the capture station.
- One pair of earbuds with a microphone for the voice driver (adapters if wired). Do not hand earbuds to judges.
- An optional small speaker for the iPhone; rehearse it first, since echo was not tested.
- Laptop charger, a power strip or extension cord, phone chargers (USB-C and Lightning), a battery pack, and a USB
  cable for the Android phone (for `adb reverse`, section 9).
- The hotspot device, if section 9 uses one, with its data plan checked.
- A table sign: "Footnote", the one-line description, the table number if assigned, a QR code to the Devpost project
  page (make it after submitting; test it with both phones), and "synthetic documents only".
- One printed architecture page and one printed "today versus next" page, for judges who like paper.
- Index cards with the 8 answers from PITCH-AND-SCRIPT.md, one set per teammate.
- A sticky note with the API address, the hotspot name and the fallback order. No passwords or keys on it.

## 8. Noise plan for voice

The Dining Hall will be loud. In order:

1. **Captions stay on** (the default), so judges can read the agent even when they can't hear it.
2. **Speaker at full volume, phone at chest height** between the judge and the speaker, who leans in.
3. **Manual push-to-talk.** The live call has no hold-to-talk button; a single tap on the orb mutes or unmutes the
   microphone. Unmute for the question, mute while talking to the judge, so crowd noise doesn't interrupt the agent.
4. **Earbuds with a microphone** for the voice driver if the phone microphone picks up the room. Bluetooth routing
   with the live call was not tested; rehearse it.
5. **Type the question**: long-press the orb, "Type a question", then "Send question". The button appears only while a
   call is connected. The answer is still spoken and captioned (verified on the web).
6. **"Listen with the ElevenLabs voice"** on the review: the prepared reading needs no microphone.
7. **Ask a recorded question**: appears in the orb's controls when live voice is unavailable; up to 30 seconds; its
   answer does not include the bill, so say that.
8. **The laptop with a headset** as a second voice station; then the backup video, which has captions.

Start a fresh call for each judge and end it afterwards (double-tap the orb, or "End conversation"). Calls end by
themselves after 2 minutes of silence or 10 minutes in total.

Call budget: the backend issues at most 30 new live calls per hour across all devices
(`ELEVENLABS_AGENT_SESSIONS_PER_HOUR`, up to 300), and one per device every 10 seconds. The agent is provisioned with
a daily limit of 60 calls and 4 at a time, so count rehearsal calls this morning. Rehearsals, warm-up calls and
judging can approach 60. The backend's settings check does not read that limit, so it can be raised in the
ElevenLabs dashboard; running the provision command again resets it to 60.

## 9. Network plan

What has to connect:

- Phones reach the backend API over HTTP (port 8000) for reading, readings, saved cases and call tokens.
- Phones also need the internet for live calls: the WebRTC audio goes from the phone to ElevenLabs directly.
- The backend laptop needs the internet for Gemini, Snowflake, Tiger Data and ElevenLabs.
- Release builds carry the API address they were built with (`EXPO_PUBLIC_API_URL`). On 2026-10-10 the iPhone build
  pointed at `http://192.168.1.28:8000`. That address must work at the venue, or the app must be rebuilt.
- Venue and guest Wi-Fi often isolate devices from each other, so a phone and a laptop on the same network still can't
  talk ([TP-Link](https://www.tp-link.com/us/blog/2586/what-is-ap-isolation-and-when-to-enable-it-/),
  [Cisco Meraki](https://documentation.meraki.com/MR/Firewall_and_Traffic_Shaping/Wireless_Client_Isolation)).
- The API has no authentication. Keep it on a network the team controls.
- The laptop's web app must be opened at `http://localhost`: browsers allow the microphone only on secure pages, and
  the backend accepts live calls only from loopback web origins unless `ELEVENLABS_AGENT_ALLOWED_ORIGINS` is set.
- A development build loads its JavaScript from Metro (port 8081) on the laptop. The iPhone build is a release build
  with the JavaScript bundled. No record shows which kind the Android phone has; if it is a development build, it
  also needs Metro reachable (or `adb reverse tcp:8081 tcp:8081` over USB), or build a release variant.

Choose one option at 9:45 and build every app to it.

| Option | How | Good | Risk |
|---|---|---|---|
| A. Laptop hotspot (recommended if the Windows laptop hosts the backend) | Windows Settings, Mobile hotspot, sharing the venue Wi-Fi or a phone's USB tether. The host usually gets `192.168.137.1` ([Microsoft Q&A](https://learn.microsoft.com/en-us/answers/questions/ebae0f96-e2b6-4b66-ac4e-0fcc3d950ea6/windows-10-mobile-hotspot-setup-using-static-ip?forum=windows-all)); build the phones with `http://192.168.137.1:8000`. Run `uvicorn main:app --host 0.0.0.0 --port 8000`, one process. Allow Python through Windows Defender Firewall on private networks only (a Public profile blocked phones on 2026-10-10). If Windows lists the hotspot connection as Public, set that one connection to Private (administrator PowerShell: `Set-NetConnectionProfile -InterfaceAlias "<hotspot adapter>" -NetworkCategory Private`; check this morning that the laptop account can run it) rather than allowing Python on Public networks, which would expose the API on the venue Wi-Fi. | Predictable address; not affected by venue isolation; phones get internet through the laptop | The laptop's Wi-Fi card must host while connected; if the laptop fails, everything fails |
| B. A teammate's phone hotspot | All three devices join it; read the laptop's address with `ipconfig` and build to it | Independent of venue Wi-Fi | The address can change if the hotspot restarts; limited devices; cellular signal in the hall |
| C. USB for Android | If the Android build uses `http://127.0.0.1:8000`, keep it on a USB cable and run `adb reverse tcp:8000 tcp:8000` (again after any adb restart) | No Wi-Fi needed for the API | The phone still needs internet for live calls; not available for the iPhone |
| D. A tunnel with a fixed HTTPS hostname | Build the phones to that hostname | Works on any network with internet | Exposes the unauthenticated API (credits, and saved analyses by ID) on the public internet; all devices then share one 10-second call limit. Only if A-C fail; stop it after judging; never print the URL |
| E. Venue Wi-Fi as is | Only if a phone's browser opens the laptop's health URL on it | No setup | Fragile; the address can change |

If the Mac hosts the backend instead, the same rules apply: a network the team controls, an address you can predict,
and builds made for that address.

**Check on each phone after joining:** open `http://<host>:8000/` in the phone's browser (health JSON with
`"mock": false`), then Footnote Settings, Connection: it must say "Connected to Footnote" ("Connected · Document reading
unavailable" means the backend is in mock mode). When a document reading cannot reach the backend, its error message
names the address the build was made with.

## 10. Failure fallbacks

Decide the trigger before it happens; switch at the trigger instead of waiting.

| Problem | Trigger | Do this | Say |
|---|---|---|---|
| Reading is slow | "Understanding your documents" past 25 s | Carry on with the morning copy on the laptop; come back to the fresh reading at the end | "It's still reading; here's the same paper, read this morning." |
| Reading fails (quota, error) | Error screen | "Try again" once, then reopen the saved case from Bills: it reopens without a new Gemini call, and its reading plays from the cache | "The reading service is limited right now; this copy was read this morning." |
| Snowflake down | The app does not show which source answered. On the laptop, `/api/v1/benchmarks/70450` shows `"source": "local_csv"` | Nothing; the fallback is automatic, and the API response labels it | "That reference came from our bundled copy of the same CMS table." |
| Tiger Data down | A fresh reading's review has no Listen button, and the orb says "Live conversations need a bill that Footnote has read" | Reviews already on the phones still open from local storage, but readings and live calls need the database, so for voice play the backup video | "Our case database isn't reachable, so here's the recording of the voice part." |
| Live call won't start | No greeting within 8 s, or an error under the orb | Retry once after 10 s (the backend allows one new call per device every 10 s), then "Listen with the ElevenLabs voice", then the laptop call, then the video | "Let me play the prepared reading instead." |
| The agent can't hear | Greeting played, but two questions got no answer | Long-press the orb, "Type a question" | "It's loud in here, so I'll type it." |
| A phone can't reach the backend | Settings connection check fails | Demo on the laptop; E fixes the network in the background | "The phones dropped off the network, so here it is on the laptop." |
| No internet at all | Everything fails | Saved reviews on the phones, the backup video, the printed architecture page | Say plainly what failed. |
| App crashes | | Relaunch; use another device | |
| Laptop dies | | The backup video copied to a phone (offline file), printed pages | |

**Mock mode, last resort for the voice demo when Gemini is down:** restart the backend with `MOCK=true`. Every reading
then returns the same fixed Spanish sample, not the printed document; the agent is told it is a test sample, and
Settings shows "Connected · Document reading unavailable". Say so to the judge, and turn it off afterwards.

Never present a saved or recorded result as live. "Read this morning" and "recorded" are fine words.

## 11. Pre-demo checklist

**Phones and laptop**

- [ ] Charged to 100%, chargers plugged in at the table.
- [ ] Do Not Disturb or Focus on; notifications silenced. Do not use airplane mode, which cuts Wi-Fi and the hotspot.
- [ ] Auto-lock and screen timeout off (iPhone: Display & Brightness, Auto-Lock, Never; Android: longest timeout, or
      "Stay awake" while charging).
- [ ] Brightness at maximum, auto-brightness, Night Shift and True Tone off; Low Power Mode off.
- [ ] Volume at maximum; the iPhone's silent switch off; Android media volume up.
- [ ] One Footnote app per phone (remove builds with the earlier name or app ID).
- [ ] Camera, microphone and, on iPhone, Local Network permissions granted.
- [ ] App lock off for the demo, unless you plan to show it.
- [ ] Settings connection check passes; the voice list loads.
- [ ] Laptop: sleep off while plugged in, notifications off, chat apps closed, only the four demo tabs open.

**App state: fresh install or saved cases**

- [ ] Clear test clutter first: Settings, "Delete imported cases". It removes every imported case on that device, so
      do it before seeding the demo cases, never after.
- [ ] Decide per device. Recommended: one fictional profile, the Set A case in English on Android and the laptop, the
      Set A case in the demo language on the iPhone (Set A is in progress, confirm before submitting; without it, use
      Set B in both places), and the Set B case on every device as a backup.
- [ ] For each demo case: play "Listen with the ElevenLabs voice" once (warms the cache) and start and end one live
      call. If the example call shipped, open the case's call script once too: the first example call took 15-21 s
      to make, a repeat 0.3 s.
- [ ] Captions on; the voice chosen and previewed in each language you will use.

**Backend host**

- [ ] All keys only in `backend/.env`; never open it on screen; no key in the app or on the table.
- [ ] `MOCK=false`; the Gemini model set as decided (the faster-reading change is in progress, confirm before
      submitting); the health JSON shows `"mock": false`.
- [ ] Gemini quota: billing enabled on the key, or the remaining free-tier requests checked.
- [ ] One `uvicorn` process (no `--workers`), started with `--host 0.0.0.0 --port 8000`.
- [ ] Snowflake warmed: open `/api/v1/benchmarks/70450`; `source` should say `snowflake`. The first lookup after a
      restart took 10.8 s; since `802f2a1` the backend also loads the table at startup (`PRICE_WARM_UP`).
- [ ] ElevenLabs checked without spending credits: `python -m text_to_speech.check_setup` from
      `backend/services/audio_service`.
- [ ] The backend runs the frozen code. Guide-term calls need `2e92a11` or later; bill calls also work on older
      code (checked live). A live call starts from each phone and the laptop.
- [ ] Live-call count noted (60 per day for the agent; 30 per hour from the backend).
- [ ] Terminal minimized; provider dashboards closed or logged out on the display laptop.

**Submission**

- [ ] All code pushed before 12:00 PM; the GitHub link opens for a logged-out visitor; Devpost submitted; QR printed.

**Between judges (about 15 seconds)**

- [ ] End the call; return the iPhone to the review.
- [ ] Android back to Home; paper restacked.
- [ ] Laptop back to Tab 1.
- [ ] One line in the judge log.

## 12. Tailoring the 90 seconds

Keep the general version (PITCH-AND-SCRIPT.md) as the base. Change one beat, about 20 seconds, for the judge's
background, and keep the same honest limits. Ask "What do you work on?" if you don't know.

| Background | Emphasize | Show | Add one sentence | Expect |
|---|---|---|---|---|
| Engineering and systems | Data flow, failure behavior, written contracts, tests | Tab 3: `/docs`, a live `/api/v1/benchmarks/70450`, the latency table | "Every route has a written contract and a screen that uses it; a failed price lookup or save returns a labeled result instead of an error." | "What happens under load?" Not load-tested. Provider limits apply: 4 simultaneous agent calls, readings cached. |
| Finance | Exact money: integer cents, statement and EOB amounts kept apart, blanks never zero, a remaining balance only from matching evidence | Verify's blank fields; the review's amount rows | "We never add a bill's numbers to an unrelated EOB, and a blank is never a zero." | "Who decides what's owed?" The documents and the billing office, not Footnote. |
| Healthcare | Bill versus EOB; billing correction (provider) versus appeal (insurer); doctor-only references; CMS 2026 national rates | A doctor-only price card; Prepare request with both draft types | "A correction goes to the provider and an appeal to the insurer, so Footnote keeps them separate." | "Facility versus professional fees?" That is exactly why doctor-only references get a question, not a ratio. |
| Security and privacy | Data flow per provider; short-lived call tokens; keys on the server; origin checks and limits; no authentication yet; bill text treated as data | The "Data use" note in the orb's long-press controls (it is not shown before a call starts); the "Privacy and safety" paragraph | "The app never holds a provider key; each call gets a fresh token that must be used within 10 minutes." | "Can a malicious document steer the agent?" The prompt treats bill text as data and the tools can only highlight; no adversarial tests run yet. |
| AI and ML | Structured output validated by Pydantic; per-file classification; human verification; bounded agent context (under 12 KB) at temperature 0.2; number checks on translations | Verify, then a call that cites the saved amount | "The model proposes; the person confirms; the numbers the agent speaks come from the confirmed record." | "How do you evaluate it?" Not measured yet; a labeled synthetic set is next. |
| ElevenLabs or voice | Depth across three ElevenLabs APIs: readings (Flash v2.5 with number normalization, language codes, v4 Turbo for Hebrew and Thai, a voice catalog carrying ElevenLabs' verified-language metadata, cache, byte ranges); questions (Scribe v2 with a confidence check); the live agent (Gemini 3.5 Flash, private auth, bounded bill variables under 12 KB, two client tools, `language_detection` and `end_call`, 32 configured languages and 29 reachable from the app, a short recognition keyword list, typed messages, streaming captions) | The demo-language call, a typed question, "Listen with the ElevenLabs voice" | "Voice isn't an add-on here: it reads, listens and holds a grounded conversation about your own bill." | "What's next?" Language-verified voices (only voices ElevenLabs verified for the language, a verified default per language, previews in that language), Guide conversations, an example call made with Text to Dialogue, and keyterms plus identifier redaction for recorded questions: all in progress, confirm before submitting. Candidates only: read-along highlighting from timestamps, a practice-call agent. |
| Product or past winners | The one moment that works; what was built this weekend versus planned; design polish | Let them drive both phones | "Everything you touched was built since Friday noon." | "What would you cut?" Anything not in the one loop. |
| Not technical | The story and the voice | Paper, then the call | "You can just ask it, in your language." | "Can my parents use it?" That is who it is for; native-speaker review is still needed. |

How the demo maps to the published criteria: **Creativity**, a conversation grounded in your own bill, in your
language; **Completeness**, one loop across three devices that saves and reopens; **Presentation**, the 90-second
script with the paper in the judge's hands; **Alignment with track**, health, finance, ElevenLabs and Gemini;
**Design**, verify-first flow, captions, large touch targets, right-to-left text and reduced-motion support.

## 13. Judges

Angles are inferred from published roles, not predictions. The plan above works for any technical judge.

| Judge | Devpost | hackknight.org | Prepare for |
|---|---|---|---|
| Raja Sharma | Senior Software Engineer @ Bloomberg | Senior Software Engineer (no company shown) | Money handling, source data, failures |
| Diego Perez | Software Engineer @ Bloomberg | Software Engineer (no company shown) | Same |
| Nick Pisciotta | Software Engineer @ Boardable | Not listed | Who benefits first; maintainability |
| James Oh | Software Engineer @ Outtake AI | Software Engineer, Hackathon Winner (Outtake) | The working moment; built versus planned |
| Sad Adib | Software Engineer @ J.P. Morgan | Software Engineer (JPMorgan Chase) | Authorization, financial correctness, abuse limits |
| Omobolaji Alabi | Software Engineer @ Google | Software Engineer (Google) | Model choice, structured output, value beyond one model call |
| Will Pelech | Software Engineer @ Datadog | Software Engineer (Datadog) | Latency, timeouts, retries, diagnosing failures without logging bills |
| Moses Parente | Cloud Engineer @ FedEx | Cloud Engineer (FedEx) | Deployment, concurrency, provider outages |
| Ehab Abdalla | Software Engineer @ Baselayer | Software Engineer, Hackathon Winner (Baselayer) | The working moment; built versus planned |
| Arvind Majumder | Associate Software Engineer @ Northwell | Associate Software Engineer (Northwell) | Valid comparisons, patient responsibility, correction versus appeal |
| Saurav Luthra | Associate AI Engineer @ Diameter Capital | Associate AI Engineer (Diameter) | AI evaluation and money correctness; Diameter sponsors the Financial prize |
| Dr. Shweta Jain | Professor @ John Jay | Professor (John Jay College) | Security boundaries and evidence integrity |
| Avijit Roy | Professor @ John Jay | AI & Cybersecurity Researcher (John Jay College) | Privacy, adversarial robustness, language limits |
| Angel (Kerlyn) Difo | Not listed | Software Engineer (Google and Datadog logos) | Engineering and observability |

Changes since `docs/judge-answers-20261010.md`: Saurav Luthra appears on both lists; Angel (Kerlyn) Difo appears only
on hackknight.org; Nick Pisciotta appears only on Devpost; hackknight.org no longer shows a company for Raja Sharma
and Diego Perez.

## 14. Laptop evidence tabs

- **Tab 1:** the Footnote web app at `http://localhost:<port>` on the demo case's review.
- **Tab 2:** the architecture card (the diagram in DEVPOST.md, "How we built it").
- **Tab 3:** proof. `http://localhost:8000/api/v1/benchmarks/70450` (a live Snowflake lookup with its `source`),
  `http://localhost:8000/docs` (the generated API schema), the table below, and the latest test results. If a SQL
  client is already connected, a read-only query from `docs/sql/view-tiger-audits.sql` shows the saved case; never show
  a connection string.
- **Tab 4:** the backup video, as a local file.

Measured speeds to show (small samples on our machines, not load tests):

| What | Measured | When | Source |
|---|---|---|---|
| Gemini reading of the sample bill photo | 6-9 s, all 3 lines, codes and amounts right | 2026-10-10 | `docs/PROJECT_CONTEXT.md`, `BACKEND_VERIFICATION_REPORT.md` |
| Gemini reading in the web journey | 14.3 s | 2026-10-10 | `docs/handoffs/claude-resume-integration.md` |
| Whole reading (918 characters): Flash v2.5 versus Multilingual v2 | 1.89 s versus 8.49 s | 2026-10-10 | `docs/decisions/2026-10-09-tts-default-model.md` |
| First streamed audio (the app does not use streaming) | 0.43 s | 2026-10-09 | `docs/PROJECT_CONTEXT.md` |
| Listen on a prepared reading | about 0.24 s | 2026-10-10 | `docs/decisions/2026-10-10-voice-prepared-early.md` |
| Hebrew or Thai reading (v4 Turbo) | 12-18 s | 2026-10-10 | `docs/API_CONTRACTS.md` |
| Speech-to-text of 63 s of audio | 4.6 s | 2026-10-09 | `backend/services/audio_service/README.md` |
| Live web calls | 40 s and 20 s calls, both ended normally | 2026-10-10 | `docs/handoffs/backend-voice-agent.md` |
| Guide-term live answers | 1.3-1.8 s, in 6 languages | 2026-10-11 | `docs/decisions/2026-10-11-native-voices-and-guide-conversations.md` |
| Gemini reading with "low" thinking | Set A as 6 phone photos: 16.1 s instead of 80.8 s; Northline bill + EOB: 5.3 s instead of 16.7 s; a receipt photo 4.4 s instead of 13.9 s; all lines and financial fields exact | 2026-10-11 | `docs/decisions/2026-10-11-gemini-low-thinking.md` |
| First bill after a backend restart | about 21 s before the price-table warm-up, 7.7 s after it | 2026-10-11 | commit message of `802f2a1` |
| Example call | 15-21 s to make the first time, 0.3 s on a repeat; 17 s from opening the screen in the web app | 2026-10-11 | commit message of `802f2a1` |
| Tests at `14e0c71` | 197 app, 198 backend (2 skipped), 675 voice; 26 web (3 skipped) at the merge `3ad973c` | 2026-10-11 | commit messages (not rerun by the fact-check) |

## 15. Judge log

| Time | Judge | Background | Version used | What landed | Questions | Follow-up |
|---|---|---|---|---|---|---|
| | | | | | | |

## 16. Sources

Accessed 2026-10-11.

- Event: [Devpost overview](https://hack-knight-fall-2026.devpost.com/), [Devpost rules](https://hack-knight-fall-2026.devpost.com/rules),
  [Devpost resources](https://hack-knight-fall-2026.devpost.com/resources), [hackknight.org](https://hackknight.org/)
  (content read from the site's API: `https://api.hackknight.org/api/judges`, `/api/schedule`, `/api/sponsors` and
  `/api/settings`; the bare `/api/` address returns 404),
  [MLH event prizes](https://www.mlh.com/events/hack-knight-3d/prizes), [MLH 2027 season list](https://www.mlh.com/seasons/2027/events/),
  [MLH hackathon rules](https://github.com/MLH/mlh-hackathon-rules/blob/master/Rules.md).
- Judging and demos: [MLH judging plan](https://guide.mlh.com/general-information/judging-and-submissions/judging-plan)
  (science-fair format, "only have 3 minutes per team", 2 minutes of presentation and demo in a 4-minute slot, at
  least 3 visits per project), [Devpost: how to present a demo](https://info.devpost.com/blog/how-to-present-a-successful-hackathon-demo)
  (explain the problem in a few sentences, the demo is "the most important part", skip mundane flows),
  [JetBrains: notes from the judging table](https://blog.jetbrains.com/ai/2026/06/how-to-win-a-hackathon-notes-from-the-judging-table/)
  (show something working within about 90 seconds, one flow, be direct about what works),
  [kipply: hackathon tips](https://kipp.ly/p/hackathon-tips) (demo while you talk; answers to judges' questions can
  matter more than the first demo).
- ElevenLabs tracks: the [MLH ElevenLabs category text](https://www.mlh.com/events/hack-knight-3d/prizes) ("natural,
  human-sounding audio", "voice-enabled apps", "fully autonomous audio experiences"). No published scoring rubric was
  found. ElevenLabs' own write-up of hackathon winners in care ([ElevenLabs blog](https://elevenlabs.io/blog/how-hackathon-teams-are-using-elevenlabs-to-make-care-more-accessible),
  June 2026) highlights voice "removing the barriers of language, time, and technical skill that keep people from
  getting help", including a winner that spoke to patients in their own language. Footnote's ElevenLabs story follows
  that: depth across three APIs, used for access in the user's language.
- Networking: [TP-Link on AP isolation](https://www.tp-link.com/us/blog/2586/what-is-ap-isolation-and-when-to-enable-it-/),
  [Cisco Meraki on client isolation](https://documentation.meraki.com/MR/Firewall_and_Traffic_Shaping/Wireless_Client_Isolation),
  [Microsoft Q&A on the hotspot address](https://learn.microsoft.com/en-us/answers/questions/ebae0f96-e2b6-4b66-ac4e-0fcc3d950ea6/windows-10-mobile-hotspot-setup-using-static-ip?forum=windows-all).
- Repo: `README.md`, `PRODUCT.md`, `docs/PROJECT_CONTEXT.md`, `docs/PROJECT_STATUS.md`, `docs/API_CONTRACTS.md`,
  `docs/languages-and-voice.md`, `docs/IOS_TESTING.md`, `docs/judge-answers-20261010.md`, every file in
  `docs/handoffs/` and `docs/decisions/`, `backend/services/audio_service/README.md`, and the code cited above
  (`voice_agent/definition.py`, `voice_agent/limits.py`, `voice_agent/session.py`, `gemini_service.py`,
  `snowflake_service.py`, `mobile/src/native/push-to-talk.tsx`, `mobile/src/services/backend.ts`). The fact-check
  added the app screens in `mobile/src/screens/`, `mobile/src/components/agent-orb-control.tsx` and
  `mobile/src/domain/languages.ts`; see [FACT-CHECK.md](FACT-CHECK.md).
