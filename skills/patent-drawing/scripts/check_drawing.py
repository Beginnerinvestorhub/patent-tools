#!/usr/bin/env python3
# Copyright 2026 Kevin Ringler
# SPDX-License-Identifier: Apache-2.0
"""
check_drawing.py: automated 37 CFR 1.84 checks for patent drawing SVG sheets.

Usage:
    python check_drawing.py fig-1.svg fig-2.svg ...
    python check_drawing.py --json sheets/*.svg

What it checks (per sheet, and across the set):
  * Sheet size is exactly US Letter (216 x 279 mm) or A4 (210 x 297 mm),
    using a viewBox in millimetres, and the same size on every sheet.
  * All drawn content sits inside the sight area (margins: top 25, left 25,
    right 15, bottom 10 mm). Nothing in the margins.
  * The top 8 mm of the sight area is kept clear for the sheet number that
    build_pdf.py adds (only when the set has more than one sheet).
  * Only black lines and black or white fills. No colour, grey, opacity,
    gradients, filters, embedded images or foreignObject.
  * Margin guide group from the blank templates has been removed.
  * Every text element renders with font size >= 4.6 mm, so capital letters
    and digits are at least 3.2 mm tall (0.32 cm, 37 CFR 1.84(p)(3)).
  * Each sheet has at least one "FIG. N" label in the correct form and no
    "Fig." / "Figure" variants. FIG numbers are sequential across the set.
  * No text touches or crosses a line: catches labels overflowing their
    boxes and lead lines drawn through text (37 CFR 1.84(p)(3)). Widths use
    Helvetica metrics (Arial compatible): from reportlab when installed,
    otherwise from a built in table of the same widths for ASCII text.
  * Text that looks like an excessive paragraph (over 40 characters) is
    flagged as a warning (37 CFR 1.84(o)).
  * A reference numeral inventory is printed so numerals can be cross
    checked against the specification.
  * Text in <g id="top-margin"> is the only content allowed in a margin:
    identifying indicia (37 CFR 1.84(c)) and Replacement / New / Annotated
    Sheet labels (37 CFR 1.121(d)). It must be plain black text inside the
    top 25 mm.
  * Sheets turned sideways must declare data-orientation="landscape" on the
    <svg> element, and then every text must read bottom to top (rotate(-90)),
    i.e. left to right with the sheet turned so its top is on the right
    (37 CFR 1.84(i)). Rotated text on an upright sheet fails.

Exit code 0 when every sheet passes, 1 when any check fails.

Requires: svgelements (pip install svgelements). If it is not installed, the
bundled copy in scripts/vendor/ is used, so the checker runs on the Python
standard library alone. reportlab is optional: when present, text widths use
its Helvetica metrics; otherwise a conservative per character estimate is used.
"""
from __future__ import annotations

import argparse
import io
import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path


def parse_length_to_mm(length_str: str | None, default_unit: str = "px") -> float | None:
    """Convert SVG/CSS length string to physical millimeters.
    Handles units: mm, cm, in, pt, pc, px (default), and unitless (treated as default_unit).
    """
    if not length_str:
        return None
    m = re.match(r"^([\d.]+)\s*([a-zA-Z%]*)$", str(length_str).strip())
    if not m:
        return None
    val = float(m.group(1))
    unit = (m.group(2).lower() or default_unit)
    if unit == "mm":
        return val
    if unit == "cm":
        return val * 10.0
    if unit == "in":
        return val * 25.4
    if unit == "pt":
        return val * (25.4 / 72.0)
    if unit == "pc":
        return val * (25.4 / 6.0)
    if unit == "px":
        return val * (25.4 / 96.0)
    return None  # %, unknown units: not a physical length


def physical_sheet_mm(svg_root: ET.Element, viewbox_w: float, viewbox_h: float) -> tuple[float, float]:
    """Physical sheet size in mm, from the root width/height attributes.

    The attributes may carry mm, cm, in, pt, pc or px units, or be unitless
    (px per the SVG spec). When missing or non-physical (e.g. '%'), the
    viewBox units are treated as px at 96 dpi.
    """
    px_mm = 25.4 / 96.0
    pw = parse_length_to_mm(svg_root.get("width"))
    ph = parse_length_to_mm(svg_root.get("height"))
    return (pw if pw else viewbox_w * px_mm,
            ph if ph else viewbox_h * px_mm)

