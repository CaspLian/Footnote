# Gemini reads documents with "low" thinking, and the price table loads at startup

- Status: accepted (commits d1aa47a and 802f2a1)
- Date: 2026-10-11, America/New_York
- Requested by: Nimesh ("faster ... but still accurate across all photos and files")

## Decision

Gemini 3 models now think at the "low" level by default (`GEMINI_THINKING_LEVEL`; "default" restores the model's own
setting). This applies to both document reading and the spoken-reply translations. `GEMINI_MEDIA_RESOLUTION` can
raise image resolution for hard photos; it is unset by default.

The backend also reads the Snowflake benchmark table (about 7,700 rows) in the background at startup
(`PRICE_WARM_UP=false` turns this off). Before, the first lookup after a restart spent 10.8 s connecting and resuming
the warehouse.

## Evidence

Measured on `gemini-3.5-flash` with the production prompt, schema and parts, through `analyze()` directly. Scores
compare the output with ground truth:
- Northline documents: values in `mobile/assets/fixtures/README.md`.
- Demo documents: `demo/documents/ground-truth.json`, 16 bill lines and 12 financial fields.

| Documents | Default thinking | Low | Accuracy |
|---|---|---|---|
| Demo bill + EOB, 6 phone photos (about 2 MB each) | 80.8 s (past the 40 s attempt limit) | 16.1 s | Both settings: 16/16 lines, 12/12 fields, documents classified, duplicate flagged |
| Demo bill + EOB, 2 PDFs | 29.9 s | 19.2 s | Both settings: 16/16, 12/12 |
| Northline bill + EOB PDFs, 2 runs each | 15.2 s, 18.1 s | 5.4 s, 5.1 s | Both settings: 4/4 lines, 10/10 fields |
| Urgent-care receipt photo | 13.9 s | 4.4 s | Same lines and fields as the default |
| ER itemized bill PDF | 19.3 s | 11.4 s | Same 12 lines and amounts |
| Imaging bill PNG | 9.9 s | 4.1 s | Same |

Rejected:
- **Minimal thinking** misread one ER charge, $380 as $3,800.
- **Medium thinking** was as slow as the default.
- **Flash-Lite** was fastest (about 3 s) but recorded the receipt's "Insurance est. (pending) −$260" as an insurer
  payment.

Whole pipeline (Gemini, then Snowflake, then Tiger Data):
- First bill after a restart: 21.4 s before the warm-up, 7.7 s after it.
- Later bills: about 6 s.

## Limits

- These runs are a small sample: one or two runs per document, on synthetic documents. Accuracy on blurry or
  handwritten photos is not measured.
- Phone photos are uploaded at full camera resolution (about 2 MB each at quality 0.85), and the API accepts 15 MB in
  total. Six photos fit, but more may not; photograph two pages live at the demo.
