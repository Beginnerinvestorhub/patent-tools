# Patent Connector (USPTO)

Patent Connector gives Claude live access to the USPTO Open Data Portal (ODP). Claude can search patents and applications, pull a clean summary of any file, and read the actual text of claims, abstracts and specifications so it can compare them against your invention.

It runs locally inside Claude Desktop as a desktop extension. You bring your own free USPTO API key. There are no servers in between: your key and your queries go straight from your computer to api.uspto.gov.

> This is a research tool, not legal advice. Have a registered patent attorney or agent review any search before you rely on it or file.

## Setup

1. Get a free API key: sign in at [data.uspto.gov](https://data.uspto.gov), open **My ODP**, and copy your key.
2. Install `patent-connector-1.2.0.mcpb` by double clicking it, or drag it into Claude Desktop under **Settings > Extensions**.
3. Paste your key when prompted. Claude Desktop saves it in the extension's settings on your computer. The extension sends it only over HTTPS to uspto.gov and never shows it to Claude. You can regenerate the key any time in My ODP.

Requires Claude Desktop with Node.js 18 or newer (bundled with Claude Desktop).

### As a plugin (Claude Code)

Installing the `patent-tools` repository as a plugin starts this server
from the single file bundle `dist/patent-connector.mjs`, so no `npm install`
is needed; Node.js 18 or newer must be on your PATH. The plugin has no
settings screen for the key: set `USPTO_ODP_API_KEY` in the environment
that starts Claude Code (for example `export USPTO_ODP_API_KEY=your_key` in
your shell profile). Without it the tools answer "No USPTO API key is
configured".

## Tools

| Tool | What it does |
|---|---|
| `search_patents` | Searches applications and granted patents filed 2001 onward. Supports all words (default), exact phrase, any word, and advanced field syntax. Filters by filing date range and granted only. Sorts by relevance, newest or oldest. Pages through results. |
| `get_patent` | Returns a concise summary of one application: title, status, dates, patent number, inventors, applicants, assignees, CPC classes, examiner, art unit, parent applications and recent events. |
| `get_patent_documents` | Lists the key documents in the file wrapper (claims, specification, abstract, drawings, office actions, examiner citations, allowance) and shows which have readable text. Use `filter: "all"` for everything. |
| `get_document_text` | Downloads a document and returns plain text. Defaults to the latest claims. Also handles abstracts, specifications and remarks. Long documents come back in pages. |

All tools are read only. Nothing is ever filed, changed or submitted at USPTO.

## Example prompts

* "Search for prior art on partitioned read and write authority for data isolation, filed before March 2024."
* "Find granted patents with the exact phrase 'data isolation' and summarize the top five."
* "Read the claims of application 18483359 and compare claim 1 to my invention."
* "What office actions has application 17941660 received, and what did the examiner cite?"

## Limits

* **Search scope.** Search matches titles and bibliographic fields (applicant, inventor, classification and similar). It does not search inside claim or description text. To compare substance, search first, then read candidates with `get_document_text`.
* **Coverage.** ODP covers applications filed from 2001 onward. Older patents are not included.
* **OCR text.** Document text comes from USPTO optical character recognition and can contain small errors. Drawings and most forms are scanned images with no text.
* **Rate limits.** USPTO applies rate limits per API key. When USPTO answers that it is busy (HTTP 429, 502, 503 or 504), the extension waits and retries up to two more times on its own, honoring the wait USPTO asks for (up to 10 seconds). If the limit persists you get a plain English message; wait a minute and try again.

## Troubleshooting

| Message | Fix |
|---|---|
| "No USPTO API key is configured" | Add your key in Claude Desktop under Settings > Extensions > Patent Connector. |
| "USPTO rejected the API key" | Check the key for typos, or generate a new one in My ODP. |
| "not a valid USPTO application number" | Use the application number (for example 16123456), not the patent number. Search for the patent first to find it. |
| "only available as a scanned PDF" | That document has no text layer. Try the claims (CLM), abstract (ABST) or specification (SPEC) instead. |

## Privacy

See [PRIVACY.md](PRIVACY.md). In short: the extension collects nothing, has no servers, and sends your key and queries only to USPTO.

## Development

```
npm install
USPTO_ODP_API_KEY=your_key npm test   # live test suite
node test/security.mjs                # offline security tests (no key needed)
node test/retry.mjs                   # offline retry tests (no key needed)
npm run build                         # rebuilds dist/patent-connector.mjs (plugin bundle)
npm run test:bundle                   # offline tests against the bundle
npm run pack                          # builds ../patent-connector-1.2.0.mcpb
```

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
desktop extension does not use the bundle; it packs `index.js` with
`node_modules` as before (`dist/` is in `.mcpbignore`).

## Security

See [SECURITY.md](SECURITY.md) for how the API key is protected and how to report a vulnerability.

## Support

Open an issue on this project's repository, or contact the author.

## License

Copyright 2026 Kevin Ringler. Licensed under the Apache License, Version 2.0;
see LICENSE and NOTICE.