try:
    from svgelements import SVG, Shape, Text, Group, Image as SvgImage
except ImportError:
    # Restricted environments (for example a code sandbox where pip install is
    # not possible) use the unmodified copy of svgelements 1.9.6 (MIT license)
    # shipped in scripts/vendor/. An installed svgelements always wins.
    _VENDOR = Path(__file__).resolve().parent / "vendor"
    sys.path.insert(0, str(_VENDOR))
    try:
        from svgelements import SVG, Shape, Text, Group, Image as SvgImage
    except ImportError:  # pragma: no cover
        sys.exit("check_drawing.py needs svgelements: pip install svgelements "
                 "(the bundled copy in scripts/vendor/ could not be loaded either)")
    finally:
        sys.path.remove(str(_VENDOR))

SHEETS = {"letter": (216.0, 279.0), "a4": (210.0, 297.0)}
MARGINS = {"top": 25.0, "left": 25.0, "right": 15.0, "bottom": 10.0}
SHEET_NUMBER_BAND = 8.0  # mm at top of sight area reserved for "1/3"
MIN_FONT_MM = 4.6        # font-size that yields >= 3.2 mm cap/digit height
CAP_HEIGHT_RATIO = 0.70  # conservative cap height / font size for sans fonts
TOL = 0.05               # mm tolerance
FORBIDDEN_TAGS = {"image", "linearGradient", "radialGradient", "filter",
                  "foreignObject", "mask", "pattern"}
FIG_RE = re.compile(r"^FIG\.\s(\d+)([A-Z]?)$")
BAD_FIG_RE = re.compile(r"^(fig\.?|figure)\s*\d+", re.I)
NUMERAL_RE = re.compile(r"^\d{1,4}[a-z]?$")
OK_COLORS = {"#000000": "black", "#ffffff": "white"}


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


def local(tag: str) -> str:
    return tag.split("}", 1)[-1]


def parse_style(style: str) -> dict:
    out = {}
    for part in (style or "").split(";"):
        if ":" in part:
            k, v = part.split(":", 1)
            out[k.strip()] = v.strip()
    return out


def color_hex(c) -> str | None:
    """svgelements Color -> '#rrggbb' or None for none/transparent."""
    if c is None or c.value is None:
        return None
    try:
        if c.alpha == 0:
            return None
    except Exception:
        pass
    return c.hexrgb.lower()


class SheetReport:
    def __init__(self, path: Path):
        self.path = path
        self.fails: list[str] = []
        self.warns: list[str] = []
        self.sheet: str | None = None
        self.figs: list[str] = []
        self.numerals: list[str] = []
        self.min_font: float | None = None
        self.indicia: list[str] = []
        self.orientation: str = "portrait"

    @property
    def ok(self) -> bool:
        return not self.fails

    def as_dict(self):
        return {
            "file": str(self.path),
            "sheet": self.sheet,
            "pass": self.ok,
            "failures": self.fails,
            "warnings": self.warns,
            "figures": self.figs,
            "numerals": self.numerals,
            "smallest_font_mm": self.min_font,
            "orientation": self.orientation,
            "top_margin_text": self.indicia,
        }


