#!/usr/bin/env python3
# Copyright 2026 Kevin Ringler
# SPDX-License-Identifier: Apache-2.0
"""
build_pdf.py: assemble patent drawing SVG sheets into one filing ready PDF.

Usage:
    python build_pdf.py fig-1.svg fig-2.svg fig-3.svg -o drawings.pdf
    python build_pdf.py sheets/*.svg -o drawings.pdf --preview previews/

What it does:
  * Confirms every sheet is the same size (US Letter or A4).
  * Adds sheet numbers "1/3", "2/3", ... centred at the top of the sight area
    (inside the drawing area, not in the margin, per 37 CFR 1.84(t)) when there
    is more than one sheet. Use --no-sheet-numbers to skip.
  * Renders each sheet as vector line art onto a page of the exact physical
    size (8.5 x 11 in, or 210 x 297 mm).
  * Embeds the font (Patent Center rejects PDFs with fonts that are not
    embedded) by mapping all text to one TrueType sans font found on the
    system (Arial, Liberation Sans or DejaVu Sans), or one you pass with --font.
  * Verifies the result: page count, page sizes and embedded fonts.
  * Optionally writes 150 dpi PNG previews for visual review.
  * Optionally adds a "Replacement Sheet", "New Sheet" or "Annotated Sheet"
    label (37 CFR 1.121(d)) and identifying indicia (37 CFR 1.84(c)) in the
    top margin, the only text allowed there.

Requires one rendering engine:
  * svglib + reportlab (pip install svglib reportlab), the default; or
  * cairosvg (pip install cairosvg; needs the Cairo library), used
    automatically when svglib or reportlab is missing. In this mode fonts come
    from the system through fontconfig (Arial, Liberation Sans, Helvetica or
    DejaVu Sans) and Cairo embeds them; --font is ignored.
Optional: pymupdf for verification and previews (pip install pymupdf). In
cairosvg mode without pymupdf, previews are rendered by cairosvg and the PDF
checks are skipped (the script says so).
"""
from __future__ import annotations

import argparse
import copy
import io
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

try:
    from svglib.svglib import svg2rlg
    from svglib.fonts import register_font
    from reportlab.pdfgen import canvas
    from reportlab.graphics import renderPDF, shapes
    from reportlab.lib.units import mm
    HAVE_SVGLIB = True
except ImportError:
    HAVE_SVGLIB = False

try:
    import cairosvg  # noqa: F401  (fallback engine)
    HAVE_CAIROSVG = True
except Exception:  # ImportError, or OSError when the Cairo library is missing
    HAVE_CAIROSVG = False

NO_ENGINE_MESSAGE = (
    "build_pdf.py needs a PDF engine and none is available.\n"
    "Install either:\n"
    "  pip install svglib reportlab      (recommended)\n"
    "  pip install cairosvg              (also needs the Cairo library)\n"
    "Optional for PDF checks and previews: pip install pymupdf\n"
    "check_drawing.py does not need any of these and still works.")

SVG_NS = "http://www.w3.org/2000/svg"
ET.register_namespace("", SVG_NS)
ET.register_namespace("xlink", "http://www.w3.org/1999/xlink")

SHEETS = {"letter": ((216.0, 279.0), (612.0, 792.0)), "a4": ((210.0, 297.0), (595.28, 841.89))}
MARGINS = {"top": 25.0, "left": 25.0, "right": 15.0, "bottom": 10.0}
FONT_NAME = "PatentSans"
# cairosvg mode: fontconfig picks the first installed family in this list.
CAIRO_FONT_FAMILY = "Arial, Liberation Sans, Helvetica, DejaVu Sans, sans-serif"
SHEET_NO_SIZE = 4.6  # mm font size; >= 3.2 mm character height


# --- Safety guard (shared logic in check_drawing.py and build_pdf.py) -------
# Patent drawing SVGs never need DTDs, entities, scripts, embedded or linked
# images, or references to other files. Refusing them up front blocks entity
# expansion attacks and SVGs that try to pull local files into the output.
_UNSAFE_PATTERNS = [
    (re.compile(rb"<!DOCTYPE", re.I), "a DOCTYPE declaration"),
    (re.compile(rb"<!ENTITY", re.I), "an ENTITY declaration"),
    (re.compile(rb"<(\w+:)?script\b", re.I), "a <script> element"),
    (re.compile(rb"<(\w+:)?(image|foreignObject)\b", re.I), "an embedded image or foreignObject"),
    (re.compile(rb"""(?:xlink:)?href\s*=\s*["'](?!#)""", re.I), "a link to another file or URL (href not starting with #)"),
    (re.compile(rb"@import|url\(\s*['\"]?(?!#)", re.I), "an external stylesheet or url() reference"),
]


