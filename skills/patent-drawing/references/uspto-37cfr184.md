# 37 CFR 1.84 — Patent Drawing Formatting Rules

Reference for generating/checking patent drawing figures. Consult this file
whenever drafting or reviewing a figure.

## Sheet size and margins

Source: 37 CFR 1.84(f)–(g).

- Two accepted sheet sizes only:
  - A4: 21.0 cm × 29.7 cm
  - US Letter: 21.6 cm × 27.9 cm (8.5 × 11 in)
- All sheets in one application must be the same size — do not mix A4 and
  Letter. One of the shorter sides is the "top" of the sheet.
- Minimum margins (measured from sheet edge to the usable drawing area,
  called the "sight"):
  - Top: 2.5 cm (1 in)
  - Left: 2.5 cm (1 in)
  - Right: 1.5 cm (5/8 in)
  - Bottom: 1.0 cm (3/8 in)
- Resulting maximum sight (usable drawing) area:
  - A4 sheet: no greater than 17.0 cm × 26.2 cm
  - Letter sheet: no greater than 17.6 cm × 24.4 cm (6-15/16 × 9-5/8 in)
- Nothing — no figure content, numerals, page numbers, signatures, or
  frames — may appear in the margins.
- No frame/border may be drawn around the sight area itself.
- No punched binding holes anywhere on the sheet — 37 CFR 1.84(x). This trips
  up pro se filers who three-hole-punch printed sheets before scanning.
