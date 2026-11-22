# Complex Figures and Full Drawing Sets

How to handle the cases beyond a single one sheet flowchart. Every recipe
here has a passing example in `examples/`, and all six examples together
form one sequential set (FIG. 1 to FIG. 5 on 6 sheets): the sheets in
`examples/svg-examples.md` from the claim flowchart on, in that order.

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
- Check the whole set together, in sheet order (SKILL.md, step 4), so FIG
  sequence and numerals are compared across sheets.
- Number the sheets "1/5", "2/5" and so on in the sheet number band.
- Add identifying indicia if the user wants them (see "Top margin text"
  below).

## User interface screens

Example: FIG. 5 in [svg-examples.md](../examples/svg-examples.md).

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

Example: FIG. 3A and FIG. 3B in [svg-examples.md](../examples/svg-examples.md).

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

Example: FIG. 4A and FIG. 4B in [svg-examples.md](../examples/svg-examples.md).

- Allowed when the views are small and clearly separated (37 CFR 1.84(h)).
- Every view gets its own label, all views stand the same way up, and
  there is clear space between them so no numeral could be read as
  belonging to the other view.
- List every FIG label on the sheet when checking, and check the whole
  set's sequence.

## Sideways sheets

Example: FIG. 2 in [svg-examples.md](../examples/svg-examples.md).

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

Text on a landscape sheet that is not turned this way fails, and so does
any rotated text on an upright sheet.

## Top margin text: indicia and amendment labels

The top margin may hold only:

- identifying indicia (37 CFR 1.84(c)), and
- "Replacement Sheet", "New Sheet" or "Annotated Sheet" (37 CFR 1.121(d)).

Write them into the SVG as plain black text (font size 5 mm, no
transforms), centred on the sheet, inside `<g id="top-margin">` and
entirely within y 0 to 25 mm. One line goes at baseline y 14.5; with both
a label and indicia, the label goes at y 10 and the indicia at y 19:

```xml
<g id="top-margin" font-size="5" text-anchor="middle" fill="#000000" stroke="none">
  <text x="108" y="10">Replacement Sheet</text>
  <text x="108" y="19">Title; Inventor; Docket 123</text>
</g>
```

Use x 105 on A4. A line must fit the sheet width at about 3 mm per
character. Anything else in a margin fails.

## Replacement sheets after filing

1. Confirm the change is form only (no new matter). If unsure, ask.
2. Edit the original SVG in place. A replacement sheet must contain every
   figure that was on the original sheet, changed or not.
3. A replacement sheet keeps its place in the set, so its sheet number must
   stay the same ("2/5") in its sheet number band.
4. Check just the changed sheets, skipping only the "figures must start at
   FIG. 1" rule.
5. Add "Replacement Sheet" in the top margin of each changed sheet only.
6. If the user's attorney wants a marked up copy, make a separate copy
   labeled "Annotated Sheet" showing the changes.
