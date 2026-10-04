# Error Handling

What to do when something is missing, fails or conflicts. The rule
underneath every row: tell the user plainly what happened, never report a
check as passed if it did not run, and never fill a gap by guessing.

## Missing information

| Situation | Do this |
|---|---|
| Request is bare ("draw my invention") | Do not draw. Ask in one message: patent type, what it does, the figure list, claims if any, informal or formal, foreign filing. |
| No claims available | Ask once. If the user has none yet, draft from their description and state that figures must be rechecked when claims are written. |
| Figure list missing | Propose the standard software set (environment, device, main method flowchart, detail flowchart, optional UI) and ask the user to confirm or edit before drawing. |
| A step or part is vague ("it processes stuff") | Ask what the step does. If the user wants a draft anyway, use their exact words in the box and list it under Assumptions. |
| No written description | Proceed. Summary must say numerals are not yet matched to a specification. |
| Patent type unclear | Ask. Do not default to design or plant mode without a clear signal. |

## Tools and environment

| Situation | Do this |
|---|---|
| Python not available | Say so. Deliver SVG sheets only, run the manual checklist by hand, and mark every automated item as NOT RUN in the summary. Do not claim PASS. |
| `pip install` fails (no network, permissions, index blocked) | Try the documented command once. Do not work around the failure (no bootstrapping pip, alternate indexes, downloading wheels or editing config). Show the error in one line, give the install command for the user to run, deliver SVGs, mark checks NOT RUN. |
| `svgelements` missing | `check_drawing.py` exits with an install hint. Treat as NOT RUN, as above. |
| `svglib` or `reportlab` missing | `build_pdf.py` exits with an install hint. Deliver SVGs; PDF is NOT BUILT. |
| `pymupdf` missing | PDF still builds; verification and previews are skipped. Say "PDF built, font embedding and page size not verified, previews not generated" and do the visual review from the SVGs instead. |
| No TrueType font found | Ask the user for a font path (`--font`). Do not build with an unembedded font. |
| Checker reports FAIL | Fix and rerun. Report every failure found, including ones fixed, in the summary. |
| Checker FAIL cannot be fixed without changing what the figure shows | Stop and ask the user which content to change. |
| Patent Connector tools not installed | Ask the user to paste the claims. Never invent tool names or arguments. |
| Patent Connector returns an error (bad key, rate limit, not found) | Repeat the tool's plain English message to the user and ask how to proceed; offer to continue with pasted text. |
| Fetched document text is garbled (OCR errors) | Show the suspect passage and ask the user to confirm the wording before using it in a figure. |

## Conflicts

| Situation | Do this |
|---|---|
| Claim steps and the written description disagree | Do not pick one silently. Show both versions side by side and ask which governs. Default suggestion: the claims. |
| User supplied numerals clash (same numeral, two parts; or one part, two numerals) | List each clash and ask which to keep. |
| User asks for something the rules forbid (color, shading, text paragraphs in boxes) | Explain the rule in one or two sentences, offer the compliant version. Color only with a granted petition (utility) or design or plant rules. |
| User asks to skip the checks "just this once" | Deliver, but mark the summary NOT CHECKED and say the drawings may draw an objection. |
| Reference sheet conventions conflict with the rules (for example underlined numerals inside boxes) | Both are acceptable conventions; pick one and use it across the whole set. |

## Unsupported requests

| Request | Reply |
|---|---|
| Plant drawings (photos or color artwork) | Explain what plant drawings need and that the user must supply photographs or artwork; offer to check sheet format and layout. |
| Full design patent views of a real product | Explain the view and shading requirements; offer simple line views for discussion and recommend a professional illustrator or CAD for filing. |
| True mechanical drafting (orthographic, exploded, sections) | Offer schematic level line diagrams and recommend CAD or a drafter for filing quality views. |
| Converting a raster image directly into the filing | Refuse to file pixels; redraw as vector line art. |

## Changes midway

| Situation | Do this |
|---|---|
| User adds, removes or reorders figures | Renumber FIG labels so they stay sequential, keep reference numerals stable for unchanged parts, rerun the checker on the whole set. |
| User changes a step or part | Edit only the affected SVGs in place. Update the same numeral everywhere it appears. Rerun the checker on the whole set. |
| User switches sheet size (Letter to A4 or back) | Rebuild every sheet on the new template (all sheets must match), rerun the checker. |
| User switches mode (for example utility to design) | Confirm the change, then restart from Clarify for the new mode. Do not reuse utility figures as design figures. |
| After filing, user wants changes | Allowed only for form. Follow "Replacement sheets after filing" in complex-figures.md (keep every figure on the sheet, keep the sheet number, check with `--partial`, build with `--label "Replacement Sheet"`). Refuse anything that adds new matter. |
| Figure too wide for an upright sheet | First try a tighter layout or partial views; if still too wide, use a sideways sheet per complex-figures.md. |
| Flowchart too long for one sheet | Split into FIG. NA, FIG. NB with off page connector circles per complex-figures.md. |
