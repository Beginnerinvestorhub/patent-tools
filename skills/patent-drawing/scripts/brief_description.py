#!/usr/bin/env python3
# Copyright 2026 Kevin Ringler
# SPDX-License-Identifier: Apache-2.0
"""
brief_description.py: draft the skeleton of the Brief Description of the
Drawings section for a specification, from the FIG. labels on the sheets.

Usage:
    python brief_description.py fig-1.svg fig-2.svg fig-3.svg ...

Reads every sheet in order, finds the "FIG. N" / "FIG. NA" labels and prints
one sentence per figure in the usual form:

    BRIEF DESCRIPTION OF THE DRAWINGS

    FIG. 1 is a <describe this view>.
    FIG. 2 is a <describe this view>.
    FIGS. 3A and 3B together are <describe these views>.

Fill each placeholder with what the figure shows, in the user's own terms
("a flowchart of the login method", "a block diagram of the system"). Keep
the wording consistent with the detailed description. Sheets are used in the
order given on the command line, so pass them in sheet order.

Exit code 0 normally, 1 when a file is unreadable, unsafe, or no FIG. label
is found (a sheet without a label would also fail check_drawing.py).

Pure standard library: runs even where pip install is blocked.
"""
from __future__ import annotations

import argparse
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

FIG_RE = re.compile(r"^FIG\.\s(\d+)([A-Z]?)$")

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


def figure_labels(path: Path) -> list[tuple[int, str]]:
    """(number, suffix) for every FIG. label on the sheet, in document order."""
    reason = unsafe_reason(path)
    if reason:
        raise ValueError(f"refused because {reason}")
    try:
        root = ET.parse(path).getroot()
    except ET.ParseError as e:
        raise ValueError(f"not valid XML/SVG: {e}")
    labels = []
    for el in root.iter():
        if el.tag.split("}", 1)[-1] != "text":
            continue
        m = FIG_RE.match("".join(el.itertext()).strip())
        if m:
            labels.append((int(m.group(1)), m.group(2)))
    return labels


def join_figs(nums: list[str]) -> str:
    """'3A', '3B' -> 'FIGS. 3A and 3B'; '4A','4B','4C' -> 'FIGS. 4A, 4B and 4C'."""
    if len(nums) == 1:
        return "FIG. " + nums[0]
    return "FIGS. " + ", ".join(nums[:-1]) + " and " + nums[-1]


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(
        description="Draft a Brief Description of the Drawings skeleton from the FIG. labels.")
    ap.add_argument("files", nargs="+", help="SVG drawing sheets, in sheet order")
    args = ap.parse_args(argv)

    figures: list[tuple[int, str]] = []
    errors = []
    for f in args.files:
        p = Path(f)
        try:
            figures.extend(figure_labels(p))
        except (ValueError, OSError) as e:
            errors.append(f"{p.name}: {e}")
    for e in errors:
        print("FAIL  " + e)
    if not figures:
        print("FAIL  No 'FIG. N' label found on any sheet.")
        return 1

    # Group by base number, keeping first-seen order; drop repeated labels.
    groups: dict[int, list[str]] = {}
    for num, suffix in figures:
        label = f"{num}{suffix}"
        group = groups.setdefault(num, [])
        if label not in group:
            group.append(label)

    print("BRIEF DESCRIPTION OF THE DRAWINGS\n")
    for num, labels in groups.items():
        verb = "is" if len(labels) == 1 else "together are"
        print(f"{join_figs(labels)} {verb} <describe this view>.")
    print("\nFill in each <describe this view> with what the figure shows, "
          "in the same terms the detailed description uses.")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
