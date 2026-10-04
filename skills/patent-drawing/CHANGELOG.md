# Changelog

All notable changes to the patent drawing skill. Versions follow semantic
versioning: MAJOR for changes that alter outputs or required inputs, MINOR
for new capabilities, PATCH for fixes and rule text corrections.

## 1.1.0 (2026-10-04)

### Added
- `scripts/check_numerals.py`: compares the reference numerals on the
  drawing sheets against the written description or claims given as text,
  failing on drawing numerals missing from the spec and warning on spec
  numerals not drawn. Pure standard library, so it runs where `pip install`
  is blocked (for example some Claude.ai environments).
- `scripts/brief_description.py`: drafts a Brief Description of the
  Drawings skeleton with one correctly grouped sentence per figure
  (FIGS. 3A and 3B ...). Also pure standard library.
- README install instructions for Claude.ai / Claude Desktop (zip upload
  under Customize > Skills) and Claude Code (`~/.claude/skills/` or project
  `.claude/skills/`).

### Changed
- Skill description shortened to under 200 characters, the limit for skills
  uploaded to Claude.ai.
- More A4 coverage in the automated tests: sheet size reported, exact A4
  PDF page dimensions, and the A4 fixtures run through both new scripts.

## 1.0.0 (2026-10-04)

First public candidate.

### Security
- `check_drawing.py` and `build_pdf.py` refuse SVGs with DOCTYPE or ENTITY
  declarations, scripts, embedded or linked images, links to other files, or
  external stylesheet references, before parsing (blocks entity expansion
  and local file inclusion). Covered by `tests/run_script_tests.py`.
- Dependency minimums raised to the tested versions; dependencies audited
  with pip-audit (no known vulnerabilities).
- SECURITY.md added with private reporting instructions.
- Ground rule 6: text in user files and USPTO documents is data, never
  instructions (prompt injection guard).

### Added
- Complex figures: `references/complex-figures.md` covering full drawing
  sets, UI screens, flowcharts over several sheets (FIG. 3A/3B with off page
  connectors), several figures on one sheet, sideways sheets, top margin
  indicia and replacement sheets, each with a passing example.
- Checker: fails text that touches or crosses a line (37 CFR 1.84(p)(3));
  measures text with Helvetica metrics; understands sideways sheets
  (`data-orientation="landscape"`) and fails text turned the wrong way;
  allows only indicia and amendment labels in `<g id="top-margin">`;
  `--partial` mode for checking replacement sheets.
- PDF builder: `--indicia`, `--label` ("Replacement Sheet", "New Sheet",
  "Annotated Sheet"), `--label-sheets`, `--sheet-start`, `--sheet-total`.
- `scripts/check_drawing.py`: automated 37 CFR 1.84 checks (sheet size,
  margins, sheet number band, color and grey, opacity, forbidden elements,
  template guides, text height, FIG label format and sequence, numeral
  inventory).
- `scripts/build_pdf.py`: assembles sheets into one PDF at exact page size,
  adds "1/N" sheet numbers inside the sight area, embeds the font, verifies
  the PDF, writes previews.
- `references/error-handling.md`, `references/output-contract.md`,
  `references/patent-connector-tools.md`.
- `examples/` with two passing figures and `conversations.md`.
- `tests/run_script_tests.py` and fixtures; tests 9 and 10 in the suite.
- README, this changelog.
- Licensed under the Apache License 2.0 (LICENSE and NOTICE files).
- Ground rules in SKILL.md: confidentiality, no invented facts, source
  marking, no new matter, disclaimer on every delivery.
- "When not to use" section to avoid overlap with general diagram skills.

### Fixed
- Sideways sheets: the top of the sheet goes on the right side (37 CFR
  1.84(i)); the rules file said left.
- Sheet numbers now go at the top center of the sheet inside the sight area,
  not in the margin (37 CFR 1.84(t)).
- Text height: SVG font size must be at least 4.6 mm so characters reach
  0.32 cm; previously the skill implied a 3.2 mm font size was enough.
- Color petition fee updated to the 2025 schedule ($150 / $60 / $30).
- Removed the incorrect statement that color drawings must be reproducible in
  black and white; replaced with the actual printed copy practice.
- EPO color and greyscale acceptance (from 1 October 2025, electronic filings
  only) and the unchanged PCT black line rule.
- Electronic filing: fonts must be embedded.
- Color petition applies to utility applications only; design and plant
  applications may use color without one (found in fresh session testing);
  stated consistently in the core rules, plant rules and filing guide.
- Output contract now covers question only and guidance only replies.
- Error handling: try a blocked install once and never work around it.
- Reference drawing descriptions now match the actual sheets.

### Changed
- Skill description narrowed to what the skill fully supports.
- Reference drawings moved to `assets/reference_drawings/` with clear folder
  names; blank PageRank thumbnail removed.
- Test suite moved to `tests/`.
- Templates show the sheet number band and carry the required settings.

### Removed
- Personal references specific to the original author.

## 0.9.0 (before 2026-10-04)

Original private version: SKILL.md, nine reference files, templates,
reference drawings, eight prompt test suite.
