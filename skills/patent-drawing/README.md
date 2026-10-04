# Patent Drawing Skill

A Claude skill that drafts and checks USPTO patent drawings under 37 CFR
1.84, and assembles them into a filing ready PDF.

Version 1.2.0 · Apache License 2.0 · Author: Kevin Ringler

> Not legal advice. Have a registered patent attorney or agent review any
> drawings before filing.

## Purpose

Patent drawings are rejected for small formal mistakes: content in the
margins, numerals under 3.2 mm, grey anti aliased lines, wrong figure labels,
missing sheet numbers, unembedded fonts. This skill makes Claude draft
drawings that avoid those mistakes and proves it with an automated checker,
so inventors and small firms can prepare compliant figures without a
professional illustrator for the common software and system cases.

## What it does

| Drawing type | Support |
|---|---|
| Software flowcharts, block diagrams, network and architecture figures, UI screens | Full: SVG sheets, automated checks, filing ready PDF |
| Simple mechanical or electrical line diagrams | Drafts at schematic level; recommends CAD for formal orthographic views |
| Design patents | Rule guidance and review |
| Plant patents | Rule guidance only |
| PCT and EPO filings | Applies the stricter A4 and minimal text rules |

## When it triggers

When you ask Claude for patent drawings or figures, mention 37 CFR 1.84,
1.83 or 1.152, need formal or informal drawings for an application, want
patent figures checked, or are responding to a drawing objection. It does
not trigger for general diagrams with no patent purpose.

## Install

This skill lives in the `patent-tools` repository at
`skills/patent-drawing/` — that folder is the skill (`SKILL.md` at its
top). Pick one:

* **Claude.ai and the Claude Desktop app.** Enable code execution first
  (Settings > Capabilities > "Code execution and file creation"). Zip the
  `skills/patent-drawing` folder so the zip contains the folder itself as
  its root (`patent-drawing/SKILL.md`, not loose files). Then go to
  **Customize > Skills**, click **+**, choose **Create skill** > **Upload a
  skill**, and upload the zip. Toggle the skill on.
* **Claude Code.** Copy the `skills/patent-drawing` folder into
  `~/.claude/skills/` to use it in every project, or into
  `<project>/.claude/skills/` for one project. No restart needed if the
  skills directory already existed.
* **As a plugin (Claude Code or Devin).** Install the whole `patent-tools`
  repo — its plugin manifest loads this skill and the Patent Connector MCP
  server together.

## Prerequisites

* Python 3.9 or newer where Claude runs code.
* **No installs needed for checking.** `scripts/check_drawing.py`,
  `scripts/check_numerals.py` and `scripts/brief_description.py` run on the
  Python standard library alone, even where `pip install` is unavailable
  (such as some Claude.ai environments): svgelements is bundled in
  `scripts/vendor/` (MIT license, see NOTICE) and an installed copy is used
  instead when present.
* **Only the PDF builder needs packages:**
  ```
  pip install -r scripts/requirements.txt
  ```
  (svglib and reportlab; pymupdf is optional and adds PDF verification and
  PNG previews; svgelements is listed but optional). If svglib or reportlab
  cannot be installed, `build_pdf.py` uses cairosvg when it and the Cairo
  library are present; otherwise the PDF is marked NOT BUILT and the SVG
  sheets are still delivered and checked.
* Optional: the **Patent Connector (USPTO)** extension, so Claude can pull
  your filed claims and specification by application number.

## Inputs

You provide: patent type, what each figure must show, and ideally your
claims and written description. Claude asks for anything missing before it
draws.

## Workflow

1. Clarify inputs and pick a mode (utility, design, plant, international).
2. Load the matching rule files.
3. Draft each sheet as millimetre accurate SVG from a template.
4. Run `scripts/check_drawing.py` and fix every failure; review previews by eye.
5. If your written description or claims are available (.txt, .md or
   .docx), run `scripts/check_numerals.py` to cross check numerals and FIG
   references between the drawings and the text.
