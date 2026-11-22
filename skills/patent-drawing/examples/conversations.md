# Example Conversations

Expected behavior for common situations. Replies are shortened; the shape and
decisions are what matter.

## 1. Clear request (success)

**User:** Make a formal USPTO flowchart for my claim: 1. A method comprising
(a) receiving sensor data; (b) filtering the data with a threshold;
(c) generating an alert when the filtered value exceeds a limit;
(d) transmitting the alert to a remote device.

**Expected:** No questions needed beyond sheet size (default US Letter).
Draws one sheet: START, 102 RECEIVE SENSOR DATA, 104 FILTER WITH THRESHOLD,
106 decision VALUE > LIMIT? (NO loops back to 102), 108 GENERATE ALERT,
110 TRANSMIT ALERT, END, FIG. 1. Self-checks the sheet from its SVG source,
writes the brief description line, then replies with the output contract
summary, including:

```
Claim coverage
  Claim 1, step (a) → FIG. 1, 102
  Claim 1, step (b) → FIG. 1, 104
  Claim 1, step (c) → FIG. 1, 106 and 108
  Claim 1, step (d) → FIG. 1, 110
Checks
  Numerals vs spec:    NOT CHECKED (no specification provided)
Assumptions (please confirm)
  NO branch of 106 returns to 102 (claim does not say what happens below the limit)
BRIEF DESCRIPTION OF THE DRAWINGS (draft for your attorney to review)
  FIG. 1 is a flowchart of a method of generating an alert from sensor data.
```

For a set with partial views the line groups them and reads, for example, "FIGS. 3A and 3B together are a flowchart of
an order fulfillment method." Lettered views that show different things
(FIG. 4A a record, FIG. 4B session states) are split into one sentence each.

Result file: the claim flowchart in `examples/svg-examples.md`.

## 2. Ambiguous request

**User:** Draw my invention.

**Expected:** Draws nothing yet. One message asking: utility, design or
plant; what the invention does in a few sentences; which figures are needed
(offers the standard software set as a proposal); claims if written;
informal or formal; any plan to file outside the US.

## 3. Forbidden style (refuse and redirect)

**User:** Make a beautiful 3D, colorful, photorealistic patent drawing of my
widget with pink highlights.

**Expected:** "Utility patent drawings have to be flat black line art under
37 CFR 1.84. Color, shading and 3D rendering would draw an objection, and
color is only allowed with a granted petition. I can make clean black line
drawings of the widget instead. Which views do you need?" No colored or
shaded output.

## 4. Conflict between claim and description

**User:** (claims say "encrypt then store"; description says "store then
encrypt")

**Expected:** "Your claim 1 orders the steps encrypt then store, but
paragraph [0031] says store then encrypt. The flowchart has to match one of
them. Which order is correct? Usually the claims govern." Draws nothing for
that sequence until answered.

## 5. PDF requested

**User:** Give me the filing PDF too.

**Expected:** "This edition draws and checks the sheets but can't build
the PDF. Put the SVG sheets into one PDF, one page per sheet in order,
each page exactly 8.5 x 11 in with no scaling and every font embedded,
then check the page size and fonts in the result." Summary shows
`PDF: NOT BUILT (the user assembles it; see Open items)`, never PASS for
the PDF. Claude does not install or download anything to build it.

## 6. Change midway

**User:** (after FIG. 1 to FIG. 3 are done) Actually, put the system diagram
first.

**Expected:** Moves the system diagram to FIG. 1 and renumbers the others,
keeps every part's reference numeral unchanged (numerals follow parts, not
figure order, unless the user wants the series renumbered), rechecks the
whole set and reports the new order.

## 7. Plant patent (unsupported production)

**User:** Prepare drawings for my new purple rose variety.

**Expected:** Explains that plant drawings must show the distinguishing
characteristics and, since color distinguishes this variety, must be color
photographs or color artwork (two copies). States that it can't produce
those itself; offers to check the sheet format and layout of the user's
photos.

## 8. After filing, new matter

**User:** The application is filed. Add a new encryption module to FIG. 2.

**Expected:** "Adding a module that isn't in the application as filed would
be new matter, which can't be added after the filing date. I can fix form
issues on FIG. 2 as a Replacement Sheet. If the module is new, talk to your
attorney about a continuation in part or a new application."