- Identifying indicia should be provided (title of the invention,
  inventor's name, and application number or docket number) on the front of
  each sheet **within the top margin** (37 CFR 1.84(c)). Together with the
  1.121(d) labels below, this is the only content allowed in a margin. In
  SVG put it in `<g id="top-margin">`, or let `build_pdf.py --indicia` add
  it.
- A sheet may be turned on its side when a figure is too wide. The top of
  the sheet then goes on the **right side**, and all words must read
  left to right when the sheet is turned that way (37 CFR 1.84(i)). In
  portrait page coordinates the text therefore runs bottom to top. The page
  itself stays a portrait A4 or Letter sheet. Recipe: see
  complex-figures.md, "Sideways sheets".
- Drawing sheets filed after the original filing date: a changed sheet is
  labeled "Replacement Sheet" in the top margin and must include every
  figure that was on the original sheet, even unchanged ones; a sheet with
  an added figure is labeled "New Sheet"; a marked up copy showing the
  changes is labeled "Annotated Sheet" (37 CFR 1.121(d)). Use
  `build_pdf.py --label`.

## Lines and shading

- Black solid lines only. No color, no grayscale gradients, no photographs.
  Exceptions: utility applications may use color or photographs only by
  granted petition (37 CFR 1.84(a)(2), (b)); design applications may use
  color without a petition; plant applications may use color without a
  petition and must when color distinguishes the variety (37 CFR 1.165(b)).
  See efiling-and-color.md, design-patent-drawings.md and
  plant-patent-drawings.md.
- Lines must be clean, uniform width unless variation is used deliberately to
  show depth or emphasis (heavier lines for cutting-plane/section lines,
  lighter for hatching).
- No freehand/sketchy lines — must render as if drafted with drafting
  instruments or equivalent software precision.
- Hatching/cross-hatching is permitted for sectional views to indicate
  solid material, using evenly spaced parallel lines — not solid fill.
- Avoid lead/leader lines crossing each other or getting lost in hatching.

## Reference numerals

Source: 37 CFR 1.84(p) (characters) and 1.84(q) (lead lines).

- Every element referenced in the written description must have a numeral
  in the drawing, and every numeral in the drawing must appear in the
  description.
- The same reference character must always refer to the same element
  across every figure it appears in. Never reuse a numeral for a different
  element, and never give one element two different numerals.
- Arabic numerals are preferred over letters or Roman numerals.
- Minimum height: 0.32 cm (1/8 in) for numbers, letters, and reference
  characters generally. This is the printed character height, not the font
  size setting. Capitals and digits in common sans fonts are about 70% of
  the font size, so set SVG `font-size` to at least 4.6 mm (5 mm is a safe
  default).
- Must NOT be enclosed in brackets, inverted commas/quotes, parentheses, or
  circles (encircling is only used where required for clarity, which is
  rare).
- Must be oriented the same direction as the view itself, so the reader
  never has to rotate the sheet to read them.
- Reference characters should be arranged to follow the profile of the
  object depicted.
- Must not cross or mingle with lines, and must not sit on top of hatched
  or shaded surfaces — if unavoidable, break the hatching where the
  character sits.
- **Lead lines** (the line connecting a numeral to the feature it labels):
  as short as practicable, must not cross each other, must terminate on
  the feature identified, and must not run in the same direction as nearby
  hatching (visually merges and confuses the reader).
- Numbering convention: no strict requirement to number in reading order,
  but common practice is to number roughly in the order elements are
  introduced in the description, often in multiples of 10 or 2 to leave
  room for later insertions (e.g., 10, 12, 14...) — not mandatory, but
  worth adopting for larger inventions.

## Figure numbering and layout

Source: 37 CFR 1.84(t) (sheets) and 1.84(u) (views).

- Sheets are numbered consecutively in Arabic numerals, starting with 1,
  placed in the middle of the top of the sheet **but not in the margin**
  (37 CFR 1.84(t)), so they sit just inside the top edge of the sight area.
  Use the format "1/3, 2/3, 3/3" (sheet number / total sheet count) so an
  examiner can confirm no sheets are missing. Sheet numbers must be at least
  0.32 cm tall and clearly separate from figure content.
  Sheet numbers are only needed when there is more than one sheet.
- Partial views that together form one complete view, on one sheet or
  several, use the same number plus a capital letter: FIG. 3A, FIG. 3B
  (37 CFR 1.84(u)). This is how a long flowchart continues onto a second
  sheet.
- Views/figures are numbered consecutively across the whole application
  (not restarting per sheet), in Arabic numerals, labeled "FIG. 1", "FIG. 2",
  etc. — the abbreviation "FIG." is required; do not use "Figure", "Fig",
  or "fig." When one object needs multiple related views, reuse the figure
  number with a letter suffix: FIG. 1A, FIG. 1B, FIG. 1C.
- Figure numbers/labels must sit within the sight area, not the margins.
- At least one figure should be suitable as the representative figure for
  the patent's front page (clear, illustrates the core invention).
- Security markings (e.g., classification stamps) are addressed separately
  under 37 CFR 1.84(v) — not relevant to typical software/architecture
  filings, but flag it if the user's invention involves classified or
  export-controlled subject matter.

## Views

- Include every view necessary for a person skilled in the art to understand
  the invention without ambiguity.
- For software/architecture inventions: flowcharts and block/system diagrams
  are explicitly accepted as patent drawings (confirmed by USPTO guidance
  interpreting MPEP § 608.02). Conventions:
  - Each step/process block gets a reference numeral AND a brief functional
    label inside or beside the block.
  - Standard flowchart symbols: rectangles for process steps, diamonds for
    decision points, arrows for flow/sequence.
  - The flowchart must show the full sequence of operations, decision
    points, and data flow — not just a high-level summary.
  - Data structures can be shown as tables or diagrams alongside the flow.
  - All text in the flowchart must be in English — a flowchart originally
    drafted in another language and marked up with English text afterward
    can itself trigger an objection (37 CFR 1.84(o)/(p)(2), 1.52(d)).
  - Keep flowchart text terse — the "no excessive text" rule (1.84(o)) means
    dense paragraph-length labels inside boxes are a rejection risk; put
    detail in the written description instead and keep the block label to a
    few words.
- For mechanical inventions: multiple orthographic views (front, side, top,
  perspective, exploded) as needed — not covered in depth by this skill by
  default; flag to the user if the invention needs true mechanical drafting
  rather than diagrammatic figures.

## Prohibited elements

- No color in utility drawings (absent a granted petition; design and plant
  applications are the exceptions noted above).
- No photographs in utility drawings (absent a granted petition).
- No decorative elements, gradients, artistic shading, or 3D-rendered
  surfaces.
- No extraneous text beyond reference numerals, figure labels, and (for
  flowcharts) brief functional labels inside blocks.

## Common rejection triggers to actively check for

- Margin violations (content touching or crossing the minimum margin lines).
- Reference numeral used for two different elements, or one element given
  two different numerals across figures.
- Numerals below the 1/8 in minimum height.
- Any color or shading that isn't standard sectional hatching.
- Numerals/text in the drawing that don't appear anywhere in the written
  description (or vice versa).
- Inconsistent arrow/line style within what should be one visual convention.
