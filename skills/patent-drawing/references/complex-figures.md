# Complex Figures and Full Drawing Sets

How to handle the cases beyond a single one sheet flowchart. Every recipe
here has a passing example in `examples/`, and all six examples together
form one sequential set (`examples/example-set.pdf`, FIG. 1 to FIG. 5 on 6
sheets).

## A full drawing set for a software application

A typical nonprovisional set, in this order (adjust to the claims):

| Figure | Shows | Numeral series |
|---|---|---|
| FIG. 1 | System or network environment | 100s |
| FIG. 2 | Computing device or server internals (processor, memory, storage, network interface) | 200s |
| FIG. 3 | Main method flowchart matching the broadest method claim | 300s |
| FIG. 4 | Detail flowchart, data structure or state diagram | 400s |
| FIG. 5 | User interface screen, only if UI is claimed or needed for enablement | 500s |

Rules for the set:

- One figure (or one related group like FIG. 4A and 4B) per sheet unless
  the views are small; never squeeze to the point of crowding.
- A part keeps the **same numeral on every figure** it appears in, even if
  that numeral comes from another figure's series (a server 110 shown again
  in FIG. 2 stays 110).
- Check the whole set in one run, in sheet order:
  `python scripts/check_drawing.py fig-1.svg fig-2.svg ...`
- Build once: `python scripts/build_pdf.py fig-1.svg ... -o drawings.pdf --preview previews/`
  (sheet numbers "1/5" and so on are added automatically).
- Add identifying indicia if the user wants them:
  `--indicia "Title; Inventor name; Docket or application number"`.

## User interface screens

Example: `examples/ui-screen/fig-5.svg`.

- Draw the device outline and screen as plain rectangles (rounded corners
  are fine). No photos, screenshots, logos, icons copied from real apps,
  gradients or shading.
- Show only the elements the claims or description need. Use short labels
  inside fields and buttons ("EMAIL", "SIGN IN"); real screen copy belongs
  in the specification.
- Each claimed element gets a numeral with a lead line from outside the
  device. Lead lines may cross the device and screen outlines to reach an
  element, but must not cross other lead lines or run through text.
- Groups of elements can be marked with a brace and one numeral (see the
  Amazon reference sheets, FIG. 1A to 1C).
- Text inside a UI figure still needs font size 4.6 mm or more.

## Flowcharts too long for one sheet

Example: `examples/two-sheet-flowchart/fig-3a.svg` and `fig-3b.svg`.

- Split at a natural point and label the parts with the same number plus a
  capital letter: FIG. 3A, FIG. 3B (37 CFR 1.84(u)).
- End the first part with an off page connector: a small circle with a
  capital letter ("A"). Start the next part with the same circle and letter.
  Use B, C for further breaks. The letter in a connector circle is a flow
  symbol, not a reference numeral, so the circle is allowed.
- Keep step numerals running on across the parts (302 to 310 on FIG. 3A,
  312 to 318 on FIG. 3B).
- Rough capacity: about 6 process boxes per Letter sheet at 16 mm boxes with
  10 mm arrows, fewer with decisions.

## Several figures on one sheet

Example: `examples/two-figures-one-sheet/fig-4.svg` (FIG. 4A and FIG. 4B).

- Allowed when the views are small and clearly separated (37 CFR 1.84(h)).
- Every view gets its own label, all views stand the same way up, and
  there is clear space between them so no numeral could be read as
  belonging to the other view.
- The checker lists every FIG label it finds on the sheet and checks the
  whole set's sequence.

## Sideways sheets

Example: `examples/sideways-sheet/fig-2.svg`.

Use only when a figure is too wide for an upright sheet. Under 37 CFR
1.84(i) the top of the sheet goes on the **right side**, and every word
must read left to right when the sheet is turned that way.

Recipe (US Letter, 216 x 279 mm):

1. Add `data-orientation="landscape"` to the `<svg>` element.
2. Wrap the whole figure in
   `<g transform="matrix(0 -1 1 0 0 279)"> ... </g>`
   (for A4 use `matrix(0 -1 1 0 0 297)`).
3. Inside the group, draw in turned coordinates as if the page were
   landscape: usable area x 10 to 245, y 25 to 201 (A4: x 10 to 263,
   y 25 to 195). Keep x above 245 (A4: 263) empty; that strip is the sheet
   number band once turned.
4. All text goes inside the group so it turns with the figure. Do not add a
   rotate() of your own.

The checker fails any text on a landscape sheet that is not turned this
way, and any rotated text on an upright sheet.

## Top margin text: indicia and amendment labels

The top margin may hold only:

- identifying indicia (37 CFR 1.84(c)), and
- "Replacement Sheet", "New Sheet" or "Annotated Sheet" (37 CFR 1.121(d)).

Let `build_pdf.py` add them so placement and size are always right:

```bash
# indicia on every sheet
python scripts/build_pdf.py fig-*.svg -o drawings.pdf --indicia "Title; Inventor; Docket 123"
# corrected sheet 2 of a 5 sheet set, after filing
python scripts/build_pdf.py fig-2.svg -o replacement.pdf --label "Replacement Sheet" --sheet-start 2 --sheet-total 5
```

If you write them into the SVG yourself, put plain black text (font size
4.6 mm or more, no transforms) inside `<g id="top-margin">` entirely within
y 0 to 25 mm. Anything else in a margin fails the checker.

## Replacement sheets after filing

1. Confirm the change is form only (no new matter). If unsure, ask.
2. Edit the original SVG in place. A replacement sheet must contain every
   figure that was on the original sheet, changed or not.
3. A replacement sheet keeps its place in the set, so its sheet number must
   stay the same ("2/5"). Build it with `--sheet-start 2 --sheet-total 5`.
4. Check just the changed sheets with `--partial`, which skips the "figures
   must start at FIG. 1" rule:
   `python scripts/check_drawing.py --partial fig-2.svg`
5. Build with `--label "Replacement Sheet"` (or, when rebuilding the whole
   set, add `--label-sheets 2` so only the changed sheet is labeled; label
   sheet numbers refer to positions in the set).
6. If the user's attorney wants a marked up copy, make a separate copy
   labeled "Annotated Sheet" showing the changes.
