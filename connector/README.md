<p align="center">
  <img src="icon-dark.png" alt="Patent Tools icon: a wall outlet with a plug, labeled FIG. 1" width="128">
</p>

# Patent Connector (USPTO)

Patent Connector gives Claude live access to the USPTO Open Data Portal (ODP). Claude can search patents and applications, pull a clean summary of any file by application number or patent number, read the actual text of claims, abstracts and specifications so it can compare them against your invention, and look at the drawing sheets as images.

It runs locally inside Claude Desktop as a desktop extension. You bring your own free USPTO API key. There are no servers in between: your key and your queries go straight from your computer to api.uspto.gov.

> This is a research tool, not legal advice. Have a registered patent attorney or agent review any search before you rely on it or file.

## Setup

1. Get a free API key: sign in at [data.uspto.gov](https://data.uspto.gov), open **My ODP**, and copy your key.
2. Download [patent-connector-1.3.1.mcpb](https://github.com/Beginnerinvestorhub/patent-tools/releases/latest/download/patent-connector-1.3.1.mcpb) from the latest release, then install it by double clicking it, or drag it into Claude Desktop under **Settings > Extensions**.
3. Paste your key when prompted. Claude Desktop saves it in the extension's settings on your computer. The extension sends it only over HTTPS to uspto.gov and never shows it to Claude. You can regenerate the key any time in My ODP.

Requires Claude Desktop with Node.js 18 or newer (bundled with Claude Desktop).

### As a plugin (Claude Code)

Installing the `patent-tools` repository as a plugin starts this server
from the single file bundle `dist/patent-connector.mjs`, so no `npm install`
is needed; Node.js 18 or newer must be on your PATH. The plugin has no
settings screen for the key; see [Set your USPTO API key](#set-your-uspto-api-key)
below. Without it the tools answer "No USPTO API key is configured".

## Set your USPTO API key

How the key reaches the connector depends on how you installed it:

* **Claude Desktop extension (`.mcpb`).** Claude Desktop asks for the key
  when you install the extension and keeps it in the extension's settings
  (Settings > Extensions > Patent Connector). You do not need an
  environment variable.
* **Plugin (Claude Code, and other hosts that read `.mcp.json` or
  `mcp_config.json`).** The plugin reads the key from the
  `USPTO_ODP_API_KEY` environment variable of the app or terminal that
  starts the host. Set it once as shown below.

Get the key first: sign in at [data.uspto.gov](https://data.uspto.gov),
open **My ODP**, and copy it.

**Windows**

1. Open Command Prompt or PowerShell and run (with your own key inside the
   quotes):

   ```
   setx USPTO_ODP_API_KEY "your_key_here"
   ```

   Or use the dialog: press Start, type "environment variables", open
   **Edit the system environment variables**, click **Environment
   Variables**, and under **User variables** click **New** with the name
   `USPTO_ODP_API_KEY` and your key as the value.
2. `setx` only affects programs started afterwards. Close every terminal
   and quit the app completely (including from the system tray), then open
   it again.

**macOS and Linux**

1. Add this line to your shell profile: `~/.zshrc` for zsh (the macOS
   default) or `~/.bashrc` for bash.

   ```
   export USPTO_ODP_API_KEY="your_key_here"
   ```
2. Open a new terminal (or run `source ~/.zshrc`), then start Claude Code
   from that terminal. Apps started from the Dock or a launcher may not read
   your shell profile; start them from a terminal if the key is not found.

**Check that it is set**

* Windows Command Prompt: `echo %USPTO_ODP_API_KEY%`
* PowerShell: `echo $env:USPTO_ODP_API_KEY`
* macOS and Linux: `echo $USPTO_ODP_API_KEY`

It should print something other than an empty line (or, on Windows, the
literal `%USPTO_ODP_API_KEY%`). Treat the key like a password: do not paste
it into chats, issues or screenshots. If it ever leaks, regenerate it in My
ODP.

**For local development** in this repository, copy `.env.example` (at the
repository root) to `.env`, put your key in it, and pass it to Node with
`--env-file`, for example `node --env-file=../.env test/smoke.mjs` from this
folder. `.env` is ignored by git. The plugin and the extension do not read
`.env`.

## Tools

| Tool | What it does |
|---|---|
| `search_patents` | Searches applications and granted patents filed 2001 onward. Supports all words (default), exact phrase, any word, and advanced field syntax. Filters by filing date range and granted only. Sorts by relevance, newest or oldest. Pages through results. |
| `get_patent` | Returns a concise summary of one application: title, status, dates, patent number, inventors, applicants, assignees, CPC classes, examiner, art unit, parent applications and recent events. |
| `get_patent_documents` | Lists the key documents in the file wrapper (claims, specification, abstract, drawings, office actions, examiner citations, allowance) and shows which have readable text. Use `filter: "all"` for everything. |
| `get_document_text` | Downloads a document and returns plain text. Defaults to the latest claims. Also handles abstracts, specifications and remarks. Long documents come back in pages. |
| `get_drawings` | Shows the drawing sheets as images so Claude can look at the figures. Uses the most recent drawings document (DRW) unless you give a `documentId`. Returns pages 1 to 3 by default (`pages` takes `"2"`, `"1-3"` or `"2,4"`; at most 5 per call) at 1600 pixels on the longest side (`maxDimension` 600 to 2400). |

All tools are read only. Nothing is ever filed, changed or submitted at USPTO.

### Application number or patent number

`get_patent`, `get_patent_documents`, `get_document_text` and `get_drawings`
take either `applicationNumber` (for example `18483359` or `18/483,359`) or
`patentNumber`, never both. A patent number may be written the way it
appears on the patent: `12399789`, `12,399,789`, `US12399789` or
`US 12,399,789 B1` (the kind code is ignored). The connector looks the
number up with a USPTO search and every result says which application it
resolved to, for example "Patent US 12,399,789 resolved to application
18483359."

Design, reissue, plant and statutory invention registration numbers
(`D987,654`, `RE49,123`, `PP12,345`, `H1,234`) are looked up with their
letter prefix, first as written (`D987654`) and then zero padded the way
USPTO full text data writes them (`D0987654`). If the Open Data Portal
stores the number differently, you get a plain English "not found" message;
find the application with `search_patents` and use `applicationNumber`.
Publication numbers (`US 2023/0123456 A1`) are not patent numbers and are
refused with a hint. Patents from applications filed before 2001 are not in
the Open Data Portal.

## Example prompts

* "Search for prior art on partitioned read and write authority for data isolation, filed before March 2024."
* "Find granted patents with the exact phrase 'data isolation' and summarize the top five."
* "Read the claims of application 18483359 and compare claim 1 to my invention."
* "What office actions has application 17941660 received, and what did the examiner cite?"
* "Show me the drawings of patent 12,399,789."
* "Look at FIG. 3 of US 12,399,789 B1 and tell me how it differs from my sketch."
* "Show pages 4 and 5 of the drawings for application 18483359 at the largest size."

## Limits

* **Search scope.** Search matches titles and bibliographic fields (applicant, inventor, classification and similar). It does not search inside claim or description text. To compare substance, search first, then read candidates with `get_document_text`.
* **Coverage.** ODP covers applications filed from 2001 onward. Older patents are not included.
* **OCR text.** Document text comes from USPTO optical character recognition and can contain small errors. Drawings and most forms are scanned images with no text; view drawings with `get_drawings`.
* **Drawings.** `get_drawings` reads the scanned page images inside the USPTO PDF and converts them to grayscale PNG images, downscaled with area averaging so thin lines stay visible. It decodes the formats USPTO uses for drawings: CCITT Group 4 fax compression (most issued patents and published applications) and Flate compressed 1 bit scans, plus other common uncompressed and lossless formats. A page stored with JBIG2, JPEG or JPEG 2000 compression, or drawn as vector graphics with no scan, is listed in the result with the reason instead of an image; the other pages are still shown. Each PNG is kept under about 1 MB (typically 20 to 80 KB for a line drawing at the default size).
* **Rate limits.** USPTO applies rate limits per API key. When USPTO answers that it is busy (HTTP 429, 502, 503 or 504), the extension waits and retries up to two more times on its own, honoring the wait USPTO asks for (up to 10 seconds). If the limit persists you get a plain English message; wait a minute and try again.

## Troubleshooting

| Message | Fix |
|---|---|
| "No USPTO API key is configured" | Desktop extension: add your key under Settings > Extensions > Patent Connector. Plugin: set the `USPTO_ODP_API_KEY` environment variable and fully restart the app (see [Set your USPTO API key](#set-your-uspto-api-key)). |
| "USPTO rejected the API key" | Check the key for typos, or generate a new one in My ODP. |
| "not a valid USPTO application number" | Use the application number (for example 16123456) in `applicationNumber`, or pass a granted patent number as `patentNumber` instead. |
| "does not look like a US patent number" | Write it like 12,399,789 or US 12,399,789 B1. Application numbers go in `applicationNumber`. |
| "has no drawings document (DRW)" | That application has no drawings on file; check with `get_patent_documents`. |
| "Page N cannot be shown" | That page uses a format the connector cannot decode; open the document in Patent Center (the link is in the result). |
| "only available as a scanned PDF" | That document has no text layer. Try the claims (CLM), abstract (ABST) or specification (SPEC) instead. |

## Privacy

See [PRIVACY.md](PRIVACY.md). In short: the extension collects nothing, has no servers, and sends your key and queries only to USPTO.

## Development

```
npm ci
npm run test:offline                  # security, retry and feature tests (no key, no network)
node --env-file=../.env test/smoke.mjs   # live test suite (needs a key in ../.env)
npm run build                         # rebuilds dist/patent-connector.mjs (plugin bundle)
npm run test:bundle                   # offline tests against the bundle
npm run check:bundle                  # bundle starts on its own and lists all tools
npm run pack                          # builds ../patent-connector-1.3.1.mcpb
```

The offline suites start the server with a simulated USPTO
(`test/mock-fetch.mjs`). `test/features.mjs` covers patent number lookup
and `get_drawings` against a real USPTO drawings PDF
(`test/fixtures/drw-18483359.pdf`, the published drawings of application
18483359) and checks that every returned image is a valid PNG. Continuous
integration runs the offline suites on every push and pull request; the
live smoke test needs a key and runs only on your computer
(`node --env-file=../.env test/smoke.mjs`, or `node test/smoke.mjs` with
`USPTO_ODP_API_KEY` already set).

### The plugin bundle

The plugin runs `dist/patent-connector.mjs`, one file that holds `index.js`
and all of its dependencies, because the repository does not commit
`node_modules` and a plugin installed from git gets no `npm install`.
`index.js` stays the source. After any change to `index.js` or to the
dependencies, rebuild and commit the bundle together with the change:

```
npm ci            # exact versions from package-lock.json
npm run build     # esbuild (pinned, run through npx): node 18, ESM
npm run test:bundle
```

The build also writes `dist/THIRD_PARTY_NOTICES.txt` with the license of
every bundled package. The bundle contains no API key: the key is read from
the `USPTO_ODP_API_KEY` environment variable at run time. The `.mcpb`
desktop extension does not use the bundle; it packs `index.js` and `lib/`
with `node_modules` as before (`dist/` is in `.mcpbignore`).

## Security

See [SECURITY.md](SECURITY.md) for how the API key is protected and how to report a vulnerability.

## Support

Open an issue on this project's repository, or contact the author.

## License

Copyright 2026 Kevin Ringler. Licensed under the Apache License, Version 2.0;
see LICENSE and NOTICE.
