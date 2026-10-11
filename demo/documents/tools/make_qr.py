"""Regenerate src/assets/qr-pay.svg, the "scan to pay" QR code on page 1 of the itemized statement.

Needs segno (pip install segno) in the imaging environment, not in the repo:
    <imaging-python> demo/documents/tools/make_qr.py

The payload is a URL on the reserved .example domain, so scanning it never reaches a real site.
"""
import io
import re
import sys
from pathlib import Path

import segno

ROOT = Path(__file__).resolve().parents[1]
PAYLOAD = "https://linnetvalley.example/pay?acct=3041872296"


def main() -> int:
    qr = segno.make(PAYLOAD, error="m", micro=False)
    buf = io.BytesIO()
    # unit-less module grid; the stylesheet sizes it. Quiet zone of 2 modules (the box around it is white).
    qr.save(buf, kind="svg", scale=1, border=2, xmldecl=False, svgns=True, nl=False, omitsize=True,
            dark="#000", light="#fff", title=None, desc=None, svgclass="qr")
    svg = buf.getvalue().decode("utf-8")
    svg = re.sub(r"\s+", " ", svg).strip()
    out = ROOT / "src" / "assets" / "qr-pay.svg"
    out.write_text(svg + "\n", encoding="utf-8")
    print(f"wrote {out} ({len(svg)} bytes), version {qr.version}, payload {PAYLOAD}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
