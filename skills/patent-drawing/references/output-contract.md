# Output Contract

Every delivery produces the same files and the same summary, so results are
predictable and testable.

## Files

| File | When |
|---|---|
| `fig-1.svg`, `fig-2.svg` ... | Always. One file per sheet, in sheet order. If one sheet holds several views, name it by its first figure. |
| `drawings.pdf` | When the scripts are available. One PDF for the whole set. |
| `previews/sheet-1.png` ... | When pymupdf is available. Used for the visual review; share only if the user wants them. |

Deliver files to the user's outputs location. Do not deliver scratch files.

## Which format to use

| Situation | Format |
|---|---|
| Figures were produced (or revised) | Files plus the full summary below |
| Questions needed before drawing (ambiguous, incomplete, conflict) | Questions only, in one numbered message; no summary, no disclaimer needed |
| Guidance only (plant mode, design rules review, refused request, new matter after filing) | Plain prose answer: what is required, what the skill can and cannot do, what the user must supply, next step; end with the disclaimer. No figure summary. |

## Summary (use this exact structure when figures are delivered)

```
PATENT DRAWINGS: <short invention title>

Mode: <Utility | Design | Plant | Multi jurisdiction>   Sheet size: <US Letter | A4>
Sheets: <N>   Figures: <FIG. 1, FIG. 2, ...>

Figures
  FIG. 1  <what it shows>  (sheet 1)
  FIG. 2  <what it shows>  (sheet 2)

Reference numerals
  102  <element name>
  104  <element name>
  ...

Claim coverage
  Claim <n>, step (a) → FIG. 1, 102
  Claim <n>, step (b) → FIG. 1, 104
  (or: "No claims provided; coverage not checked")

Checks
  Automated checker:   PASS | FAIL | NOT RUN (<reason>)
  PDF build/verify:    PASS | FAIL | NOT BUILT (<reason>)
  Visual review:       PASS | issues listed below
  Numerals vs spec:    MATCHED | MISMATCH (list) | NOT CHECKED (no specification provided)
                       (result of scripts/check_numerals.py when a spec was given)
  Problems found and fixed: <list, or "none">

Assumptions (please confirm)
  <anything drawn that the user did not supply, or "none">

Open items
  <anything still needed before filing, or "none">

<Disclaimer from SKILL.md>
```

Rules for the summary:

- Never write PASS for a check that did not run.
- List every failure found during the work, even if fixed.
- Keep internal reasoning, coordinates and tool chatter out of the summary.
- Element names in the numeral list must use the user's own terms.
