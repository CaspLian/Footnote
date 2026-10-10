# Fix misleading price flags: doctor-only rates, units, and the price source per line

- Status: proposed (not implemented; the prices owner decides)
- Date: 2026-10-10        Proposed by: Nimesh (from the verification, `BACKEND_VERIFICATION_REPORT.md` §5)

## Context

- **Doctor-only rates.** 4,043 of the 7,745 CSV rates are Medicare's facility rate, which pays only the doctor.
  They are judged with the same 3× and 6× bands as whole charges, so ordinary ER visits show "far above
  typical" (99284 at $1,200 is 10.1×). The voice reads these flags aloud.
- **Units.** A line with several units is compared with the price of one unit.
- **Source label.** On cached lookups, `price_summary.source` says `snowflake` even when the data came from the CSV.

## Proposal

1. **Doctor-only rates:** a separate flag (for example `doctor_fee_only`) for facility-setting rates. Keep these
   lines out of `items_flagged`, and say in the note that the rate does not cover the hospital's own charge.
2. **Units:** an optional `units` field on `LineItem`, with the bill divided by it.
3. **Source label:** cache the source with each row, and report it per line.

Until these land, the app should avoid "far above typical" wording for doctor-only rates.

## Alternatives and tradeoffs

- **Compare hospital lines with OPPS rates:** more accurate, but needs new data.
- **Compare EOB lines with the allowed amount:** needs new fields.
- **The cost:** new flag values and fields change the contract, so update `docs/API_CONTRACTS.md` and the mobile
  display together.

## Impacted components

`services/snowflake_services/snowflake_service.py`, `backend/models.py`, `voice_routes.py` (`spoken_reply`), and
the mobile app.
