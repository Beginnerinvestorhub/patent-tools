#!/usr/bin/env python3
# Copyright 2026 Kevin Ringler
# SPDX-License-Identifier: Apache-2.0
"""
check_numerals.py: compare the reference numerals in drawing sheets against
the written description (and claims), and flag any that appear in only one.

Usage:
    python check_numerals.py --spec spec.txt fig-1.svg fig-2.svg ...
    python check_numerals.py --spec spec.txt --spec claims.txt fig-*.svg
    python check_numerals.py --spec spec.txt --json fig-1.svg

Why: examiners object when a numeral in the drawings is never mentioned in
the specification, and a numeral the spec describes should usually be shown.
This is a flag for review, not a legal judgment: a spec-only numeral may be
an element the user chose not to draw.

What counts as a numeral:
  * In the SVG sheets: a whole text element that is 1 to 4 digits with an
    optional lowercase letter (102, 102a), the same rule check_drawing.py
    uses for its numeral inventory.
  * In the spec: any parenthesised number "(102)", or a bare number of 3 or
    4 digits. Paragraph numbers [0031], figure references (FIG. 2),
    application numbers (18/483,359), dates, percentages and statute or rule
    citations (35 U.S.C. 112, 37 CFR 1.84) are stripped first so they do not
    create noise. Bare one and two digit numbers are ignored because they
    are usually claim or step numbers, not reference numerals.

Result:
  * FAIL: a numeral appears in the drawings but nowhere in the spec.
  * WARN: a numeral appears in the spec but in no drawing.
  * PASS: every drawing numeral is in the spec and no spec-only numerals.

Exit code 0 for PASS or WARN, 1 for FAIL or an unreadable/unsafe file.

Pure standard library: runs even where pip install is blocked.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

NUMERAL_RE = re.compile(r"^\d{1,4}[a-z]?$")
PAREN_NUM_RE = re.compile(r"\(\s*(\d{1,4}[a-z]?)\s*\)")
BARE_NUM_RE = re.compile(r"(?<![\w.])\d{3,4}[a-z]?(?![\w]|\.\d)")

# Text stripped before scanning for spec numerals, in order.
_SPEC_NOISE = [
    re.compile(r"\[\s*\d+\s*\]"),                                  # paragraph numbers [0031]
    re.compile(r"FIGS?\.\s*\d+[A-Z]?", re.I),                      # figure references FIG. 2
    re.compile(r"\d{1,2}/\d{2,3},\d{3}"),                          # application numbers 18/483,359
    re.compile(r"\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}"),                # dates 10/04/2026
    re.compile(r"\d+(?:\.\d+)?\s*%"),                              # percentages 100%
    re.compile(r"(?:CFR|U\.?\s?S\.?\s?C\.?|MPEP)\s*§{0,2}\s*[\d.]+", re.I),  # CFR 1.84, U.S.C. 112
    re.compile(r"[\d.]+\s*(?:CFR|U\.?\s?S\.?\s?C\.?|MPEP)", re.I),             # 37 CFR, 35 U.S.C.
]

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


def sort_key(n: str):
    m = re.match(r"\d+", n)
    return (int(m.group()), n)


def drawing_numerals(path: Path) -> set[str]:
    """Every whole text element that is a bare numeral (1-4 digits + letter)."""
    reason = unsafe_reason(path)
    if reason:
        raise ValueError(f"refused because {reason}")
    try:
        root = ET.parse(path).getroot()
    except ET.ParseError as e:
        raise ValueError(f"not valid XML/SVG: {e}")
    numerals = set()
    for el in root.iter():
        if el.tag.split("}", 1)[-1] != "text":
            continue
        s = "".join(el.itertext()).strip()
        if NUMERAL_RE.match(s):
            numerals.add(s)
    return numerals


def spec_numerals(paths: list[Path]) -> set[str]:
    """Numeral-like numbers in the spec text: (102) or bare 3-4 digit numbers."""
    text = " ".join(p.read_text(encoding="utf-8", errors="replace") for p in paths)
    numerals = set(PAREN_NUM_RE.findall(text))
    for rx in _SPEC_NOISE:
        text = rx.sub(" ", text)
    numerals.update(BARE_NUM_RE.findall(text))
    return numerals


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(
        description="Compare drawing reference numerals against the specification.")
    ap.add_argument("--spec", action="append", required=True, metavar="TXT",
                    help="specification, claims or other text file; repeat for several")
    ap.add_argument("files", nargs="+", help="SVG drawing sheets")
    ap.add_argument("--json", action="store_true", help="print a JSON report")
    args = ap.parse_args(argv)

    per_sheet = {}
    errors = []
    for f in args.files:
        p = Path(f)
        try:
            per_sheet[p.name] = drawing_numerals(p)
        except (ValueError, OSError) as e:
            errors.append(f"{p.name}: {e}")
    try:
        spec_nums = spec_numerals([Path(s) for s in args.spec])
    except OSError as e:
        errors.append(f"spec: {e}")
        spec_nums = set()

    drawn = set().union(*per_sheet.values()) if per_sheet else set()
    missing_from_spec = sorted(drawn - spec_nums, key=sort_key)
    not_drawn = sorted(spec_nums - drawn, key=sort_key)
    ok = not errors and not missing_from_spec

    if args.json:
        print(json.dumps({
            "pass": ok,
            "errors": errors,
            "drawing_numerals": {k: sorted(v, key=sort_key) for k, v in per_sheet.items()},
            "spec_numerals": sorted(spec_nums, key=sort_key),
            "missing_from_spec": missing_from_spec,
            "spec_only": not_drawn,
        }, indent=2))
        return 0 if ok else 1

    for name, nums in per_sheet.items():
        print(f"{name}: numerals {', '.join(sorted(nums, key=sort_key)) or 'none'}")
    for e in errors:
        print("FAIL  " + e)
    if missing_from_spec:
        print("FAIL  Numerals in the drawings but not in the specification "
              "(describe each one or remove it): " + ", ".join(missing_from_spec))
    if not_drawn:
        print("WARN  Numbers in the specification not used in any drawing "
              "(check each is an element you meant not to draw): " + ", ".join(not_drawn))
    print("OVERALL: " + ("PASS" if ok and not not_drawn else "WARN" if ok else "FAIL"))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
