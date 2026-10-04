# Electronic Filing Format & Color Petition Procedure

## Electronic filing (Patent Center) drawing file requirements

Most applicants — including pro bono program filings — file electronically
through Patent Center, not on paper. Separate technical spec from the
drawing content rules above:

- **File format:** PDF with **all fonts embedded** (Patent Center rejects or
  flags PDFs with unembedded fonts). Patent Center converts submissions into
  its Image File Wrapper (IFW) system, so the PDF must be clean: no password
  protection, no embedded multimedia, no layers, forms or interactive
  content. `scripts/build_pdf.py` produces this and verifies font embedding.
- **Resolution:** minimum 300 DPI; for line drawings specifically, 600 DPI
  or higher is strongly recommended so fine lines and small reference
  numerals stay sharp after USPTO's internal processing/reduction.
- **Page size in the PDF:** must match the physical sheet sizes — A4
  (21.0 × 29.7 cm) or US Letter (21.6 × 27.9 cm). Pages submitted at any
  other size get auto-reduced to 8.5×11, which can distort figures or make
  reference numerals fall below the legal minimum height — always export at
  the correct size rather than relying on Patent Center's resize.
- **Color/black-and-white:** must be black and white unless a color
  petition (see below) has been granted — do not upload color figures
  "just in case."
- **Note on the specification vs. drawings:** as of January 17, 2024, the
  written description/claims/abstract must be filed in DOCX to avoid a
  surcharge (USPTO fee schedule as of 2025: $430 standard / $172 small
  entity / $86 micro entity; confirm current amounts). This DOCX requirement is for the specification text, not the
  drawings — drawings are still filed as PDF regardless of entity size.

## AI-generated or AI-assisted drawings

The USPTO does not prohibit AI-assisted drawing generation and does not ask
how a drawing was produced — it only checks whether the final file meets
37 CFR 1.84 (black ink, uniform line weight, correct margins, legible
numerals). In practice, raw AI or auto-generated output often needs cleanup
before it's compliant: watch specifically for gray-pixel anti-aliasing
(reads as unwanted shading), inconsistent line weight, and canvas/artboard
dimensions sized for a screen rather than a filing sheet. Vectorizing the
output and correcting the artboard to the exact sight-area dimensions (see
uspto-37cfr184.md) removes most of this risk — always run the compliance
checklist regardless of how the figure was drafted.

## Color drawings — when and how (petition procedure)

Default assumption for this skill: **no color.** Only use this section if
the user explicitly says color is essential to disclosing the invention.

- In **utility** applications, color is accepted **only** after the USPTO
  grants a petition under 37 CFR 1.84(a)(2), never by default.
- **Design** applications may use color without a petition (37 CFR
  1.84(a)(2)), and **plant** applications may too (37 CFR 1.165(b)); plant
  drawings *must* be in color when color distinguishes the variety, with two
  copies of each color drawing or photograph. The petition procedure below
  is for utility applications only.
- The petition must argue color is the **only practical medium** to
  disclose the subject matter — not merely convenient or nicer-looking.
  Historical examples that succeeded: color needed to show different data
  flow directions in a network diagram, biological/chemical subject matter,
  calibration or coating colors.
- Petition requirements (37 CFR 1.84(a)(2)):
  1. The petition itself with the required fee.
  2. One (1) set of color drawings if filed electronically, or three (3)
     sets if filed on paper.
  3. An amendment to the specification adding, as the first paragraph of
     the Brief Description of the Drawings: *"The patent or application
     file contains at least one drawing executed in color. Copies of this
     patent or patent application publication with color drawing(s) will
     be provided by the Office upon request and payment of the necessary
     fee."*
- Petition fee: 37 CFR 1.17(h). Per the USPTO fee schedule as of 2025:
  $150 large entity / $60 small entity / $30 micro entity. Fees change, so
  confirm on the current USPTO fee schedule before filing.
- The standard printed patent and publication copies are black and white;
  color copies are supplied only on request (that is what the required
  specification statement says). Write the Brief Description of the
  Drawings so each figure still makes sense to a reader of the black and
  white copy.
- Color drawings are not permitted at all in PCT/international applications
  (PCT Rule 11.13) — relevant only if the user is considering
  international filing.
- For a **continuation application**, a previously granted color petition
  does not carry over — it must be renewed in the new application.
- Design patent applications are different: color is allowed without a
  separate petition, just a specification statement — but choosing color in
  a design application also narrows the claim scope to that specific color
  scheme (MPEP 1503.02). One set of color drawings is enough when filed
  electronically; three sets on paper.