def unsafe_reason(path) -> str | None:
    """Return why an SVG is unsafe to process, or None if it is acceptable."""
    data = Path(path).read_bytes()
    if len(data) > 20 * 1024 * 1024:
        return "it is larger than 20 MB"
    for rx, what in _UNSAFE_PATTERNS:
        if rx.search(data):
            return "it contains " + what
    return None

FONT_CANDIDATES = [
    r"C:\Windows\Fonts\arial.ttf",
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/Library/Fonts/Arial.ttf",
    "/usr/share/fonts/truetype/msttcorefonts/Arial.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
    "/usr/share/fonts/liberation/LiberationSans-Regular.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/dejavu/DejaVuSans.ttf",
]


def find_font(explicit: str | None) -> Path:
    if explicit:
        p = Path(explicit)
        if not p.is_file():
            sys.exit(f"Font file not found: {explicit}")
        return p
    for c in FONT_CANDIDATES:
        if Path(c).is_file():
            return Path(c)
    sys.exit("No TrueType sans font found. Pass one with --font path/to/font.ttf")


def sheet_size(root) -> str:
    vb = root.get("viewBox", "")
    nums = [float(x) for x in re.split(r"[\s,]+", vb.strip())] if vb else []
    if len(nums) != 4:
        raise ValueError("missing or invalid viewBox")
    for name, ((w, h), _) in SHEETS.items():
        if abs(nums[2] - w) < 0.6 and abs(nums[3] - h) < 0.6:
            return name
    raise ValueError(f"viewBox {nums[2]} x {nums[3]} is not US Letter (216 x 279) or A4 (210 x 297)")


LABELS = ("Replacement Sheet", "New Sheet", "Annotated Sheet")


def add_top_margin(root, w: float, label: str | None, indicia: str | None, family: str = FONT_NAME):
    """Place a 37 CFR 1.121(d) label and/or 1.84(c) identifying indicia in the
    top margin, inside a <g id="top-margin"> group the checker recognises."""
    if not label and not indicia:
        return
    group = None
    for g in root.iter(f"{{{SVG_NS}}}g"):
        if g.get("id") == "top-margin":
            group = g
    if group is None:
        group = ET.SubElement(root, f"{{{SVG_NS}}}g", {"id": "top-margin"})
    lines = [t for t in (label, indicia) if t]
    baselines = [10.0, 19.0] if len(lines) == 2 else [14.5]
    for text, y in zip(lines, baselines):
        if len(text) * 0.6 * SHEET_NO_SIZE > w - 10:
            raise ValueError(f"top margin text is too long to fit on one line: '{text[:40]}...'")
        t = ET.SubElement(group, f"{{{SVG_NS}}}text", {
            "x": f"{w / 2:.2f}", "y": f"{y:.2f}", "font-family": family,
            "font-size": f"{SHEET_NO_SIZE}", "text-anchor": "middle", "fill": "#000000",
            "stroke": "none",
        })
        t.text = text


def prepare(path: Path, number: str | None, label: str | None = None, indicia: str | None = None,
            family: str = FONT_NAME) -> tuple[bytes, str]:
    reason = unsafe_reason(path)
    if reason:
        raise ValueError(f"refused because {reason}; run check_drawing.py and fix the file first")
    tree = ET.parse(path)
    root = tree.getroot()
    size = sheet_size(root)
    (w, h), _ = SHEETS[size]
    # Drop template guides if left in by mistake, and force the embedded font.
    for parent in list(root.iter()):
        for child in list(parent):
            if child.get("id") == "margin-guides":
                parent.remove(child)
    for el in root.iter():
        tag = el.tag.split("}", 1)[-1]
        if tag in ("text", "tspan", "g", "svg"):
            if el.get("font-family") is not None or tag in ("text", "svg"):
                el.set("font-family", family)
            style = el.get("style")
            if style and "font-family" in style:
                el.set("style", re.sub(r"font-family\s*:[^;]+", lambda _m: f"font-family:{family}", style))
    add_top_margin(root, w, label, indicia, family)
    if number:
        cx = (MARGINS["left"] + (w - MARGINS["right"])) / 2
        t = ET.SubElement(root, f"{{{SVG_NS}}}text", {
            "x": f"{cx:.2f}", "y": f"{MARGINS['top'] + 5.5:.2f}",
            "font-family": family, "font-size": f"{SHEET_NO_SIZE}",
            "text-anchor": "middle", "fill": "#000000", "stroke": "none", "id": "sheet-number",
        })
        t.text = number
    buf = io.BytesIO()
    tree.write(buf, encoding="utf-8", xml_declaration=True)
    return buf.getvalue(), size