def check_raw_xml(path: Path, rep: SheetReport) -> tuple[float, float] | None:
    reason = unsafe_reason(path)
    if reason:
        rep.fails.append(f"Refused to process this file because {reason}. Patent drawing SVGs must be plain vector line art with no external references.")
        return None
    try:
        tree = ET.parse(path)
    except ET.ParseError as e:
        rep.fails.append(f"Not valid XML/SVG: {e}")
        return None
    root = tree.getroot()

    vb = root.get("viewBox")
    if not vb:
        rep.fails.append("No viewBox. Start from a blank template (viewBox in millimetres).")
        return None
    nums = [float(x) for x in re.split(r"[\s,]+", vb.strip())]
    if len(nums) != 4 or nums[0] != 0 or nums[1] != 0:
        rep.fails.append(f"viewBox must start at 0 0, got '{vb}'.")
        return None
    w, h = nums[2], nums[3]
    for name, (sw, sh) in SHEETS.items():
        if abs(w - sw) < 0.6 and abs(h - sh) < 0.6:
            rep.sheet = name
    if rep.sheet is None:
        rep.fails.append(
            f"Sheet {w} x {h} is not US Letter (216 x 279 mm) or A4 (210 x 297 mm). "
            "Landscape layouts must still use a portrait sheet with the drawing rotated.")
    for attr, expected in (("width", w), ("height", h)):
        val = root.get(attr, "")
        m = re.match(r"^([\d.]+)(mm|cm|in)$", val)
        if not m:
            rep.fails.append(f"Root {attr} should be a physical size like '{expected/10:.1f}cm', got '{val or 'missing'}'.")
            continue
        mm = float(m.group(1)) * {"mm": 1, "cm": 10, "in": 25.4}[m.group(2)]
        if abs(mm - expected) > 0.6:
            rep.fails.append(f"Root {attr} {val} does not match the viewBox ({expected} mm).")

    for el in root.iter():
        tag = local(el.tag)
        if tag in FORBIDDEN_TAGS:
            rep.fails.append(f"<{tag}> is not allowed (no images, gradients, filters, masks or patterns).")
        if el.get("id") == "margin-guides":
            rep.fails.append("Template margin guides are still present. Delete the 'margin-guides' group.")
        style = parse_style(el.get("style", ""))
        for key in ("opacity", "fill-opacity", "stroke-opacity"):
            val = el.get(key, style.get(key))
            if val is not None:
                try:
                    if float(val) < 1:
                        rep.fails.append(f"{key}={val} on <{tag}> creates grey tones. Use solid black only.")
                except ValueError:
                    pass
        for key in ("stroke-dasharray",):
            pass
    return w, h


try:  # Helvetica metrics match Arial closely; fall back to an estimate.
    from reportlab.pdfbase.pdfmetrics import stringWidth as _string_width
except Exception:  # pragma: no cover
    _string_width = None

# Fallback when reportlab is absent: standard Helvetica advance widths (Adobe
# Core 14 font metrics, units of 1/1000 em) for printable ASCII 32 to 126, so
# ASCII labels measure the same with or without reportlab. Any other character
# is estimated at 0.667 em (an average capital), which errs on the wide side.
_HELVETICA_ASCII = (
    278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
    556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
    1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
    667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
    333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
    556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
)
FALLBACK_EM = 0.667


def text_width(s: str, fs: float) -> float:
    if _string_width is not None:
        return _string_width(s, "Helvetica", fs)
    units = sum(_HELVETICA_ASCII[ord(ch) - 32] if 32 <= ord(ch) <= 126 else FALLBACK_EM * 1000
                for ch in s)
    return units / 1000.0 * fs


def text_extent(t: Text, scale: float):
    """Approximate bbox (mm) for a text element at any rotation.
    svgelements has no font metrics, so width comes from text_width()."""
    try:
        m = t.transform
        a, b, c, d, e, f = m.a, m.b, m.c, m.d, m.e, m.f
    except Exception:
        a, b, c, d, e, f = 1, 0, 0, 1, 0, 0
    det = abs(a * d - b * c) ** 0.5 or 1.0
    fs = (t.font_size or 0) / scale * det
    s = (t.text or "").strip()
    width = text_width(s, fs)
    px, py = (a * t.x + c * t.y + e) / scale, (b * t.x + d * t.y + f) / scale
    # Unit vectors for the baseline direction and for "up" (towards the top of glyphs).
    ux, uy = a / det, b / det
    vx, vy = -c / det, -d / det
    anchor = (getattr(t, "anchor", None) or "start").lower()
    shift = {"middle": -width / 2, "end": -width}.get(anchor, 0.0)
    sx, sy = px + ux * shift, py + uy * shift
    corners = []
    for along in (0.0, width):
        for up in (fs * CAP_HEIGHT_RATIO, -fs * 0.22):
            corners.append((sx + ux * along + vx * up, sy + uy * along + vy * up))
    xs, ys = [p[0] for p in corners], [p[1] for p in corners]
    return fs, (min(xs), min(ys), max(xs), max(ys))


