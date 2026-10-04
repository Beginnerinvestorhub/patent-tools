# Pre-Delivery Compliance Checklist

Run every figure through this list before delivering. Report every item as
Pass/Fail to the user — do not silently fix and hide failures found along
the way, since the user should know what was close to a violation.

**Automated first.** Run `python scripts/check_drawing.py` on the whole set.
It covers the items marked (auto) below. Everything else needs a visual
review of the rendered previews from `scripts/build_pdf.py --preview`.

## Sheet-level

- [ ] (auto) Sheet is A4 or US Letter, and matches the size used on every other
      sheet in the set
- [ ] (auto) Top margin ≥ 2.5 cm / 1 in, no content in margin
- [ ] (auto) Left margin ≥ 2.5 cm / 1 in, no content in margin
- [ ] (auto) Right margin ≥ 1.5 cm / 5/8 in, no content in margin
- [ ] (auto) Bottom margin ≥ 1.0 cm / 3/8 in, no content in margin
- [ ] No frame/border drawn around the sight (usable) area
- [ ] No punched binding holes anywhere on the sheet
- [ ] (auto) Only identifying indicia and Replacement / New / Annotated Sheet
      labels in the top margin, in `<g id="top-margin">`
- [ ] Replacement sheets include every figure from the original sheet and
      keep their original sheet number
- [ ] Sheet number present as "N/Total" (e.g., "1/3") at the middle of the top
      of the sheet but NOT in the margin, i.e. just inside the top of the sight
      area (37 CFR 1.84(t)); only when the set has more than one sheet.
      `build_pdf.py` adds these; the checker keeps that band clear (auto).

## Figure-level

- [ ] (auto) Figure labeled "FIG. N" (Arabic numeral, sub-letters only for sub-views)
- [ ] (auto) Figure numbers are sequential with no gaps or duplicates across the set
- [ ] (auto) All lines solid black, no color, no grey, no opacity
- [ ] No gradient/photorealistic shading; hatching (if any) is evenly spaced
      parallel lines, not solid fill
- [ ] Line weight is consistent and clean (no sketchy/freehand appearance)

## Reference numerals

- [ ] Every element that needs identification has a numeral
- [ ] No numeral is reused for two different elements anywhere in the set
- [ ] No element has two different numerals across figures
- [ ] (auto) All numerals and text ≥ 0.32 cm / 1/8 in tall. Note this is
      character height: in SVG use font-size ≥ 4.6 mm, because a 3.2 mm
      font size produces capitals only about 2.3 mm tall
- [ ] (auto) No text touches or crosses a line (labels fit inside their
      boxes, lead lines start clear of their numerals)
- [ ] Numerals are legible — not overlapping lines or placed inside hatching
- [ ] Numerals are not enclosed in brackets, quotes, parentheses, or circles
- [ ] (auto) Text reads left to right with the sheet upright, or on a sheet
      marked landscape, left to right with the sheet turned so its top is on
      the right (37 CFR 1.84(i))
- [ ] Lead lines are short, don't cross each other, and terminate on the
      feature they identify
- [ ] All text (including flowchart block labels) is in English
- [ ] (auto, check_numerals.py) Every numeral used in the drawings appears in
      the written description (ask the user for the spec text if not already
      provided, and check)
- [ ] (auto, check_numerals.py) Every numeral used in the written description
      that refers to a drawn element appears in the drawings (the script
      warns on spec numerals not drawn; confirm each is intentional)

## Content and enablement (see also content-and-enablement.md)

- [ ] No decorative/extraneous elements beyond numerals, figure labels, and
      (for flowcharts) short functional text inside blocks
- [ ] Arrow/connector style is consistent throughout the figure and across
      the figure set
- [ ] At least one figure is suitable as the representative front-page figure
- [ ] Every feature specified in the claims appears in at least one figure
- [ ] Conventional features (if any) are shown as symbols or labeled boxes
      where detailed illustration is unnecessary
- [ ] For software method claims, flowchart steps align with claim steps
- [ ] Design-specific: adequate surface shading and correct broken-line use
      (if design patent)
- [ ] Plant-specific: distinctive characteristics shown; color sets prepared
      if color is distinguishing (if plant patent)
- [ ] Multi-jurisdiction: A4 preferred, minimal text, pure black lines if
      PCT/EPO filing is possible

## PDF (when delivering a filing set)

- [ ] (auto, build_pdf.py) One PDF, every page exactly 8.5 x 11 in or A4
- [ ] (auto, build_pdf.py) All fonts embedded
- [ ] Previews viewed page by page; no overlaps or clipped content

## Report format to the user

For each figure, report:

```
FIG. N — <short description>
  Sheet/margins: PASS/FAIL (detail if FAIL)
  Line/shading:  PASS/FAIL
  Reference numerals: PASS/FAIL (list any conflicts found)
  Content:       PASS/FAIL
```

If everything passes, say so plainly and note this is still not a substitute
for a final human/attorney review before filing.