def verify(pdf_path: Path, size: str, count: int, preview_dir: Path | None,
           cairo_pages: list[bytes] | None = None) -> list[str]:
    try:
        import pymupdf as fitz
    except ImportError:
        try:
            import fitz  # type: ignore
        except ImportError:
            notes = ["(pymupdf not installed; skipped PDF verification of page count, page size "
                     "and embedded fonts. pip install pymupdf)"]
            if preview_dir and cairo_pages:
                import cairosvg
                preview_dir.mkdir(parents=True, exist_ok=True)
                for i, data in enumerate(cairo_pages, 1):
                    cairosvg.svg2png(bytestring=data, write_to=str(preview_dir / f"sheet-{i}.png"),
                                     dpi=150, background_color="white")
                notes.append(f"Wrote {len(cairo_pages)} preview(s) with cairosvg")
            elif preview_dir:
                notes.append("(previews need pymupdf; none written)")
            return notes
    notes = []
    doc = fitz.open(str(pdf_path))
    _, (pw, ph) = SHEETS[size]
    if doc.page_count != count:
        notes.append(f"FAIL page count {doc.page_count}, expected {count}")
    for i, page in enumerate(doc, 1):
        r = page.rect
        if abs(r.width - pw) > 0.5 or abs(r.height - ph) > 0.5:
            notes.append(f"FAIL page {i} is {r.width:.1f} x {r.height:.1f} pt, expected {pw} x {ph}")
        for f in page.get_fonts(full=True):
            ext, ftype, name = f[1], f[2], f[3]
            if ext in ("", "n/a") or not ext:
                notes.append(f"FAIL page {i}: font '{name}' ({ftype}) is not embedded")
        if preview_dir:
            preview_dir.mkdir(parents=True, exist_ok=True)
            page.get_pixmap(dpi=150, colorspace=fitz.csGRAY).save(str(preview_dir / f"sheet-{i}.png"))
    if not notes:
        notes.append(f"PASS {doc.page_count} page(s), all {size.upper()} size, all fonts embedded")
    doc.close()
    return notes


def render_cairo(pages: list[tuple[bytes, float, float, float, float]], out: Path) -> None:
    """Fallback engine: draw every prepared sheet onto one multi page PDF with
    cairosvg. Each page is (svg bytes, sheet width mm, sheet height mm, page
    width pt, page height pt); 1 mm in the viewBox becomes exactly 1 mm on paper
    and the sheet is top aligned, as in the svglib path."""
    import cairocffi
    from cairosvg.parser import Tree
    from cairosvg.surface import PDFSurface

    shared = None
    page_size = (0.0, 0.0)

    class _Page(PDFSurface):
        def _create_surface(self, width, height):
            shared.set_size(*page_size)
            return shared, width, height

    for data, w_mm, h_mm, pw, ph in pages:
        if shared is None:
            shared = cairocffi.PDFSurface(str(out), pw, ph)
        page_size = (pw, ph)
        # unsafe=False (the default) keeps cairosvg from resolving entities or
        # fetching external files; the input has also passed unsafe_reason().
        tree = Tree(bytestring=data, unsafe=False)
        page = _Page(tree, None, 72, output_width=w_mm * 72 / 25.4, output_height=h_mm * 72 / 25.4)
        page.context.show_page()
    shared.finish()