def orientation(t) -> str:
    """'upright', 'sideways' (reads bottom to top: sheet turned so its top is on
    the right, 37 CFR 1.84(i)), or 'other'."""
    try:
        m = t.transform
        a, b, c, d = m.a, m.b, m.c, m.d
    except Exception:
        return "upright"
    n = (a * a + b * b) ** 0.5 or 1.0
    a, b = a / n, b / n
    if a > 0.99 and abs(b) < 0.02:
        return "upright"
    if abs(a) < 0.02 and b < -0.99:
        return "sideways"
    return "other"


def split_top_margin(path: Path, rep: SheetReport, w: float):
    """Validate and remove <g id="top-margin"> (identifying indicia and
    Replacement / New / Annotated Sheet labels, 37 CFR 1.84(c), 1.121(d)).
    Returns the remaining SVG as bytes for geometric checks."""
    tree = ET.parse(path)
    root = tree.getroot()
    for parent in list(root.iter()):
        for child in list(parent):
            if child.get("id") != "top-margin":
                continue
            group_fs = child.get("font-size")
            for el in child.iter():
                tag = local(el.tag)
                if el is child:
                    continue
                if tag not in ("text", "tspan"):
                    rep.fails.append(f"Only text is allowed in the top-margin group, found <{tag}>.")
                    continue
                if tag == "tspan":
                    continue
                if el.get("transform"):
                    rep.fails.append("Top margin text must not be rotated or transformed.")
                style = parse_style(el.get("style", ""))
                fill = (el.get("fill") or style.get("fill") or "#000000").lower()
                if fill not in ("#000000", "#000", "black"):
                    rep.fails.append(f"Top margin text must be black, found fill {fill}.")
                try:
                    fs_str = str(el.get("font-size") or style.get("font-size") or group_fs or "0")
                    fs_mm = parse_length_to_mm(fs_str, default_unit="mm")
                    if fs_mm is None:
                        raise ValueError("invalid font-size")
                    fs = fs_mm
                    x, y = float(el.get("x", "0")), float(el.get("y", "0"))
                except ValueError:
                    rep.fails.append("Top margin text needs numeric x, y and font-size in mm.")
                    continue
                txt = "".join(el.itertext()).strip()
                width = text_width(txt, fs)
                anchor = el.get("text-anchor") or style.get("text-anchor") or "start"
                x0 = x - width / 2 if anchor == "middle" else x - width if anchor == "end" else x
                y0, y1 = y - fs * CAP_HEIGHT_RATIO, y + fs * 0.22
                if fs + TOL < MIN_FONT_MM:
                    rep.fails.append(f"Top margin text '{txt[:30]}' font size {fs} mm is too small; use >= {MIN_FONT_MM} mm.")
                if y0 < -TOL or y1 > MARGINS["top"] + TOL or x0 < -TOL or x0 + width > w + TOL:
                    rep.fails.append(f"Top margin text '{txt[:30]}' must sit entirely inside the top margin (y 0 to {MARGINS['top']:.0f} mm).")
                rep.indicia.append(txt)
            parent.remove(child)
    buf = io.BytesIO()
    tree.write(buf, encoding="utf-8", xml_declaration=True)
    buf.seek(0)
    return buf, root.get("data-orientation", "portrait").lower()


