#!/usr/bin/env python3
# Copyright 2026 Kevin Ringler
# SPDX-License-Identifier: Apache-2.0
"""Automated tests for the patent-drawing scripts (tests 9, 10 and 26 to 28 in TEST_SUITE.md).
Run from the skill root:  python tests/run_script_tests.py
"""
import json
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PY = sys.executable
failures = 0


def run(args):
    return subprocess.run([PY, *args], cwd=ROOT, capture_output=True, text=True)


def check(label, cond, detail=""):
    global failures
    print(("PASS " if cond else "FAIL ") + label + (f"  {detail}" if detail and not cond else ""))
    if not cond:
        failures += 1


# Good example passes
r = run(["scripts/check_drawing.py", "examples/fig-1-software-method.svg"])
check("example figure passes checker", r.returncode == 0, r.stdout)

# Bad fixture: every planted error is caught
r = run(["scripts/check_drawing.py", "--json", "tests/fixtures/bad-sheet.svg"])
rep = json.loads(r.stdout)
text = json.dumps(rep)
check("bad sheet fails", r.returncode == 1 and not rep["pass"])
for needle in ["margin guides", "opacity", "#808080", "#3366ff", "cross into the margins",
               "too small", "Fig. 1", "No 'FIG. N' label", "excessive text"]:
    check(f"bad sheet flags: {needle}", needle in text)

# Unsafe SVGs are refused by both scripts before parsing
for fx in ["tests/fixtures/unsafe-entity.svg", "tests/fixtures/unsafe-link.svg"]:
    r = run(["scripts/check_drawing.py", fx])
    check(f"checker refuses {Path(fx).name}", r.returncode == 1 and "Refused to process" in r.stdout, r.stdout)
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
        out = Path(tmp) / "x.pdf"
        r = run(["scripts/build_pdf.py", fx, "-o", str(out)])
        check(f"PDF builder refuses {Path(fx).name}", r.returncode != 0 and "refused" in (r.stdout + r.stderr) and not out.exists(), r.stdout + r.stderr)

# Text touching lines, text direction, top margin rules
r = run(["scripts/check_drawing.py", "tests/fixtures/overlap.svg"])
check("overflowing label and lead line through numeral are caught",
      r.returncode == 1 and "VALIDATE USER INPUT" in r.stdout and "'104'" in r.stdout and "touch or cross" in r.stdout, r.stdout)
r = run(["scripts/check_drawing.py", "tests/fixtures/landscape-wrong.svg"])
check("landscape sheet with upright text fails", r.returncode == 1 and "not turned with it" in r.stdout, r.stdout)
r = run(["scripts/check_drawing.py", "tests/fixtures/rotated-on-upright.svg"])
check("rotated text on upright sheet fails", r.returncode == 1 and "rotated text" in r.stdout, r.stdout)
r = run(["scripts/check_drawing.py", "tests/fixtures/top-margin-ok.svg"])
check("label in top-margin group passes", r.returncode == 0 and "Replacement Sheet" in r.stdout, r.stdout)
r = run(["scripts/check_drawing.py", "tests/fixtures/top-margin-bad.svg"])
check("top-margin group outside margin or with shapes fails",
      r.returncode == 1 and "Only text is allowed" in r.stdout and "inside the top margin" in r.stdout, r.stdout)

# Partial mode for replacement sheets
r = run(["scripts/check_drawing.py", "examples/sideways-sheet/fig-2.svg"])
check("single FIG. 2 sheet fails sequence without --partial", r.returncode == 1 and "missing FIG. 1" in r.stdout)
r = run(["scripts/check_drawing.py", "--partial", "examples/sideways-sheet/fig-2.svg"])
check("single FIG. 2 sheet passes with --partial (sideways sheet)", r.returncode == 0 and "landscape" in r.stdout, r.stdout)

# Full six sheet example set, indicia, replacement label and numbering
FULL = ["examples/fig-1-claim-flowchart.svg", "examples/sideways-sheet/fig-2.svg",
        "examples/two-sheet-flowchart/fig-3a.svg", "examples/two-sheet-flowchart/fig-3b.svg",
        "examples/two-figures-one-sheet/fig-4.svg", "examples/ui-screen/fig-5.svg"]
