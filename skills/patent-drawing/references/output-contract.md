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
| Figures were produced (or revised) | Files plus the full summary below, including the draft Brief Description of the Drawings |
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
  Numerals vs spec:    MATCHED | MATCHED with warnings (list) | MISMATCH (list) | NOT CHECKED (no specification provided)
                       (result of scripts/check_numerals.py when a spec was given)
  Problems found and fixed: <list, or "none">

Assumptions (please confirm)
  <anything drawn that the user did not supply, or "none">

BRIEF DESCRIPTION OF THE DRAWINGS (draft for your attorney to review)
  FIG. 1 is a <figure type> of <what it shows>.
  FIG. 2 is a <figure type> of <what it shows>.

Open items
  <anything still needed before filing, or "none">

<Disclaimer from SKILL.md>
```

Numerals vs spec comes from `scripts/check_numerals.py`, run whenever the
user provided a specification or claims (.txt, .md or .docx; repeat `--spec`
for several files):

```bash
python scripts/check_numerals.py --spec spec.docx fig-1.svg fig-2.svg
```

Report its last line: `OVERALL: PASS` is MATCHED; `OVERALL: WARN` is MATCHED
with warnings (list each spec numeral not drawn and ask the user to confirm
it was meant to stay undrawn); `OVERALL: FAIL` is MISMATCH with each FAIL
listed (also under Open items). With no specification, write NOT CHECKED (no
specification provided); never MATCHED. The script is a heuristic, so still
confirm that each numeral names the same part in both.

## Brief Description of the Drawings (draft)

Whenever figures are delivered, include a draft "BRIEF DESCRIPTION OF THE
DRAWINGS" section in the summary, as shown above, so the user can paste it
into the specification. Produce it in two steps:

1. Run `python scripts/brief_description.py fig-1.svg fig-2.svg ...` on the
   sheets in sheet order. It reads the FIG labels and prints one correctly
   numbered and grouped sentence per figure with a placeholder ("FIGS. 3A and
   3B together are <describe this view>.").
2. Fill every placeholder, following these rules:

- Use the usual form: "FIG. 1 is a block diagram of a monitoring system
  according to an embodiment." or "FIG. 2 is a flowchart of a method of
  generating an alert."
- The script groups every lettered view of one number. Keep the group for
  partial views of one figure (a flowchart continued over two sheets:
  "FIGS. 3A and 3B together are a flowchart of an order fulfillment
  method."). When the lettered views show different things (FIG. 4A a
  record, FIG. 4B a state diagram), split the line into one sentence each.
- Use the user's own terms and only what the figure actually shows. Do not
  add features, advantages or claim language.
- If the specification already has this section, compare it with the
  figures instead and report differences under Open items (check_numerals.py
  also reports figures the specification mentions that do not exist).
- Always label it a draft for the user's patent attorney or agent to review;
  it is text for the application, not part of the drawings.

## Rules for the summary

- Never write PASS for a check that did not run.
- List every failure found during the work, even if fixed.
- Keep internal reasoning, coordinates and tool chatter out of the summary.
- Element names in the numeral list must use the user's own terms.