def check_sheet(path: Path, multi_sheet: bool) -> SheetReport:
    rep = SheetReport(path)
    size = check_raw_xml(path, rep)
    if size is None:
        return rep
    w, h = size
    root_pre = ET.parse(path).getroot()
    phys_w_mm, phys_h_mm = physical_sheet_mm(root_pre, w, h)
    sight = (MARGINS["left"], MARGINS["top"], phys_w_mm - MARGINS["right"], phys_h_mm - MARGINS["bottom"])

    body, sheet_orientation = split_top_margin(path, rep, phys_w_mm)
    if sheet_orientation not in ("portrait", "landscape"):
        rep.fails.append(f"data-orientation must be 'portrait' or 'landscape', got '{sheet_orientation}'.")
    rep.orientation = sheet_orientation
    svg = SVG.parse(body)
    # px per physical mm: element geometry from svgelements is in viewport px,
    # so geometry_mm = px / scale. For mm viewBox sheets this is svg.width/216
    # (~3.78, the original convention); for px sheets (unitless width = px per
    # the SVG spec) 816px / 215.9mm lands at the same 3.78 px/mm.
    scale = (svg.width or w) / phys_w_mm

    bad_colors = set()
    outside = []
    in_band = []
    fonts = []
    rotated_text = 0
    wrong_way = []
    text_boxes = []   # (label, box)
    line_points = []  # sampled points along every stroked shape, in mm

    # Unstroked shapes with an opaque fill paint over anything drawn earlier:
    # a white label patch visually interrupts the connector behind it, so line
    # samples it covers are not visible ink and cannot "mingle" with text.
    covers = []       # (z index, bbox mm) of fill-only shapes
    for zi, el in enumerate(svg.elements()):
        if not isinstance(el, Shape):
            continue
        if color_hex(getattr(el, "stroke", None)) is not None:
            continue
        fill_c = color_hex(getattr(el, "fill", None))
        if fill_c is None:
            continue
        try:
            cbb = el.bbox(with_stroke=False)
        except Exception:
            cbb = None
        if cbb is None:
            continue
        if cbb[0] <= 2 and cbb[1] <= 2 and cbb[2] >= w - 2 and cbb[3] >= h - 2:
            continue  # page backdrop covers nothing of interest
        covers.append((zi, tuple(v / scale for v in cbb)))

    for zi, el in enumerate(svg.elements()):
        if isinstance(el, SvgImage):
            rep.fails.append("Embedded raster image found. Patent drawings must be vector line art.")
            continue
        if isinstance(el, Text):
            s = (el.text or "").strip()
            if not s:
                continue
            fs, box = text_extent(el, scale)
            fonts.append(fs)
            fill = color_hex(el.fill)
            if fill not in (None, "#000000"):
                bad_colors.add(f"text fill {fill}")
            orient = orientation(el)
            if sheet_orientation == "landscape":
                if orient != "sideways":
                    wrong_way.append(s[:20])
            elif orient != "upright":
                rotated_text += 1
            if fs + TOL < MIN_FONT_MM:
                rep.fails.append(
                    f"Text '{s[:30]}' font size {fs:.2f} mm is too small; use >= {MIN_FONT_MM} mm "
                    f"so characters are >= 3.2 mm tall.")
            if FIG_RE.match(s):
                rep.figs.append(s)
            elif BAD_FIG_RE.match(s):
                rep.fails.append(f"Figure label '{s}' must be written exactly as 'FIG. N' (capital FIG, period, space).")
            elif NUMERAL_RE.match(s):
                rep.numerals.append(s)
            elif len(s) > 40:
                rep.warns.append(f"Long text ({len(s)} chars) may count as excessive text: '{s[:40]}...'")
            boxes = [("text '" + s[:20] + "'", box)]
            text_boxes.append((s[:24], box))
        elif isinstance(el, Shape):
            # A full-sheet white backdrop rect is page background, not drawing
            # content — it legitimately spans the margins.
            try:
                bb0 = el.bbox(with_stroke=False)
            except Exception:
                bb0 = None
            if (bb0 is not None
                    and bb0[0] <= 2 and bb0[1] <= 2
                    and bb0[2] >= w - 2 and bb0[3] >= h - 2
                    and color_hex(getattr(el, "stroke", None)) is None
                    and color_hex(getattr(el, "fill", None)) in (None, "#ffffff")):
                continue
            for attr in ("stroke", "fill"):
                c = color_hex(getattr(el, attr, None))
                if c is not None and c not in OK_COLORS:
                    bad_colors.add(f"{attr} {c}")
            sw = getattr(el, "stroke_width", None)
            try:
                bb = el.bbox(with_stroke=True)
            except Exception:
                bb = None
            if bb is None:
                continue
            boxes = [(type(el).__name__.lower(), tuple(v / scale for v in bb))]
            stroke_c = color_hex(getattr(el, "stroke", None))
            fill_c = color_hex(getattr(el, "fill", None))
            # Only visible ink counts: a stroked outline, or a non-white fill
            # region (approximated by its outline). A fill-only white shape has
            # no visible edge and instead masks whatever it paints over.
            if stroke_c is not None or (fill_c is not None and fill_c != "#ffffff"):
                try:
                    from svgelements import Path as _P
                    path = _P(el)
                    length = path.length(error=1e-3) / scale
                    n = max(int(length / 0.4), 2)
                    for k in range(n + 1):
                        pt = path.point(k / n)
                        mx, my = pt.x / scale, pt.y / scale
                        if stroke_c is not None and any(
                                ci > zi and cx0 <= mx <= cx1 and cy0 <= my <= cy1
                                for ci, (cx0, cy0, cx1, cy1) in covers):
                            continue  # hidden under a later opaque patch
                        line_points.append((mx, my))
                except Exception:
                    pass
            if sw is not None and color_hex(el.stroke) is not None:
                swmm = sw / scale
                try:
                    m = el.transform
                    swmm *= abs(m.a * m.d - m.b * m.c) ** 0.5
                except Exception:
                    pass
                if swmm < 0.2:
                    rep.warns.append(f"Very thin stroke ({swmm:.2f} mm) may disappear when reproduced; use 0.3 to 0.5 mm.")
        else:
            continue

        for label, (x0, y0, x1, y1) in boxes:
            if x0 < sight[0] - TOL or y0 < sight[1] - TOL or x1 > sight[2] + TOL or y1 > sight[3] + TOL:
                outside.append(f"{label} at ({x0:.1f},{y0:.1f})-({x1:.1f},{y1:.1f})")
            elif multi_sheet and not rep.indicia and y0 < sight[1] + SHEET_NUMBER_BAND - TOL:
                in_band.append(label)

    # Characters must not cross or mingle with lines (37 CFR 1.84(p)(3)).
    clashes = []
    for label, (x0, y0, x1, y1) in text_boxes:
        ix0, iy0, ix1, iy1 = x0 + 0.35, y0 + 0.35, x1 - 0.35, y1 - 0.35
        if ix1 <= ix0 or iy1 <= iy0:
            continue
        if any(ix0 < px < ix1 and iy0 < py < iy1 for px, py in line_points):
            clashes.append(label)
    if clashes:
        rep.fails.append(
            f"{len(clashes)} text item(s) touch or cross a line (text overflowing its box, or a line "
            "running through it): " + ", ".join(repr(c) for c in clashes)
            + ". Characters must not cross or mingle with lines (37 CFR 1.84(p)(3)).")
    if bad_colors:
        rep.fails.append("Non black colour or grey found: " + ", ".join(sorted(bad_colors)) + ".")
    if outside:
        rep.fails.append(
            f"{len(outside)} item(s) cross into the margins (sight area x {sight[0]} to {sight[2]}, "
            f"y {sight[1]} to {sight[3]} mm): " + "; ".join(outside[:5]) + (" ..." if len(outside) > 5 else ""))
    if in_band:
        rep.fails.append(
            f"{len(in_band)} item(s) sit in the top {SHEET_NUMBER_BAND:.0f} mm of the sight area, which is "
            "reserved for the sheet number: " + ", ".join(in_band[:5]))
    if wrong_way:
        rep.fails.append(
            f"Sheet is marked landscape but {len(wrong_way)} text item(s) are not turned with it: "
            + ", ".join(repr(x) for x in wrong_way[:5])
            + ". On a sideways sheet every text must read bottom to top (rotate(-90)), so it reads "
            "left to right when the sheet is turned with its top on the right (37 CFR 1.84(i)).")
    if rotated_text:
        rep.fails.append(
            f"{rotated_text} rotated text element(s) on an upright sheet. Text must read left to right "
            "with the sheet upright. If the whole figure is turned sideways, add "
            'data-orientation="landscape" to the <svg> element and turn every text with it (37 CFR 1.84(i)).')
    if not rep.figs:
        rep.fails.append("No 'FIG. N' label found on this sheet.")
    if fonts:
        rep.min_font = round(min(fonts), 2)
    # De-duplicate repeated messages
    rep.fails = list(dict.fromkeys(rep.fails))
    rep.warns = list(dict.fromkeys(rep.warns))
    return rep