r = run(["scripts/check_drawing.py", *FULL])
check("six sheet example set passes (UI, sideways, 3A/3B, 4A/4B)", r.returncode == 0, r.stdout)
with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
    out = Path(tmp) / "full.pdf"
    r = run(["scripts/build_pdf.py", *FULL, "-o", str(out), "--indicia", "Example; Docket 1"])
    check("six sheet set builds", r.returncode == 0 and "PASS 6 page(s)" in r.stdout, r.stdout + r.stderr)
    out2 = Path(tmp) / "repl.pdf"
    r = run(["scripts/build_pdf.py", FULL[1], "-o", str(out2), "--label", "Replacement Sheet",
             "--sheet-start", "2", "--sheet-total", "6"])
    check("replacement sheet builds", r.returncode == 0, r.stdout + r.stderr)
    try:
        import pymupdf
        for pdf, needs in ((out, ["Docket", "1/6"]), (out2, ["Replacement", "2/6"])):
            d = pymupdf.open(str(pdf))
            top = [w[4] for w in d[0].get_text("words") if w[1] * 25.4 / 72 < 34]
            check(f"{pdf.name}: top of sheet shows {needs}", all(n in " ".join(top) for n in needs), str(top))
            d.close()
    except ImportError:
        print("SKIP pymupdf not installed")

# Templates must fail until guides are removed
r = run(["scripts/check_drawing.py", "assets/blank-sheet-us-letter.svg"])
check("untouched template is rejected", r.returncode == 1)

# Set checks: sequence and size
sheets = ["tests/fixtures/set-sheet-1.svg", "tests/fixtures/set-sheet-2.svg"]
r = run(["scripts/check_drawing.py", *sheets])
check("two sheet set passes", r.returncode == 0, r.stdout)
check("A4 sheets report sheet=a4", r.stdout.count("sheet=a4") == 2, r.stdout)
r = run(["scripts/check_drawing.py", sheets[0], "examples/fig-1-software-method.svg"])
check("mixed A4 + Letter set fails", r.returncode == 1 and "Mixed sheet sizes" in r.stdout)

# A4 sheets run through the numeral checker and brief description too
with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
    spec = Path(tmp) / "spec.txt"
    spec.write_text("Referring to FIG. 1, the client 202 talks to the server 204, which reads the "
                    "database 206. FIG. 2 shows the cache 302 feeding the index 304. "
                    "Filed 10/04/2026 as 18/483,359 under 35 U.S.C. 112 and 37 CFR 1.84, at 100% duty.")
    r = run(["scripts/check_numerals.py", "--spec", str(spec), *sheets])
    check("numeral checker PASS when spec covers every numeral",
          r.returncode == 0 and "OVERALL: PASS" in r.stdout, r.stdout)
    spec.write_text("The client 202 talks to the server 204. A memory 999 is mentioned but not drawn.")
    r = run(["scripts/check_numerals.py", "--spec", str(spec), *sheets])
    check("numeral checker fails on drawing-only numerals, warns on spec-only",
          r.returncode == 1 and "206, 302, 304" in r.stdout and "WARN" in r.stdout and "999" in r.stdout, r.stdout)
    r = run(["scripts/check_numerals.py", "--spec", str(spec), "tests/fixtures/unsafe-entity.svg"])
    check("numeral checker refuses unsafe SVG", r.returncode == 1 and "refused" in r.stdout)
    r = run(["scripts/brief_description.py", *sheets])
    check("brief description drafts FIG. 1 and FIG. 2 lines",
          r.returncode == 0 and "FIG. 1 is" in r.stdout and "FIG. 2 is" in r.stdout, r.stdout)

# Brief description over the six sheet example set groups lettered figures
r = run(["scripts/brief_description.py", *FULL])
check("brief description groups FIGS. 3A/3B and 4A/4B",
      r.returncode == 0 and "FIGS. 3A and 3B" in r.stdout and "FIGS. 4A and 4B" in r.stdout
      and "FIG. 5 is" in r.stdout, r.stdout)
