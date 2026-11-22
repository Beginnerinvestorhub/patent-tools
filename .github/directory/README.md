# Patent Tools (directory edition)

Draft and check USPTO patent drawings with Claude. The Patent Drawing
skill drafts figures under 37 CFR 1.84 (software flowcharts, block
diagrams, network and architecture figures and UI screens) and gives rule
guidance for design, plant and PCT/EPO drawings.

> This is a drafting tool, not legal advice. Have a registered patent
> attorney or agent review the drawings before you file.

## What this edition does

* Asks for what it needs (patent type, figure list, claims, sheet size),
  then draws each sheet as an SVG file in millimetres.
* Checks every sheet against the drawing rules: sheet size, margins, text
  height, black lines only, text clear of lines, FIG label order and
  reference numerals. Claude checks these from each file's source, and the
  summary reports them as a self-check.
* Compares reference numerals and FIG labels with your specification or
  claims when you provide them.
* Ends with a summary: figures, numerals, claim coverage, assumptions to
  confirm, and a draft Brief Description of the Drawings for your attorney.

## What it leaves to you

This edition contains Markdown and images only. It runs no programs and
connects to no service. That means:

* **The filing PDF.** Combine the SVG sheets into one PDF: one page per
  sheet, each page exactly US Letter or A4 with no scaling, and every font
  embedded. Then check the page size and fonts in the result.
* **USPTO lookups.** Paste your claims and description into the
  conversation. The skill doesn't search or fetch patents.

The [full Patent Tools project](https://github.com/Beginnerinvestorhub/patent-tools)
adds an automated checker, a PDF builder and live USPTO search. You install
it separately from its own repository.

## Example prompts

* "Draw FIG. 1 for my application as a block diagram that meets 37 CFR 1.84."
* "Make a formal flowchart for claim 1: (a) receiving sensor data; (b)
  filtering the data with a threshold; (c) generating an alert when the
  filtered value exceeds a limit."
* "Check these figures against my specification."

## License

Apache 2.0. See [LICENSE](LICENSE) and
[NOTICE](skills/patent-drawing/NOTICE). Privacy:
[PRIVACY.md](PRIVACY.md).
