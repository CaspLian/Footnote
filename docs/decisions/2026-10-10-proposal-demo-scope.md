# Reduce the demo scope to one reliable loop

- Status: proposed (not a team decision)
- Date: 2026-10-10        Proposed by: Nimesh (from the verification)

## Context

Update, later on 2026-10-10: a multi-screen prototype now exists on `frontend-aarush`, so point 2 becomes
connecting its bill-intake flow to these two routes first.

The whiteboard plans much more than exists: deadline tracking, credit dashboards, phone agents and Solana escrow
(`docs/PROJECT_CONTEXT.md`, "Feature status"). The mobile app is still a template, and price flags for doctor-only
rates are misleading.

## Proposal

1. **Demo one loop well:**
   - upload or photograph a bill
   - show the explanation, in English plus one other language
   - show the price comparison card
   - play the spoken reply in English
   - save it and replay it

   Leave Solana, deadlines, phone agents and credit-score claims out of the demo.
2. **Build one mobile screen first, before any navigation:**
   - camera or file picker → `POST /api/v1/analyze` → results
   - `POST /api/v1/voice/speak` with `audit.audit_id` → play `speech.audio_url`

   The speak step needs Tiger Data saving to work. Keep `backend/dev_console.py` as the fallback demo.
3. **Price flags:** until `2026-10-10-proposal-price-flags.md` is done, show the ratio with its caveat, and avoid
   "far above typical" labels for doctor-only rates.
4. **Offline backup:** keep `MOCK=true` and `PRICE_SOURCE=csv` in case the venue network fails. In that mode
   nothing is saved, so the "hear it" step needs a voice question instead.

## Alternatives and tradeoffs

- **Build more features:** a broader pitch, but a higher risk that nothing works end to end on stage.

## Impacted components

The mobile app, the demo script, and the pitch.