r = run(["scripts/brief_description.py", "tests/fixtures/bad-sheet.svg"])
check("brief description fails when no FIG label exists", r.returncode == 1 and "No 'FIG. N'" in r.stdout)

# PDF build
with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
    out = Path(tmp) / "set.pdf"
    r = run(["scripts/build_pdf.py", *sheets, "-o", str(out), "--preview", str(Path(tmp) / "pv")])
    check("PDF builds and verifies", r.returncode == 0 and "PASS 2 page(s)" in r.stdout, r.stdout + r.stderr)
    try:
        import pymupdf
        doc = pymupdf.open(str(out))
        check("PDF pages are exactly A4",
              all(abs(p.rect.width - 595.28) < 1 and abs(p.rect.height - 841.89) < 1 for p in doc))
        words = [doc[i].get_text() for i in range(doc.page_count)]
        check("sheet numbers 1/2 and 2/2 present", "1/2" in words[0] and "2/2" in words[1])
        for i, page in enumerate(doc):
            num = [b for b in page.get_text("words") if b[4] in ("1/2", "2/2")]
            top_ok = all(25 * 72 / 25.4 <= w[1] and w[3] <= 33 * 72 / 25.4 for w in num)
            check(f"sheet number on page {i+1} inside sight area band", bool(num) and top_ok)
        doc.close()
    except ImportError:
        print("SKIP pymupdf not installed; sheet number position not verified")

# Numerals and FIG labels versus the specification (check_numerals.py)
r = run(["scripts/check_numerals.py", "--spec", "tests/fixtures/numerals/spec-match.md", *FULL])
check("numerals match a spec with dates, units, citations, claims and patent numbers (no false hits)",
      r.returncode == 0 and "OVERALL: PASS" in r.stdout, r.stdout + r.stderr)
PART = ["examples/fig-1-claim-flowchart.svg", "examples/two-sheet-flowchart/fig-3a.svg",
        "examples/two-sheet-flowchart/fig-3b.svg"]
for spec in ("tests/fixtures/numerals/spec-mismatch.txt", "tests/fixtures/numerals/spec-mismatch.docx"):
    r = run(["scripts/check_numerals.py", "--json", "--spec", spec, *PART])
    try:
        rep = json.loads(r.stdout)
    except ValueError:
        rep = {}
    # Drawing only numerals and missing figures FAIL; spec only numerals are WARN.
    ok = (r.returncode == 1 and rep.get("result") == "FAIL" and rep.get("pass") is False
          and rep.get("missing_from_spec") == ["110", "312", "314", "316", "318"]
          and rep.get("spec_only") == ["120", "122"]
          and rep.get("spec_mentions_missing_figures") == ["FIG. 3C", "FIG. 6"]
          and rep.get("figures_not_mentioned_in_spec") == [])
    check(f"numeral mismatches found exactly ({Path(spec).suffix})", ok, r.stdout + r.stderr)
    r = run(["scripts/check_numerals.py", "--spec", spec, *PART])
    check(f"numeral mismatch text report: FAIL lines, WARN line, OVERALL: FAIL ({Path(spec).suffix})",
          r.returncode == 1 and "110, 312, 314, 316, 318" in r.stdout and "FIG. 3C, FIG. 6" in r.stdout
          and "WARN" in r.stdout and "120, 122" in r.stdout and r.stdout.rstrip().endswith("OVERALL: FAIL"),
          r.stdout)
# Spec only numerals alone are a WARN with exit 0
with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
    spec = Path(tmp) / "spec.md"
    spec.write_text((ROOT / "tests/fixtures/numerals/spec-match.md").read_text(encoding="utf-8")
                    + "\nA backup server 520 mirrors the screen 500.\n", encoding="utf-8")
    r = run(["scripts/check_numerals.py", "--spec", str(spec), *FULL])
    check("spec only numeral alone gives OVERALL: WARN with exit 0",
          r.returncode == 0 and "OVERALL: WARN" in r.stdout and "520" in r.stdout, r.stdout)
    # Citations, units and application numbers never become numerals
    spec.write_text("FIG. 1 shows a server 202. Under 35 U.S.C. 112(b), 35 USC 101, 37 CFR 1.84, "
                    "37 C.F.R. 1.121(d), MPEP 608.02, Rule 84, PCT Article 84 and \u00a7 112, the "
                    "gateway 204 is 120 mm wide, waits 250 ms, uses IEEE 802.11 and was filed as "
                    "18/483,359 on October 4, 2026.", encoding="utf-8")
    r = run(["scripts/check_numerals.py", "--json", "--spec", str(spec), "tests/fixtures/set-sheet-1.svg"])
    rep = json.loads(r.stdout or "{}")
    check("statute and rule citations, units and dates give no numerals (no 112, 184, 101, 121, 84)",
          rep.get("spec_numerals") == ["202", "204"], r.stdout)