6. Run `scripts/build_pdf.py` to add sheet numbers, embed fonts and build the PDF.
7. Deliver SVGs, PDF and a fixed format summary (figures, numerals, claim
   coverage, check results, assumptions, a draft Brief Description of the
   Drawings made with `scripts/brief_description.py`, open items).

## Outputs

`fig-1.svg`, `fig-2.svg` ..., `drawings.pdf`, and a summary in the format in
`references/output-contract.md`, including a draft "BRIEF DESCRIPTION OF
THE DRAWINGS" (one sentence per figure) for your attorney to review.

## Limitations

* The search side of USPTO data (via the Patent Connector) covers titles and
  bibliographic fields, not full claim text.
* The numeral comparison is text based and heuristic: `check_numerals.py`
  matches numbers and FIG references between drawings and specification, not
  what each numeral names (limits in `references/compliance-checklist.md`).
  Whether lead lines cross, or whether a claim step is truly shown, still
  needs review by eye.
* Not suitable for filing quality design patent shading, true mechanical
  drafting, or plant photographs.
* Rules and fees change. The reference files state the rules as understood
  at version 1.2.0.

## Safety and privacy

* Inventions are treated as confidential. Claude will not send invention
  details to web search or outside tools without your explicit OK.
* Claude does not invent claim steps or parts; anything it had to assume is
  listed for you to confirm.
* No new matter is added to filed applications; post filing fixes are form
  only, on Replacement Sheets.
* The scripts run locally, make no network calls, run no shell commands,
  and collect no data.
* SVGs with DOCTYPE or ENTITY declarations, scripts, images or links to
  other files are refused before parsing. See SECURITY.md to report a
  security problem.

## Examples

* `examples/fig-1-software-method.svg`: input validation method flowchart.
* `examples/fig-1-claim-flowchart.svg`: flowchart drawn from a four step claim.
* `examples/ui-screen/`, `examples/two-sheet-flowchart/`,
  `examples/two-figures-one-sheet/`, `examples/sideways-sheet/`: a UI screen,
  a flowchart continued over two sheets, two figures on one sheet, and a
  sideways sheet. With the claim flowchart they form one sequential six
  sheet set: `examples/example-set.pdf`.
* `examples/conversations.md`: expected behavior for clear, ambiguous,
  refused, conflicting, failing and changing requests, including the draft
  Brief Description of the Drawings.
* `tests/fixtures/numerals/`: a specification that matches the six sheet
  example set (`spec-match.md`) and one that does not (`spec-mismatch.txt`,
  `.docx`). Try:
  `python scripts/check_numerals.py --spec tests/fixtures/numerals/spec-match.md examples/fig-1-claim-flowchart.svg examples/*/fig-*.svg`
* `tests/fixtures/a4/`: an upright and a sideways A4 sheet drawn at the
  documented limits.

## Testing

```
python tests/run_script_tests.py
```

runs the automated script tests (checker, numeral checker, brief
description, PDF builder, A4 sheets, and a standard library only run in a
bare virtual environment that the runner creates for itself). Run it from the
skill folder after installing to check the install; the PDF tests need the
packages above. `tests/TEST_SUITE.md` holds the prompt tests and scoring
matrix; record each run in its results log.

## Repository layout

```
SKILL.md                 Skill instructions (lean)
references/              Rules, checklists, contracts, error handling
scripts/                 check_drawing.py, check_numerals.py,
                         brief_description.py, build_pdf.py, requirements.txt,
                         vendor/ (bundled svgelements)
assets/                  Blank sheet templates, granted reference drawings
examples/                Passing example figures, example conversations
tests/                   Test suite, fixtures, script test runner
CHANGELOG.md             Version history
SECURITY.md              Security notes and how to report a vulnerability
LICENSE                  Apache License 2.0
NOTICE                   Copyright and third party notices
```

## License

Copyright 2026 Kevin Ringler. Licensed under the Apache License, Version
2.0; see LICENSE and NOTICE. The reference drawings are public domain U.S.
patent publications. The bundled copy of svgelements in `scripts/vendor/`
is third party code under the MIT License (see its LICENSE file and NOTICE).

## Support

Open an issue on this project's repository.
