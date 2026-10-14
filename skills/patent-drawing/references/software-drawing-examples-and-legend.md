# Real Software Patent Drawing Examples + Shape Legend

## Official free sources for real patent drawings

All U.S. patents and published applications are free to view and download:

- **Google Patents**: https://patents.google.com  
  Search by patent number, download PDF (includes full-resolution drawings).
- **USPTO Patent Public Search**: https://ppubs.uspto.gov/pubwebapp/  
- **USPTO Patent Center** (for your own applications): https://patentcenter.uspto.gov

### Recommended real examples (software / method patents)

| Patent | Title / Notes | Why useful | Link / Local Reference |
|--------|---------------|------------|------------------------|
| US 6,285,999 | Method for node ranking in a linked database (PageRank) | Pure software algorithm; node and link graphs | [Google Patents](https://patents.google.com/patent/US6285999) &bull; `assets/reference_drawings/pagerank_US6285999/` |
| US 7,669,123 | Dynamically providing a newsfeed (Facebook) | Network diagram, component block diagrams, UI screen, method flowchart | [Google Patents](https://patents.google.com/patent/US7669123) &bull; `assets/reference_drawings/newsfeed_US7669123/` |
| US 5,960,411 | Method and system for placing a purchase order via a communications network (Amazon 1-Click) | UI screens, client/server block diagram, many method flowcharts with decision diamonds | [Google Patents](https://patents.google.com/patent/US5960411) &bull; `assets/reference_drawings/one_click_US5960411/` |
| US 9,934,431 | Producing a flowchart object from an image | Meta-example of flowchart recognition; many flowchart figures | [Google Patents](https://patents.google.com/patent/US9934431) |

Download the PDF from Google Patents (“Download PDF”) or inspect the high-resolution granted drawing sheets stored locally in `assets/reference_drawings/`. Study line weight, numeral placement, FIG. labeling, and how flowcharts/block diagrams are laid out on the sheet.

These are public-domain government documents once published; you may use them for study and reference.

---

## Local Reference Drawing Library (Assets)

Granted drawing sheets from three well known software patents are stored in
`assets/reference_drawings/` as inspection benchmarks. They are public
domain US government publications.

**Important:** the line across the top of these sheets ("U.S. Patent", date,
"Sheet 3 of 11", patent number) is printed by the USPTO at publication.
Applicants never draw it. Applicant sheets carry only the "3/11" style sheet
number inside the top of the sight area.

1. **Amazon 1-Click, US 5,960,411** (`one_click_US5960411/`, 11 sheets)
   | File | Shows |
   |---|---|
   | page-1 to page-3 | FIG. 1A to 1C: web page screens as line art; screen regions grouped with braces and numerals 101 to 108 (103a to 103d for sub parts) |
   | page-4 | FIG. 2: client/server block diagram (server 210 with databases 214 to 216, client 220, network link 230); sheet turned sideways |
   | page-5 | FIG. 3: simple linear flowchart, steps 301 to 304, rounded start and end |
   | page-6 | FIG. 4: flowchart with one decision diamond (402) and Y/N exits |
   | page-7 | FIG. 5: two parallel branches with nested decisions, steps 501 to 508 |
   | page-8 | FIG. 6: chained decisions, steps 601 to 605 |
   | page-9 | FIG. 7: loops back to earlier steps, steps 701 to 706 |
   | page-10, page-11 | FIG. 8A to 8C: form style UI screens |

2. **Facebook News Feed, US 7,669,123** (`newsfeed_US7669123/`, 6 images)
   | File | Shows |
   |---|---|
   | D00000 | Front page representative figure (a copy of FIG. 5 chosen for the cover) |
   | D00001 | FIG. 1: network environment; users 101, devices 102, network 104 drawn as a simple cloud, servers 106 and 110 |
   | D00002 | FIG. 2: component block diagram inside provider 106 (202 to 212); sheet turned sideways |
   | D00003 | FIG. 3: component block diagram inside engine 110 (302 to 314); sheet turned sideways |
   | D00004 | FIG. 4: UI screen (feed items 402 to 408); note it includes simplified photo content, which is acceptable as line art but keep your own UI figures simpler |
   | D00005 | FIG. 5: linear method flowchart, steps 502 to 512, START and END ovals |

   Style notes: numerals here are written *inside* boxes and underlined,
   and outside numerals use short wavy lead lines. Both are accepted
   conventions; pick one style and use it consistently across the set.

3. **Google PageRank, US 6,285,999** (`pagerank_US6285999/`, 2 sheets)
   | File | Shows |
   |---|---|
   | page-3 | FIG. 1: three documents with links (node and link graph) |
   | page-4 | FIG. 2: the same graph with rank weights on nodes and links |

   FIG. 3 (the method flowchart, sheet 3 of 3) is not included; download it
   from Google Patents if needed.

### Inspection Criteria Demonstrated by Real References
- **Line Weight**: Uniform solid black lines (~0.5 mm / 1.5&ndash;2.0 pt), completely free of gray anti-aliasing or sketch artifacts.
- **Reference Numerals**: At least 3.2 mm tall (0.32 cm; in SVG use font-size 4.6 mm or more), unadorned (never circled or bracketed), oriented in the same direction as the view.
- **Lead Lines**: Non-crossing solid lines terminating directly at the referenced component boundary.
- **Terse Phrasing**: Flowchart steps use active verbs (*"Send Request"*, *"Authenticate User"*, *"Calculate Score"*); detailed prose is reserved for the written specification.
- **Page Layout**: Clear margins on all 4 sides (top 2.5 cm, left 2.5 cm, right 1.5 cm, bottom 1.0 cm minimum) with no outer border box framing the sheet.

---

## Shape legend for software patent drawings

Patent offices do not mandate a single rigid symbol set, but the following conventions are widely accepted and produce clear, examiner-friendly figures. Keep labels short; put detail in the written description.

### Flowchart symbols (most common)

| Shape | Typical meaning in patent drawings | Notes |
|-------|------------------------------------|-------|
| **Oval / Rounded rectangle** | Start or End of the process | Often labeled “Start” / “End” or simply the entry/exit point |
| **Rectangle** | Process / action / step | Most common. Short functional label inside (e.g., “Validate input”, “Store result”) |
| **Diamond** | Decision / conditional branch | Usually yes/no or true/false exits. Label the condition briefly |
| **Parallelogram** | Input or Output operation | Data coming in or going out (less common than plain rectangles, but still used) |
| **Rectangle with double vertical lines** (or similar) | Predefined process / subroutine / function call | Indicates a call to another flowchart or module |
| **Arrow / directed line** | Flow / sequence / control transfer | Solid arrows for normal flow; dashed sometimes used for alternative or error paths |
| **Circle or connector** | On-page or off-page connector | Used when a flowchart spans multiple sheets or needs to jump |

### Block / architecture diagram symbols

| Shape | Typical meaning | Notes |
|-------|-----------------|-------|
| **Rectangle (hollow)** | Functional module, component, server, client, database, processor, memory, etc. | Label with short name + reference numeral (e.g., “Server 110”) |
| **Cylinder or database icon** (optional) | Data store / database | Many patents simply use a labeled rectangle; specialized icons are acceptable if line-art clean |
| **Cloud or network cloud** (simple line version) | Network / internet / communication medium | Keep extremely simple; avoid decorative detail |
| **Directed arrows** | Data flow, control flow, or communication | Label the type of flow if helpful (e.g., “request”, “response”) |
| **Stacked rectangles** | Multiple similar instances or layers | Common for multi-tier architecture |

### General rules that apply to all shapes

- All lines must be solid black, uniform weight, clean (no gray anti-aliasing).
- Reference numerals (≥ 0.32 cm) are required for every significant element and must match the specification.
- Text inside shapes must be short English functional labels; dense paragraphs are rejected.
- Prefer consistent symbol usage across the entire figure set.
- For PCT/EPO filings keep text to the absolute minimum (indispensable catchwords only).

### Recommended figure set for a typical software utility application

1. System / network environment (block diagram)
2. Computing device / server that executes the code (block diagram)
3. High-level method flowchart matching the broadest independent claim
4. One or more detailed or alternative flowcharts
5. Optional: data-structure diagram, state diagram, or UI screens if claimed or needed for enablement

Study the real patents listed above to see how these conventions look in granted USPTO drawings.