# Claims in a second --spec file count too
with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
    a, b = Path(tmp) / "spec.txt", Path(tmp) / "claims.txt"
    a.write_text("FIG. 1 shows the client 202 and the server 204. FIG. 2 shows the cache 302.", encoding="utf-8")
    b.write_text("1. A system comprising a database 206 and an index 304.", encoding="utf-8")
    r = run(["scripts/check_numerals.py", "--spec", str(a), "--spec", str(b), *sheets])
    check("repeatable --spec combines spec and claims", r.returncode == 0 and "OVERALL: PASS" in r.stdout, r.stdout)
r = run(["scripts/check_numerals.py", "--spec", "tests/fixtures/numerals/spec-match.md",
         "tests/fixtures/unsafe-entity.svg"])
check("numeral checker refuses unsafe SVG", r.returncode == 1 and "refused because" in r.stdout, r.stdout)
r = run(["scripts/check_numerals.py", "--spec", "tests/fixtures/numerals/missing.txt", *PART])
check("numeral checker reports an unreadable spec as FAIL (exit 1)",
      r.returncode == 1 and "FAIL  spec missing.txt" in r.stdout and "OVERALL: FAIL" in r.stdout, r.stdout + r.stderr)

# A4 sheets, upright and sideways (complex-figures.md: turned area x 10 to 263, y 25 to 195)
A4 = ["tests/fixtures/a4/fig-1.svg", "tests/fixtures/a4/fig-2-sideways.svg"]
r = run(["scripts/check_drawing.py", *A4])
check("A4 upright plus A4 sideways set passes at the documented limits",
      r.returncode == 0 and "sheet=a4  landscape" in r.stdout, r.stdout)
side = (ROOT / A4[1]).read_text(encoding="utf-8")
A4_BREAKS = [  # (what moves, old text, new text, expected message)
    ("x past 263 into the sheet number band",
     'x1="262.5" y1="25.5" x2="262.5"', 'x1="264.5" y1="25.5" x2="264.5"', "reserved for the sheet number"),
    ("x past 272 into the top margin",
     'x1="262.5" y1="25.5" x2="262.5"', 'x1="273.5" y1="25.5" x2="273.5"', "cross into the margins"),
    ("x below 10 into the bottom margin", 'x1="10.5" y1="25.5"', 'x1="9" y1="25.5"', "cross into the margins"),
    ("y below 25 into the left margin",
     'y1="25.5" x2="262.5" y2="25.5"', 'y1="24" x2="262.5" y2="24"', "cross into the margins"),
    ("y past 195 into the right margin",
     'y1="194.5" x2="100" y2="194.5"', 'y1="196" x2="100" y2="196"', "cross into the margins"),
]
with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
    for i, (what, old, new, msg) in enumerate(A4_BREAKS):
        assert old in side, old
        bad = Path(tmp) / f"a4-bad-{i}.svg"
        bad.write_text(side.replace(old, new), encoding="utf-8")
        r = run(["scripts/check_drawing.py", A4[0], str(bad)])
        check(f"A4 sideways sheet fails when drawing goes {what}", r.returncode == 1 and msg in r.stdout, r.stdout)
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp2:
        out = Path(tmp2) / "a4.pdf"
        r = run(["scripts/build_pdf.py", *A4, "-o", str(out)])
        check("A4 set builds as two A4 pages", r.returncode == 0 and "PASS 2 page(s)" in r.stdout, r.stdout + r.stderr)
        r = run(["scripts/check_drawing.py", "--partial", A4[1]])
        check("A4 sideways replacement sheet passes alone with --partial",
              r.returncode == 0 and "sheet=a4  landscape" in r.stdout, r.stdout)
        out2 = Path(tmp2) / "a4-repl.pdf"
        r = run(["scripts/build_pdf.py", A4[1], "-o", str(out2), "--label", "Replacement Sheet",
                 "--sheet-start", "2", "--sheet-total", "2"])
        check("A4 sideways replacement sheet builds", r.returncode == 0 and "PASS 1 page(s)" in r.stdout,
              r.stdout + r.stderr)
        try:
            import pymupdf
            d = pymupdf.open(str(out2))
            pg = d[0]
            top = " ".join(w[4] for w in pg.get_text("words") if w[1] * 25.4 / 72 < 34)
            check("A4 replacement sheet: A4 page with label and 2/2 at the top",
                  abs(pg.rect.width - 595.28) < 1 and abs(pg.rect.height - 841.89) < 1
                  and "Replacement" in top and "2/2" in top, top)
            d.close()
        except ImportError:
            print("SKIP pymupdf not installed; A4 replacement sheet text not verified")

