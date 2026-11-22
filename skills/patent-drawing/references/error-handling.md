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
| User asks for the PDF | This edition cannot build it. Deliver the SVG sheets and the PDF requirements from SKILL.md step 5. Never install software or download tools to build it. |
| No way to render the SVGs here | Do the self-check from the source, say the rendered review was NOT DONE, and ask the user to open each sheet and look for crowding and crossing lead lines. |
| No specification provided | Skip the numeral comparison. Summary shows `Numerals vs spec: NOT CHECKED (no specification provided)`. |
| Numeral comparison finds a FAIL | Show each FAIL to the user (numeral drawn but never described, figure drawn but never mentioned, figure mentioned but not drawn) and ask which side is right (drawing or specification). Never renumber or rename to force a match, and never edit the user's specification. |
| Numeral comparison finds only warnings | Spec numerals no drawing shows. List them and ask the user to confirm each was meant to stay undrawn; the summary shows MATCHED with warnings. |
| Specification is in a format you cannot read here | Ask the user to paste the text. |
| Self-check finds a FAIL | Fix and recheck. Report every failure found, including ones fixed, in the summary. |
| A FAIL cannot be fixed without changing what the figure shows | Stop and ask the user which content to change. |
| User asks to look up a patent or application | This edition has no USPTO tools. Ask the user to paste the claims or description. Never invent tool names or results. |
| Pasted document text is garbled (OCR errors) | Show the suspect passage and ask the user to confirm the wording before using it in a figure. |

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
| User adds, removes or reorders figures | Renumber FIG labels so they stay sequential, keep reference numerals stable for unchanged parts, recheck the whole set (SKILL.md step 4). |
| User changes a step or part | Edit only the affected SVGs in place. Update the same numeral everywhere it appears. Recheck the whole set. |
| User switches sheet size (Letter to A4 or back) | Rebuild every sheet on the new template (all sheets must match), recheck every sheet. |
| User switches mode (for example utility to design) | Confirm the change, then restart from Clarify for the new mode. Do not reuse utility figures as design figures. |
| After filing, user wants changes | Allowed only for form. Follow "Replacement sheets after filing" in complex-figures.md (keep every figure on the sheet, keep the sheet number, check with `--partial`, build with `--label "Replacement Sheet"`). Refuse anything that adds new matter. |
| Figure too wide for an upright sheet | First try a tighter layout or partial views; if still too wide, use a sideways sheet per complex-figures.md. |
| Flowchart too long for one sheet | Split into FIG. NA, FIG. NB with off page connector circles per complex-figures.md. |