def main(argv=None):
    ap = argparse.ArgumentParser(description="Assemble patent drawing SVG sheets into one PDF.")
    ap.add_argument("files", nargs="+", help="SVG sheets in order")
    ap.add_argument("-o", "--output", required=True, help="output PDF path")
    ap.add_argument("--no-sheet-numbers", action="store_true", help="do not add 1/N sheet numbers")
    ap.add_argument("--font", help="TrueType font to embed (default: Arial, Liberation Sans or DejaVu Sans)")
    ap.add_argument("--preview", help="folder for 150 dpi PNG previews of each page")
    ap.add_argument("--sheet-start", type=int, default=1,
                    help="number of the first sheet given (for replacement sheets, e.g. 2)")
    ap.add_argument("--sheet-total", type=int,
                    help="total sheets in the whole set (default: number of files given)")
    ap.add_argument("--label", choices=LABELS,
                    help='37 CFR 1.121(d) label for the top margin of amended sheets, e.g. "Replacement Sheet"')
    ap.add_argument("--label-sheets", help="comma separated sheet numbers to label (default: every sheet)")
    ap.add_argument("--indicia", help="identifying text for the top margin of every sheet, e.g. "
                    '"Title of invention; Inventor name; Appl. No. 18/123,456" (37 CFR 1.84(c))')
    ap.add_argument("--engine", choices=("auto", "svglib", "cairosvg"), default="auto",
                    help="PDF engine (default auto: svglib + reportlab if installed, else cairosvg)")
    args = ap.parse_args(argv)

    engine = args.engine
    if engine == "auto":
        engine = "svglib" if HAVE_SVGLIB else "cairosvg" if HAVE_CAIROSVG else None
    if engine is None:
        sys.exit(NO_ENGINE_MESSAGE)
    if engine == "svglib" and not HAVE_SVGLIB:
        sys.exit("--engine svglib needs svglib and reportlab: pip install svglib reportlab")
    if engine == "cairosvg" and not HAVE_CAIROSVG:
        sys.exit("--engine cairosvg needs cairosvg and the Cairo library: pip install cairosvg")

    if engine == "svglib":
        font = find_font(args.font)
        rl_name, ok = register_font(FONT_NAME, str(font))
        if not ok or not rl_name:
            sys.exit(f"Could not register font {font}")
        # reportlab otherwise declares unembedded Helvetica and Times-Roman as
        # page defaults; point both defaults at the embedded font instead.
        shapes.STATE_DEFAULTS["fontName"] = rl_name
        family = FONT_NAME
    else:
        if args.font:
            print("Note: --font is ignored with the cairosvg engine; fonts come from the system.")
        family = CAIRO_FONT_FAMILY
    cairo_pages = []

    paths = [Path(f) for f in args.files]
    total = len(paths)
    sizes = set()
    out = Path(args.output)
    c = None
    label_on = None
    if args.label_sheets:
        try:
            label_on = {int(x) for x in args.label_sheets.split(",") if x.strip()}
        except ValueError:
            sys.exit("--label-sheets must be sheet numbers like 2,3")
        if not args.label:
            sys.exit("--label-sheets needs --label")
    set_total = args.sheet_total or (args.sheet_start - 1 + total)
    if args.sheet_start < 1 or set_total < args.sheet_start - 1 + total:
        sys.exit("--sheet-start/--sheet-total do not fit the number of files given")
    for i, p in enumerate(paths, 1):
        sheet_no = args.sheet_start - 1 + i
        number = None if (args.no_sheet_numbers or set_total == 1) else f"{sheet_no}/{set_total}"
        label = args.label if (args.label and (label_on is None or sheet_no in label_on)) else None
        try:
            data, size = prepare(p, number, label, args.indicia, family)
        except (ValueError, ET.ParseError) as e:
            sys.exit(f"{p.name}: {e}")
        sizes.add(size)
        if len(sizes) > 1:
            sys.exit("All sheets must be the same size; found " + ", ".join(sorted(sizes)))
        (w_mm, h_mm), (pw, ph) = SHEETS[size]
        if engine == "cairosvg":
            cairo_pages.append((data, w_mm, h_mm, pw, ph))
            continue
        drawing = svg2rlg(io.BytesIO(data))
        if drawing is None:
            sys.exit(f"{p.name}: could not be rendered")
        # svglib sizes the drawing from width/height; normalise to exact mm.
        sx = (w_mm * mm) / drawing.width
        sy = (h_mm * mm) / drawing.height
        drawing.scale(sx, sy)
        drawing.width, drawing.height = w_mm * mm, h_mm * mm
        if c is None:
            c = canvas.Canvas(str(out), pagesize=(pw, ph), initialFontName=rl_name)
            c.setTitle("Patent drawings")
            c.setCreator("patent-drawing skill build_pdf.py")
        c.setPageSize((pw, ph))
        # Top align so the top and left margins are exact.
        renderPDF.draw(drawing, c, 0, ph - h_mm * mm)
        c.showPage()
    if engine == "cairosvg":
        try:
            render_cairo(cairo_pages, out)
        except Exception as e:  # pragma: no cover
            sys.exit(f"cairosvg could not render the sheets: {e}")
        font_note = "engine cairosvg, system font"
    else:
        c.save()
        font_note = f"font {font.name}"
    print(f"Wrote {out} ({total} sheet{'s' if total != 1 else ''}, {sizes.pop().upper()}, {font_note})")
    notes = verify(out, size, total, Path(args.preview) if args.preview else None,
                   [d for d, *_ in cairo_pages] if engine == "cairosvg" else None)
    for note in notes:
        print("  " + note)
    return 1 if any(n.startswith("FAIL") for n in notes) else 0


if __name__ == "__main__":
    sys.exit(main())
