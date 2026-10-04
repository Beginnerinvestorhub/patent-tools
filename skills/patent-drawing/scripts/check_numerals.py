#!/usr/bin/env python3
# Copyright 2026 Kevin Ringler
# SPDX-License-Identifier: Apache-2.0
"""
check_numerals.py: cross check the reference numerals and FIG labels in
drawing sheets against the written description (and claims), and flag any
that appear in only one.

Usage:
    python check_numerals.py --spec spec.txt fig-1.svg fig-2.svg ...
    python check_numerals.py --spec spec.docx --spec claims.txt fig-*.svg
    python check_numerals.py --spec spec.md --json fig-1.svg

The specification may be .txt, .md or .docx (repeat --spec for several
files). A .docx is read with the Python standard library only (zipfile plus
XML parsing). Pure standard library: runs even where pip install is blocked.

Why: examiners object when a numeral in the drawings is never mentioned in
the specification, when the specification refers to a figure that does not
exist, and when a drawn figure is never described. A numeral the spec
describes should usually be shown too. This is a flag for review, not a
legal judgment: a spec only numeral may be an element the user chose not to
draw.

Result:
  * FAIL: a numeral appears in the drawings but nowhere in the spec.
  * FAIL: a FIG label is drawn but the spec never mentions that figure.
  * FAIL: the spec mentions a figure ("FIG. 6", "FIGS. 3A to 3C") that is
    not in the drawings.
  * FAIL: an SVG or spec file is unreadable or refused as unsafe.
  * WARN: a numeral appears in the spec but in no drawing.
  * PASS: none of the above.
The last line is "OVERALL: PASS", "OVERALL: WARN" or "OVERALL: FAIL".
Exit code 0 for PASS or WARN, 1 for FAIL.

What counts as a numeral:
  * In the SVG sheets: a whole text element that is 1 to 4 digits with an
    optional lowercase letter (102, 102a), the same rule check_drawing.py
    uses for its numeral inventory. Text in the top margin group
    (id="top-margin": indicia and Replacement Sheet labels) is skipped.
  * In the spec (context based heuristic): a 2 to 4 digit number, optionally
    with one lowercase letter (202a), that directly follows a word ("server
    110", "the order (314)"), or that continues a list or range started that
    way ("elements 102, 104 and 106", "steps 302 through 310", "sensors
    202a-202c"). Single digit numbers are never spec numerals.
  * Ignored in the spec: claim references ("claim 1", "claims 2 to 5"),
    paragraph numbers ("[0031]", "paragraph 12"), figure numbers, dates
    ("October 4, 2026", "2026-10-04", "10/04/2026"), numbers with a decimal
    point, slash or thousands comma (application and patent numbers such as
    "18/483,359" or "7,669,123", "IEEE 802.11"), statute, rule and manual
    citations ("35 U.S.C. 112", "37 CFR 1.84", "MPEP 608.02", "Rule 84",
    "Article 84", "§ 112"; Rule, Article and Title only when capitalized,
    so "a rule 214" is still a numeral), numbers followed by a unit ("110
    mm", "50 %", "100 ms"), numbers after quantity or citation words ("about
    250", "at least 100", "No. 5", "version 2"), and 4 digit years 1900 to
    2099 unless a drawing uses the same number.
  * A drawing numeral also counts as described when it lies inside a spec
    range ("steps 302 through 310" covers 304 to 308, same hundred series
    only; "sensors 202a-202c" covers 202b) or appears in parentheses
    anywhere ("(110)").
  * A spec mention of a whole figure ("FIG. 3") counts as mentioning its
    partial views (FIG. 3A, FIG. 3B), and exists when any partial view
    exists. "FIGS. 2 to 4" and "FIGS. 4A-4C" expand to every figure between.

Limits: it matches numbers, not meanings, so confirm each matched numeral
names the same part in both. It can miss a numeral written after a quantity
word or preposition ("data goes to 110") and can flag a plain count written
right after a noun ("a buffer 64 entries deep"). See
references/compliance-checklist.md.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

NUMERAL_RE = re.compile(r"^\d{1,4}[a-z]?$")
FIG_LABEL_RE = re.compile(r"^FIG\.\s(\d+)([A-Z]?)$")
MAX_SPEC_BYTES = 50 * 1024 * 1024
W_NS = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"

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


# --- Reading the drawings ----------------------------------------------------


def drawing_labels(path: Path) -> tuple[set[str], set[tuple[int, str]]]:
    """(numerals, FIG labels) on one sheet. Numerals are whole text elements
    of 1 to 4 digits plus an optional lowercase letter; the top margin group
    (indicia, Replacement Sheet label) is skipped."""
    reason = unsafe_reason(path)
    if reason:
        raise ValueError(f"refused because {reason}")
    try:
        root = ET.parse(path).getroot()
    except ET.ParseError as e:
        raise ValueError(f"not valid XML/SVG: {e}")
    skip = set()
    for g in root.iter():
        if g.get("id") == "top-margin":
            skip.update(id(e) for e in g.iter())
    numerals, figs = set(), set()
    for el in root.iter():
        if el.tag.split("}", 1)[-1] != "text" or id(el) in skip:
            continue
        s = " ".join("".join(el.itertext()).split())
        m = FIG_LABEL_RE.match(s)
        if m:
            figs.add((int(m.group(1)), m.group(2)))
        elif NUMERAL_RE.match(s):
            numerals.add(s)
    return numerals, figs


# --- Reading the specification -----------------------------------------------


def read_docx(path: Path) -> str:
    """Plain text of a .docx body using only the standard library."""
    try:
        with zipfile.ZipFile(path) as z:
            info = z.getinfo("word/document.xml")
            if info.file_size > MAX_SPEC_BYTES:
                raise ValueError("word/document.xml is larger than 50 MB")
            data = z.read(info)
    except KeyError:
        raise ValueError("not a Word document (word/document.xml is missing)")
    except zipfile.BadZipFile:
        raise ValueError("not a valid .docx (zip) file")
    if re.search(rb"<!DOCTYPE|<!ENTITY", data, re.I):
        raise ValueError("refused because word/document.xml contains a DOCTYPE or ENTITY declaration")
    try:
        root = ET.fromstring(data)
    except ET.ParseError as e:
        raise ValueError(f"word/document.xml is not valid XML: {e}")
    paragraphs = []
    for p in root.iter(W_NS + "p"):
        parts = []
        for el in p.iter():
            if el.tag == W_NS + "t" and el.text:
                parts.append(el.text)
            elif el.tag == W_NS + "tab":
                parts.append(" ")
            elif el.tag in (W_NS + "br", W_NS + "cr"):
                parts.append("\n")
        paragraphs.append("".join(parts))
    return "\n".join(paragraphs)


def read_spec(path: Path) -> str:
    if path.stat().st_size > MAX_SPEC_BYTES:
        raise ValueError("specification is larger than 50 MB")
    suffix = path.suffix.lower()
    if suffix == ".docx":
        return read_docx(path)
    if suffix in (".txt", ".md", ".markdown", ".text"):
        return path.read_text(encoding="utf-8", errors="replace")
    raise ValueError("specification must be .txt, .md or .docx (save other formats as one of these)")


# --- Figure references in the specification ---------------------------------

_FIG_REF = re.compile(
    r"\b(?:FIGS?|Figs?|figs?|FIGURES?|Figures?|figures?)\.?\s*"
    r"(?P<first>\d{1,3}[A-Za-z]?)(?![A-Za-z0-9])"
    r"(?P<rest>(?:\s*(?:,\s*and|,\s*or|,|and|or|to|through|-|–)\s*"
    r"(?:(?:FIGS?|Figs?)\.?\s*)?\d{1,3}[A-Za-z]?(?![A-Za-z0-9]))*)")
_FIG_ITEM = re.compile(
    r"(,\s*and|,\s*or|,|and|or|to|through|-|–)?\s*(?:(?:FIGS?|Figs?)\.?\s*)?(\d{1,3})([A-Za-z]?)")


def _expand(prev: tuple[int, str], cur: tuple[int, str]) -> list[tuple[int, str]]:
    (n0, l0), (n1, l1) = prev, cur
    if n0 == n1 and l0 and l1 and l0 < l1:
        return [(n0, chr(c)) for c in range(ord(l0) + 1, ord(l1) + 1)]
    if not l0 and not l1 and n0 < n1 <= n0 + 50:
        return [(n, "") for n in range(n0 + 1, n1 + 1)]
    return [cur]


def spec_figure_refs(text: str):
    """Return ({(num, letter)}, list of (start, end) spans to mask)."""
    refs, spans = set(), []
    for m in _FIG_REF.finditer(text):
        spans.append(m.span())
        items = []
        chunk = m.group("first") + m.group("rest")
        for im in _FIG_ITEM.finditer(chunk):
            sep = (im.group(1) or "").strip().lower()
            cur = (int(im.group(2)), im.group(3).upper())
            if items and sep in ("to", "through", "-", "–"):
                items.extend(_expand(items[-1], cur))
            else:
                items.append(cur)
        refs.update(items)
    return refs, spans


# --- Numerals in the specification -------------------------------------------

_MONTHS = r"(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?"
_SUBSECTION = r"(?:\s*\([a-z0-9]{1,4}\))*"
# Text masked (replaced by spaces) before numerals are looked for.
_MASKS = [
    # statute, rule and manual citations: 35 U.S.C. 112(b), 37 CFR 1.84, MPEP 608.02
    re.compile(r"\b\d+\s*U\.?\s?S\.?\s?C\.?\s*(?:§+\s*)?\d+[a-z]?" + _SUBSECTION, re.I),
    re.compile(r"\b\d+\s*C\.?\s?F\.?\s?R\.?\s*(?:§+\s*)?\d+(?:\.\d+)*" + _SUBSECTION, re.I),
    re.compile(r"§+\s*\d+(?:\.\d+)*[a-z]?" + _SUBSECTION),
    re.compile(r"\bMPEP\s*(?:§+\s*)?\d+(?:\.\d+)*", re.I),
    # Capitalized citation forms only, so element names such as "a rule 214"
    # or "a title 510" stay numerals: "Rule 84", "PCT Rule 11.13", "Article 84
    # EPC", "Art. 123(2)", "Title 35 of the United States Code".
    re.compile(r"\b(?:Rules?|Articles?|Art\.)\s+\d+(?:\.\d+)*" + _SUBSECTION),
    re.compile(r"\bTitle\s+\d+(?=\s*(?:,|of\b|U\.?\s?S))"),
    # claims and paragraphs
    re.compile(r"\bclaims?\s+\d+(?:\s*(?:,\s*and|,\s*or|,|and|or|to|through|-|–)\s*\d+)*", re.I),
    re.compile(r"\[\s*\d{1,5}\s*\](?:\s*(?:-|–|to|through)\s*\[\s*\d{1,5}\s*\])?"),
    re.compile(r"\bparagraphs?\s+\d+", re.I),
    # dates
    re.compile(r"\b(?:19|20)\d\d-\d\d-\d\d\b"),
    re.compile(r"\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b"),
    re.compile(_MONTHS + r"\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}"),
    re.compile(r"\b\d{1,2}\s+" + _MONTHS + r"\s+\d{4}"),
    # application and patent numbers, decimals, times, money, hashes, hex
    re.compile(r"\d+(?:,\d{3})+"),          # 7,669,123 or 16/123,456
    re.compile(r"\d+(?:[./:]\d+)+"),         # 1.5, 802.11, 16/123, 10:30
    re.compile(r"(?:\$|#|0x)\w+", re.I),
]
_UNITS = {
    "mm", "cm", "m", "km", "nm", "um", "µm", "in", "inch", "inches", "ft", "feet", "yd",
    "mg", "g", "kg", "lb", "lbs", "oz", "ml", "l", "s", "sec", "secs", "second", "seconds",
    "ms", "us", "ns", "min", "mins", "minute", "minutes", "h", "hr", "hrs", "hour", "hours",
    "day", "days", "week", "weeks", "month", "months", "year", "years", "hz", "khz", "mhz",
    "ghz", "v", "mv", "kv", "a", "ma", "w", "kw", "mw", "wh", "kwh", "mah", "%", "percent",
    "°", "°c", "°f", "c", "f", "k", "deg", "degree", "degrees", "bit", "bits",
    "byte", "bytes", "kb", "mb", "gb", "tb", "kbps", "mbps", "gbps", "bps", "rpm", "psi",
    "pa", "kpa", "mpa", "bar", "dpi", "px", "pixels", "pt", "times", "x",
}
_STOP_ANCHORS = {
    # articles, prepositions and quantity words
    "a", "an", "the", "in", "on", "at", "of", "for", "to", "from", "by", "with", "into",
    "about", "approximately", "around", "nearly", "roughly", "least", "most", "than",
    "over", "under", "up", "between", "within", "after", "before", "since", "until",
    "every", "each", "per", "all", "some", "any", "only", "and", "or", "nor", "but",
    "is", "are", "was", "were", "be", "been", "as", "first", "second", "third", "last",
    "next", "top", "bottom", "exceeds", "exceed", "below", "above", "equals", "equal",
    # verbs that usually take a quantity
    "include", "includes", "including", "comprise", "comprises", "comprising",
    "contain", "contains", "containing", "has", "have", "had", "having", "store",
    "stores", "storing", "receive", "receives", "send", "sends", "take", "takes",
    "wait", "waits", "waiting", "use", "uses", "using", "filed", "dated", "issued",
    # citation and document words
    "claim", "claims", "paragraph", "paragraphs", "page", "pages", "line", "lines",
    "column", "columns", "col", "section", "sections", "table", "tables", "equation",
    "eq", "example", "examples", "no", "nos", "number", "numbers", "ser", "pat", "pub",
    "version", "v", "rfc", "iso", "ieee", "http", "https", "usc", "cfr", "year", "years",
    "fig", "figs", "figure", "figures", "sheet", "sheets", "series", "docket", "appl",
    "mpep",
}
_NUM = r"(?<![\w.$#/°])\(?(\d{1,4})([a-z]?)(?![\w])\)?"
_ANCHORED = re.compile(r"\b([A-Za-z][A-Za-z'’-]*)\.?(?:[ \t]+|[ \t]*\n[ \t]*)" + _NUM)
_CONT = re.compile(r"\s*(,\s*and|,\s*or|,|and|or|to|through|-|–)\s*" + _NUM)
_RANGE_WORDS = {"to", "through", "-", "–"}
_NEXT_WORD = re.compile(r"\s*([A-Za-zµ°%]+[A-Za-z]*|%)")
_PAREN = re.compile(r"\(\s*(\d{1,4}[a-z]?)\s*\)")


def _mask(text: str, spans) -> str:
    chars = list(text)
    for a, b in spans:
        for i in range(a, b):
            if chars[i] != "\n":
                chars[i] = " "
    return "".join(chars)


def _is_unit(text: str, end: int) -> bool:
    m = _NEXT_WORD.match(text, end)
    if not m:
        return text[end:end + 1] == "%"
    return m.group(1).lower() in _UNITS and (m.end() == len(text) or not text[m.end()].isalnum())


def spec_numerals(text: str, original: str):
    """Return ({numeral: first context snippet}, [(low, high) ranges]) for the
    numerals the (masked) spec text uses. "steps 302 through 310" also yields
    a range. original has the same offsets and is used for the snippets."""
    found, ranges = {}, []

    def add(num, letter, start, end):
        tok = num + letter
        if len(num) < 2 or _is_unit(text, end):
            return False
        if tok not in found:
            a, b = max(0, start - 30), min(len(text), end + 10)
            found[tok] = " ".join(original[a:b].split())
        return True

    for m in _ANCHORED.finditer(text):
        if m.group(1).lower().strip("'’-") in _STOP_ANCHORS:
            continue
        if not add(m.group(2), m.group(3), m.start(), m.end()):
            continue
        pos, prev = m.end(), (m.group(2), m.group(3))
        while True:
            c = _CONT.match(text, pos)
            if not c or not add(c.group(2), c.group(3), m.start(), c.end()):
                break
            cur = (c.group(2), c.group(3))
            if c.group(1).strip().lower() in _RANGE_WORDS:
                ranges.append((prev, cur))
            pos, prev = c.end(), cur
    return found, ranges


def in_range(tok: str, ranges) -> bool:
    """True when tok lies inside a spec range such as 302 through 310 (same
    hundred series) or 202a-202c (same base numeral)."""
    m = re.match(r"^(\d+)([a-z]?)$", tok)
    if not m:
        return False
    n, letter = int(m.group(1)), m.group(2)
    for (a, la), (b, lb) in ranges:
        a, b = int(a), int(b)
        if not la and not lb and not letter and a < n < b and a // 100 == b // 100:
            return True
        if la and lb and letter and a == b == n and la < letter < lb:
            return True
    return False


def is_year(tok: str) -> bool:
    return tok.isdigit() and len(tok) == 4 and 1900 <= int(tok) <= 2099


def fig_name(f: tuple[int, str]) -> str:
    return f"FIG. {f[0]}{f[1]}"


# --- Main --------------------------------------------------------------------


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(
        description="Cross check drawing reference numerals and FIG labels against the specification.")
    ap.add_argument("--spec", action="append", required=True, metavar="FILE",
                    help="specification, claims or other text as .txt, .md or .docx; repeat for several")
    ap.add_argument("files", nargs="+", help="SVG drawing sheets")
    ap.add_argument("--json", action="store_true", help="print a JSON report")
    args = ap.parse_args(argv)

    per_sheet: dict[str, set[str]] = {}
    drawing_figs: set[tuple[int, str]] = set()
    errors = []
    for f in args.files:
        p = Path(f)
        try:
            nums, figs = drawing_labels(p)
        except (ValueError, OSError) as e:
            errors.append(f"{p.name}: {e}")
            continue
        per_sheet[p.name] = nums
        drawing_figs |= figs

    texts = []
    for s in args.spec:
        try:
            texts.append(read_spec(Path(s)))
        except (ValueError, OSError) as e:
            errors.append(f"spec {Path(s).name}: {e}")
    spec_ok = len(texts) == len(args.spec)
    text = "\n\n".join(texts)

    fig_refs, spans = spec_figure_refs(text)
    for rx in _MASKS:
        spans.extend(m.span() for m in rx.finditer(text))
    masked = _mask(text, spans)
    found, ranges = spec_numerals(masked, text)
    parenthesised = set(_PAREN.findall(masked))

    drawn = set().union(*per_sheet.values()) if per_sheet else set()
    covered = lambda n: n in found or n in parenthesised or in_range(n, ranges)  # noqa: E731
    if spec_ok:
        missing_from_spec = sorted((n for n in drawn if not covered(n)), key=sort_key)
        not_drawn = sorted((n for n in found if n not in drawn and not is_year(n)), key=sort_key)
        whole = {n for n, letter in fig_refs if not letter}
        unmentioned = sorted(f for f in drawing_figs if f not in fig_refs and f[0] not in whole)
        drawn_fig_nums = {n for n, _ in drawing_figs}
        missing_figs = sorted(f for f in fig_refs
                              if (f[1] and f not in drawing_figs) or (not f[1] and f[0] not in drawn_fig_nums))
    else:  # an unreadable spec is already a FAIL; comparing against it would only add noise
        missing_from_spec, not_drawn, unmentioned, missing_figs = [], [], [], []
    spec_nums = sorted(set(found) | (parenthesised & drawn), key=sort_key)
    matched = sorted((n for n in drawn if covered(n)), key=sort_key) if spec_ok else []

    ok = not errors and not missing_from_spec and not unmentioned and not missing_figs
    result = "FAIL" if not ok else "WARN" if not_drawn else "PASS"

    if args.json:
        print(json.dumps({
            "pass": ok,
            "result": result,
            "errors": errors,
            "drawing_numerals": {k: sorted(v, key=sort_key) for k, v in per_sheet.items()},
            "spec_numerals": spec_nums,
            "missing_from_spec": missing_from_spec,
            "spec_only": not_drawn,
            "spec_only_context": {n: found[n] for n in not_drawn},
            "matched_numerals": matched,
            "figures_in_drawings": [fig_name(f) for f in sorted(drawing_figs)],
            "figures_not_mentioned_in_spec": [fig_name(f) for f in unmentioned],
            "spec_mentions_missing_figures": [fig_name(f) for f in missing_figs],
        }, indent=2))
        return 0 if ok else 1

    for name, nums in per_sheet.items():
        print(f"{name}: numerals {', '.join(sorted(nums, key=sort_key)) or 'none'}")
    print("Figures in drawings: " + (", ".join(fig_name(f) for f in sorted(drawing_figs)) or "none"))
    for e in errors:
        print("FAIL  " + e)
    if missing_from_spec:
        print("FAIL  Numerals in the drawings but not in the specification "
              "(describe each one or remove it): " + ", ".join(missing_from_spec))
    if unmentioned:
        print("FAIL  Figures in the drawings that the specification never mentions "
              "(describe each one): " + ", ".join(fig_name(f) for f in unmentioned))
    if missing_figs:
        print("FAIL  Figures the specification mentions that are not in the drawings "
              "(draw them or correct the text): " + ", ".join(fig_name(f) for f in missing_figs))
    if not_drawn:
        print("WARN  Numbers in the specification not used in any drawing "
              "(check each is an element you meant not to draw): " + ", ".join(not_drawn))
        for n in not_drawn:
            print(f"        {n}: \"...{found[n]}...\"")
    print("Numerals matched: " + (", ".join(matched) or "none")
          + "  (heuristic; confirm each numeral names the same part in both)")
    print("OVERALL: " + result)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
