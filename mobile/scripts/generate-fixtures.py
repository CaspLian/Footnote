#!/usr/bin/env python3
"""Generate explicitly synthetic paired documents for Unfold's offline demo.

Requires reportlab and pypdf. The Codex bundled Python runtime includes both.
Run from any directory: python3 mobile/scripts/generate-fixtures.py
"""
from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from pypdf import PdfReader, PdfWriter

OUTPUT = Path(__file__).resolve().parents[1] / "assets" / "fixtures"
INK = colors.HexColor("#182522")
MUTED = colors.HexColor("#56635F")
TEAL = colors.HexColor("#176B5B")
LINE = colors.HexColor("#DFE5DF")
SOFT = colors.HexColor("#EAF3EF")
FONT_DIRECTORY = Path(__file__).resolve().parents[1] / "node_modules" / "@expo-google-fonts" / "geist"
pdfmetrics.registerFont(TTFont("Unfold", str(FONT_DIRECTORY / "400Regular" / "Geist_400Regular.ttf")))
pdfmetrics.registerFont(TTFont("UnfoldBold", str(FONT_DIRECTORY / "700Bold" / "Geist_700Bold.ttf")))


def make_pdf(kind, language):
    spanish = language == "es"
    path = OUTPUT / f"northline-{kind}-{language}.pdf"
    doc = SimpleDocTemplate(str(path), pagesize=(612, 792), rightMargin=42, leftMargin=42, topMargin=38, bottomMargin=42, title=f"Unfold synthetic {kind}", author="Unfold prototype")
    styles = {
        "tag": ParagraphStyle("tag", fontName="UnfoldBold", fontSize=9, leading=13, textColor=TEAL, spaceAfter=12),
        "title": ParagraphStyle("title", fontName="UnfoldBold", fontSize=23, leading=29, textColor=INK, spaceAfter=8),
        "body": ParagraphStyle("body", fontName="Unfold", fontSize=10, leading=15, textColor=INK),
        "muted": ParagraphStyle("muted", fontName="Unfold", fontSize=9, leading=13, textColor=MUTED),
        "section": ParagraphStyle("section", fontName="UnfoldBold", fontSize=12, leading=18, textColor=INK, spaceBefore=16, spaceAfter=8),
        "amount": ParagraphStyle("amount", fontName="UnfoldBold", fontSize=24, leading=31, textColor=INK, alignment=TA_RIGHT),
        "cell": ParagraphStyle("cell", fontName="Unfold", fontSize=9, leading=13, textColor=INK),
    }
    p = lambda text, style="body": Paragraph(text, styles[style])
    rows = [p("UNFOLD / EJEMPLO FICTICIO" if spanish else "UNFOLD / SYNTHETIC SAMPLE", "tag")]
    rows.append(p("Northline Medical Center", "title"))
    rows.append(p(("Factura médica detallada" if spanish else "Itemized medical statement") if kind == "bill" else ("Explicación de beneficios (EOB)" if spanish else "Explanation of benefits (EOB)")))
    rows.append(Spacer(1, 12))
    info = [
        [p("Paciente ficticio: Alex Morgan" if spanish else "Fictional patient: Alex Morgan", "muted"), p("Cuenta: DEMO-104" if spanish else "Account: DEMO-104", "muted")],
        [p("Fecha del servicio: 18 sep 2026" if spanish else "Service date: Sep 18, 2026", "muted"), p("Emisión: 01 oct 2026" if spanish else "Statement date: Oct 1, 2026", "muted")],
    ]
    table = Table(info, colWidths=[300, 228]); table.setStyle(TableStyle([("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 5)])); rows.append(table)
    if kind == "eob":
        rows.append(Spacer(1, 10)); rows.append(p("ESTO NO ES UNA FACTURA. Plan ficticio: Harbor Health Demo." if spanish else "THIS IS NOT A BILL. Fictional plan: Harbor Health Demo.", "tag"))
    rows.append(p("Servicios" if spanish else "Service detail", "section"))
    descriptions = ["Visita a urgencias", "Tomografía", "Panel metabólico"] if spanish else ["Emergency visit", "CT scan", "Metabolic panel"]
    data = [["Código" if spanish else "Code", "Servicio" if spanish else "Service", "Unidades" if spanish else "Units", "Facturado" if spanish else "Billed"]]
    for code, desc, amount in zip(["99284", "74176", "80053"], descriptions, ["$1,670.00", "$500.00", "$250.00"]):
        data.append([code, p(desc, "cell"), "1", amount])
    if kind == "bill": data.append(["80053", p(descriptions[-1], "cell"), "1", "$250.00"])
    table = Table(data, colWidths=[70, 258, 80, 120], repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), SOFT), ("TEXTCOLOR", (0, 0), (-1, -1), INK),
        ("FONTNAME", (0, 0), (-1, 0), "UnfoldBold"), ("FONTNAME", (0, 1), (-1, -1), "Unfold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9), ("ALIGN", (2, 0), (-1, -1), "RIGHT"),
        ("TOPPADDING", (0, 0), (-1, -1), 11), ("BOTTOMPADDING", (0, 0), (-1, -1), 11),
        ("LINEBELOW", (0, 0), (-1, -1), 0.5, LINE), ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ])); rows.append(table)
    rows.append(p("Resumen de la cuenta" if spanish else "Account summary", "section"))
    if kind == "bill":
        summary = [
            ("Cargos facturados" if spanish else "Billed charges", "$2,670.00"),
            ("Ajustes del contrato" if spanish else "Contract adjustment", "-$1,440.00"),
            ("Después de los ajustes" if spanish else "After bill adjustments", "$1,230.00"),
            ("Pago de la aseguradora" if spanish else "Insurer payment", "-$686.00"),
            ("Pago del paciente recibido" if spanish else "Patient payment received", "-$50.00"),
        ]
        total_label = "Saldo del estado de cuenta" if spanish else "Statement balance"
        total = "$494.00"
    else:
        summary = [
            ("Cargos facturados" if spanish else "Billed charges", "$2,420.00"),
            ("Ajuste del contrato" if spanish else "Contract adjustment", "-$1,440.00"),
            ("Importe permitido" if spanish else "Allowed amount", "$980.00"),
            ("Pago del plan" if spanish else "Plan paid", "$686.00"),
            ("Deducible / copago" if spanish else "Deductible / copayment", "$0.00 / $0.00"),
            ("Coseguro (30%)" if spanish else "Coinsurance (30%)", "$294.00"),
        ]
        total_label = "Responsabilidad del paciente" if spanish else "Patient responsibility"
        total = "$294.00"
    table = Table([[p(label, "cell"), value] for label, value in summary], colWidths=[380, 148])
    table.setStyle(TableStyle([("FONTNAME", (0, 0), (-1, -1), "Unfold"), ("FONTSIZE", (0, 0), (-1, -1), 10), ("TEXTCOLOR", (0, 0), (-1, -1), INK), ("ALIGN", (1, 0), (1, -1), "RIGHT"), ("LEFTPADDING", (0, 0), (0, -1), 0), ("RIGHTPADDING", (1, 0), (1, -1), 0), ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4)])); rows.append(table)
    rows.append(Spacer(1, 10))
    total_table = Table([[p(total_label, "section"), p(total, "amount")]], colWidths=[350, 178])
    total_table.setStyle(TableStyle([("LINEABOVE", (0, 0), (-1, -1), 1, TEAL), ("TOPPADDING", (0, 0), (-1, -1), 13), ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0), ("VALIGN", (0, 0), (-1, -1), "MIDDLE")])); rows.append(total_table)
    rows.append(Spacer(1, 20))
    footer_text = ("Documento completamente ficticio para el prototipo Unfold. No representa a un paciente, proveedor ni aseguradora real. Las diferencias sirven para practicar preguntas de aclaración; no establecen un cargo incorrecto ni un reembolso." if spanish else "Entirely fictional document for the Unfold prototype. It does not represent a real patient, provider or insurer. Differences support clarification questions; they do not establish an incorrect charge or refund.")
    rows.append(p(footer_text, "muted"))
    if kind == "eob": rows.append(Spacer(1, 8)); rows.append(p("La EOB no registra pagos realizados al proveedor. Compara esta responsabilidad con los pagos de tu factura." if spanish else "This EOB does not track payments made to the provider. Compare this responsibility with the payments recorded on your bill.", "muted"))

    def footer(canvas, _doc):
        canvas.setFont("Unfold", 8); canvas.setFillColor(MUTED)
        canvas.drawString(42, 24, "Unfold - Synthetic demo / Ejemplo ficticio")
        canvas.drawRightString(570, 24, "1 / 1")
    doc.build(rows, onFirstPage=footer, onLaterPages=footer)
    if len(PdfReader(path).pages) != 1: raise RuntimeError(f"Fixture must remain one page: {path}")
    return path


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    files = [make_pdf(kind, lang) for lang in ["en", "es"] for kind in ["bill", "eob"]]
    # Recovery fixtures are excluded from the app's bundled sample flow.
    qa = OUTPUT / "qa"; qa.mkdir(exist_ok=True)
    (qa / "corrupt-header.pdf").write_bytes(b"%PDF-1.7\nThis file has a PDF header but no valid page objects.\n")
    writer = PdfWriter(); writer.append(str(files[0])); writer.encrypt("unfold-qa")
    with (qa / "password-protected.pdf").open("wb") as output: writer.write(output)
    for path in files: print(f"Generated {path.name}: 1 page")


if __name__ == "__main__": main()
