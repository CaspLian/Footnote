"""Rasterize every page of a PDF to PNG (default 300 dpi) with PDFium.

    <imaging-python> -I tools/rasterize.py out/eob.pdf out/png [dpi]

Writes out/png/<pdf-stem>-p<N>.png, RGB, with the resolution recorded in the PNG pHYs chunk.
"""
import sys
from pathlib import Path

import pypdfium2 as pdfium


def main() -> int:
    pdf_path, out_dir = Path(sys.argv[1]), Path(sys.argv[2])
    dpi = int(sys.argv[3]) if len(sys.argv) > 3 else 300
    out_dir.mkdir(parents=True, exist_ok=True)
    pdf = pdfium.PdfDocument(str(pdf_path))
    try:
        for i in range(len(pdf)):
            page = pdf[i]
            # 792 pt * 300/72 is 3300.0000000000005 in floating point, and PDFium rounds up; nudge the scale
            # down by a hair so a Letter page is exactly 2550 x 3300 at 300 dpi.
            bitmap = page.render(scale=dpi / 72 - 1e-9, draw_annots=False, may_draw_forms=False)
            img = bitmap.to_pil().convert("RGB")
            w, h = page.get_size()
            expect = (round(w * dpi / 72), round(h * dpi / 72))
            if img.size != expect:
                img = img.crop((0, 0, *expect)) if img.width >= expect[0] and img.height >= expect[1] else img.resize(expect)
            target = out_dir / f"{pdf_path.stem}-p{i + 1}.png"
            img.save(target, dpi=(dpi, dpi), optimize=True)
            print(f"    {target.name}  {img.width}x{img.height}")
            page.close()
    finally:
        pdf.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
