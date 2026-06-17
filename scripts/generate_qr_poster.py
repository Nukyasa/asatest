from pathlib import Path
import json
import os
import re
import sys

from reportlab.graphics import renderPDF
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "output" / "pdf"
LOG_PATH = ROOT / "cloudflare-tunnel.log"


def current_url():
    env_url = os.environ.get("PUBLIC_APP_URL", "").strip()
    if env_url:
        return env_url
    if LOG_PATH.exists():
        text = LOG_PATH.read_text(encoding="utf-8", errors="ignore")
        matches = re.findall(r"https://[a-z0-9-]+\.trycloudflare\.com", text)
        if matches:
            return matches[-1]
    return "http://localhost:5177"


def draw_centered(c, text, y, size, color, font="Times-Roman"):
    c.setFont(font, size)
    c.setFillColor(color)
    c.drawCentredString(A4[0] / 2, y, text)


def draw_qr(c, url, x, y, size):
    qr = QrCodeWidget(url)
    bounds = qr.getBounds()
    width = bounds[2] - bounds[0]
    height = bounds[3] - bounds[1]
    drawing = Drawing(size, size, transform=[size / width, 0, 0, size / height, 0, 0])
    drawing.add(qr)
    renderPDF.draw(drawing, c, x, y)


def generate():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    url = current_url()
    pdf_path = OUTPUT_DIR / "nurdin-adna-qr-poster.pdf"
    meta_path = OUTPUT_DIR / "nurdin-adna-qr-poster.json"

    c = canvas.Canvas(str(pdf_path), pagesize=A4)
    width, height = A4

    cream = colors.HexColor("#FFFDF9")
    ink = colors.HexColor("#211C18")
    muted = colors.HexColor("#766A61")
    accent = colors.HexColor("#5B342C")
    gold = colors.HexColor("#B99262")
    soft = colors.HexColor("#F5EEE8")

    c.setFillColor(cream)
    c.rect(0, 0, width, height, fill=True, stroke=False)
    c.setFillColor(soft)
    c.roundRect(18 * mm, 18 * mm, width - 36 * mm, height - 36 * mm, 8, fill=True, stroke=False)
    c.setStrokeColor(gold)
    c.setLineWidth(1.2)
    c.roundRect(24 * mm, 24 * mm, width - 48 * mm, height - 48 * mm, 6, fill=False, stroke=True)

    draw_centered(c, "Nurdin & Adna", height - 70 * mm, 44, ink, "Times-Roman")
    draw_centered(c, "25.07.2026", height - 84 * mm, 14, accent, "Helvetica-Bold")
    draw_centered(c, "Podijeli uspomenu sa nama", height - 106 * mm, 24, ink, "Times-Roman")
    draw_centered(c, "Skeniraj QR kod i dodaj sliku u svadbenu galeriju.", height - 118 * mm, 11, muted, "Helvetica")

    qr_size = 86 * mm
    qr_x = (width - qr_size) / 2
    qr_y = height / 2 - 58 * mm
    c.setFillColor(colors.white)
    c.roundRect(qr_x - 8 * mm, qr_y - 8 * mm, qr_size + 16 * mm, qr_size + 16 * mm, 8, fill=True, stroke=False)
    c.setStrokeColor(colors.Color(0.36, 0.2, 0.17, alpha=0.16))
    c.roundRect(qr_x - 8 * mm, qr_y - 8 * mm, qr_size + 16 * mm, qr_size + 16 * mm, 8, fill=False, stroke=True)
    draw_qr(c, url, qr_x, qr_y, qr_size)

    c.setFont("Helvetica", 9)
    c.setFillColor(muted)
    c.drawCentredString(width / 2, 46 * mm, url)
    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(accent)
    c.drawCentredString(width / 2, 34 * mm, "Galerija gostiju - slike, cestitke i najdrazi momenti")

    c.save()
    meta_path.write_text(json.dumps({"url": url, "pdf": str(pdf_path)}, indent=2), encoding="utf-8")
    print(pdf_path)


if __name__ == "__main__":
    generate()