# Standard library only: the checkers must work in a Python with no packages
# (vendored svgelements, built in Helvetica widths); the PDF builder must stop
# with a clear install message.
with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
    venv = Path(tmp) / "bare"
    made = subprocess.run([PY, "-m", "venv", "--without-pip", str(venv)], capture_output=True, text=True)
    bare = venv / ("Scripts/python.exe" if sys.platform == "win32" else "bin/python")
    if made.returncode != 0 or not bare.exists():
        print("SKIP could not create a bare virtual environment; stdlib only checks not run")
    else:
        def run_bare(args):
            return subprocess.run([str(bare), *args], cwd=ROOT, capture_output=True, text=True)
        r = run_bare(["-c", "import svgelements"])
        check("bare venv really has no svgelements installed", r.returncode != 0, r.stdout + r.stderr)
        r = run_bare(["scripts/check_drawing.py", *FULL])
        check("stdlib only: six sheet example set passes (vendored svgelements)", r.returncode == 0, r.stdout + r.stderr)
        r = run_bare(["scripts/check_drawing.py", *A4])
        check("stdlib only: A4 set passes", r.returncode == 0, r.stdout + r.stderr)
        r = run_bare(["scripts/check_drawing.py", "tests/fixtures/overlap.svg"])
        check("stdlib only: overlap fixture still caught",
              r.returncode == 1 and "VALIDATE USER INPUT" in r.stdout and "'104'" in r.stdout, r.stdout + r.stderr)
        r = run_bare(["scripts/check_drawing.py", "--json", "tests/fixtures/bad-sheet.svg"])
        check("stdlib only: bad sheet fails", r.returncode == 1 and '"pass": false' in r.stdout, r.stdout + r.stderr)
        r = run_bare(["scripts/check_drawing.py", "tests/fixtures/unsafe-entity.svg"])
        check("stdlib only: unsafe SVG refused", r.returncode == 1 and "Refused to process" in r.stdout, r.stdout)
        r = run_bare(["scripts/check_numerals.py", "--spec", "tests/fixtures/numerals/spec-match.md", *FULL])
        check("stdlib only: numeral checker matches", r.returncode == 0 and "OVERALL: PASS" in r.stdout, r.stdout + r.stderr)
        r = run_bare(["scripts/check_numerals.py", "--spec", "tests/fixtures/numerals/spec-mismatch.docx", *PART])
        check("stdlib only: numeral checker reads .docx and finds mismatches",
              r.returncode == 1 and "FIG. 3C" in r.stdout, r.stdout + r.stderr)
        out = Path(tmp) / "bare.pdf"
        r = run_bare(["scripts/build_pdf.py", *A4, "-o", str(out)])
        check("stdlib only: PDF builder stops with an install message",
              r.returncode != 0 and "pip install svglib reportlab" in r.stderr and not out.exists(), r.stdout + r.stderr)

print("\nALL PASSED" if not failures else f"\n{failures} FAILED")
sys.exit(1 if failures else 0)
