# Synthetic documents

These paired documents contain no real patient, provider, insurer, account or claim data. Both language variants carry the same values.

The statement lists $2,670 in charges, a $1,440 adjustment, $1,230 after bill adjustments, $686 insurer payment, a $50 patient payment and a $494 balance. The EOB lists $2,420 in charges, $980 allowed, $686 plan payment and $294 patient responsibility. It does not record payments made to the provider. The app derives $244 remaining from $294 minus the bill's recorded $50 payment.

The repeated laboratory line and the $250 balance difference are questions to clarify; they are never a verdict or promised refund. There is no insurer denial in this fixture.

Regenerate using `python3 mobile/scripts/generate-fixtures.py` with ReportLab and pypdf installed. The Codex bundled Python has these packages.

`qa/corrupt-header.pdf` contains a valid header and invalid page data. `qa/password-protected.pdf` has password `footnote-qa`. These recovery-only files are not included in the app's sample resolver and must not be presented as successfully processed documents.