def check_set(reports: list[SheetReport], partial: bool = False) -> list[str]:
    issues = []
    sizes = {r.sheet for r in reports if r.sheet}
    if len(sizes) > 1:
        issues.append("Mixed sheet sizes in one set (" + ", ".join(sorted(sizes)) + "). Use one size for every sheet.")
    figs = []
    for r in reports:
        for f in r.figs:
            m = FIG_RE.match(f)
            figs.append((int(m.group(1)), m.group(2)))
    seen = set()
    for f in figs:
        if f in seen:
            issues.append(f"FIG. {f[0]}{f[1]} appears more than once.")
        seen.add(f)
    nums = sorted({n for n, _ in figs})
    if partial:
        return issues
    if nums and nums != list(range(1, nums[-1] + 1)):
        missing = sorted(set(range(1, nums[-1] + 1)) - set(nums))
        issues.append("FIG numbers are not sequential; missing " + ", ".join(f"FIG. {m}" for m in missing) + ".")
    return issues


def main(argv=None):
    # Figure text may contain non-ASCII (arrows, warning signs); on Windows
    # consoles the default cp1252 codec cannot print them and kills the run.
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass
    ap = argparse.ArgumentParser(description="Check patent drawing SVG sheets against 37 CFR 1.84.")
    ap.add_argument("files", nargs="+", help="SVG sheets, in sheet order")
    ap.add_argument("--json", action="store_true", help="print a JSON report")
    ap.add_argument("--partial", action="store_true",
                    help="the files are only part of the set (for example replacement sheets): "
                         "skip the check that figures run from FIG. 1 without gaps")
    args = ap.parse_args(argv)

    paths = [Path(f) for f in args.files]
    multi = len(paths) > 1
    reports = [check_sheet(p, multi) for p in paths]
    set_issues = check_set(reports, partial=args.partial)
    all_ok = all(r.ok for r in reports) and not set_issues

    numeral_map = {}
    for r in reports:
        for n in r.numerals:
            numeral_map.setdefault(n, []).append(r.path.name)

    if args.json:
        print(json.dumps({
            "pass": all_ok,
            "sheets": [r.as_dict() for r in reports],
            "set_issues": set_issues,
            "numerals": numeral_map,
        }, indent=2))
    else:
        for r in reports:
            print(f"{r.path.name}: {'PASS' if r.ok else 'FAIL'}  sheet={r.sheet}  {r.orientation}  "
                  f"figures={', '.join(r.figs) or 'none'}  smallest text={r.min_font} mm"
                  + (f"  top margin: {' | '.join(r.indicia)}" if r.indicia else ""))
            for f in r.fails:
                print("  FAIL  " + f)
            for wmsg in r.warns:
                print("  WARN  " + wmsg)
        print("Set: " + ("PASS" if not set_issues else "FAIL"))
        for i in set_issues:
            print("  FAIL  " + i)
        if numeral_map:
            print("Reference numerals used (check each one appears in the specification):")
            print("  " + ", ".join(sorted(numeral_map, key=lambda n: (int(re.match(r'\d+', n).group()), n))))
        print("\nOVERALL: " + ("PASS" if all_ok else "FAIL")
              + "  (automated checks only; numeral meaning, lead lines and claim coverage still need review)")
    return 0 if all_ok else 1


if __name__ == "__main__":
    sys.exit(main())
