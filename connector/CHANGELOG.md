# Changelog

Versions follow semantic versioning.

## 1.3.0 (2026-10-04)

### Added
- Patent number lookup. `get_patent`, `get_patent_documents` and
  `get_document_text` accept `patentNumber` as an alternative to
  `applicationNumber`, written as `12399789`, `12,399,789`, `US12399789` or
  `US 12,399,789 B1`. The number is resolved with the ODP search on
  `applicationMetaData.patentNumber`, and each result names the application
  it resolved to. Design, reissue, plant and H numbers (`D987,654`,
  `RE49,123`) are tried as written and then zero padded to 8 characters
  (`D0987654`); if neither form is stored, a plain English error suggests
  `search_patents`. Giving both numbers, neither, or a malformed number is
  refused before any request is made, with a plain English message.
- New tool `get_drawings` ("View patent drawings"). Downloads the most
  recent drawings document (DRW or DRW.NONBW), or the one named by
  `documentId`, and returns a short summary plus one PNG image per page.
  `pages` takes `"2"`, `"1-3"` or `"2,4"` (default the first 3 pages, at most
  5 per call); `maxDimension` sets the longest side (600 to 2400 pixels,
  default 1600). The PDF goes through the same request path as every other
  download: the key only over HTTPS to uspto.gov, manual redirects, the 25 MB
  cap and retries.
- `lib/pdf.js`, a small dependency free PDF reader for scanned drawing
  sheets: classic cross reference tables, cross reference streams and object
  streams, damaged file recovery by rescanning, page tree order, inherited
  resources and rotation, image placement matrices, Flate (with PNG and TIFF
  predictors), LZW, ASCIIHex, ASCII85 and RunLength filters, 1 to 16 bit
  gray, RGB, CMYK, ICC based, indexed and separation images, `/Decode`
  arrays and image masks. Pages compressed with CCITT fax, JBIG2, JPEG or
  JPEG 2000 are reported as not supported (with the page count) instead of
  failing the call. Limits guard against hostile files: 50 MB decompressed
  per image, 20000 pixels per side, 2000 pages, nesting and reference chain
  depth, and content stream size.
- `lib/raster.js`: area averaging downscale (thin lines in 1 bit scans
  survive as gray), page orientation, and a PNG encoder on Node's zlib that
  stores pure black and white images at 1 bit per pixel. A drawing sheet at
  the default size is typically 20 to 80 KB.
- Offline feature tests `test/features.mjs` (`npm run test:features`, also
  part of `test:offline` and `test:bundle`), using a real published USPTO
  drawings PDF as a fixture and small generated PDFs for the harder cases.
- Live smoke test checks for patent number lookup and `get_drawings`.
- `scripts/check-bundle.mjs` (`npm run check:bundle`) starts the bundle with
  plain JSON RPC and checks it lists all 5 read only tools and explains a
  missing key, without network or `node_modules`.
- GitHub Actions CI (`.github/workflows/ci.yml`): on Node 20 and 22 runs
  the offline suites against `index.js` and the bundle, checks that the
  committed bundle matches a fresh build, and runs `check-bundle.mjs` on a
  copy of the bundle with no `node_modules`; on Python 3.11 and 3.12 runs
  the Patent Drawing skill's script tests. It also validates and packs the
  `.mcpb` desktop extension and starts the unpacked `index.js`. No secrets
  are used.

### Fixed
- The desktop extension package left out parts of its own dependencies:
  `.mcpbignore` patterns such as `dist/` and `test/` also matched folders
  inside `node_modules` (including `@modelcontextprotocol/sdk/dist/`), so
  the packed `index.js` could not start. The patterns are now anchored to
  the connector folder (`/dist/`, `/test/` and so on). CI now packs the
  extension, unpacks it and checks that it starts and lists all tools.

### Changed
- The "No USPTO API key is configured" and "rejected the API key" messages
  now name both places the key can live: the extension settings in Claude
  Desktop, or the `USPTO_ODP_API_KEY` environment variable for the plugin.
- README: a step by step "Set your USPTO API key" section for Windows,
  macOS and Linux, with how to check the variable is set.
- The application number error now points to `patentNumber` for granted
  patents, and `get_document_text` points to `get_drawings` for drawings.

## 1.2.0 (2026-10-04)

### Added
- Polite retry for transient USPTO errors. On HTTP 429, 502, 503 or 504 the
  extension retries up to two more times, honoring a numeric Retry-After
  header (capped at 10 seconds) and otherwise waiting 1 second, then 3
  seconds. Other 4xx errors are never retried. Manual redirect handling, the
  uspto.gov only key policy and the 25 MB response cap are unchanged.
- Offline retry test suite (`test/retry.mjs`, `npm run test:retry`), plus
  `npm run test:offline` to run the security and retry suites together.
- Single file plugin bundle `dist/patent-connector.mjs` (index.js plus all
  dependencies, built with esbuild for Node 18, ESM) with
  `dist/THIRD_PARTY_NOTICES.txt`. `npm run build` rebuilds both;
  `npm run test:bundle` runs the offline suites against the bundle (the
  tests take `--bundle`).

### Fixed
- Installing the `patent-tools` plugin from git crashed the server at start
  (`@modelcontextprotocol/sdk` not found), because `node_modules` is not
  committed. The plugin configs (`.mcp.json`, `mcp_config.json`) now start
  the bundle, which needs no install. The `.mcpb` desktop extension still
  packs `index.js` with `node_modules`.

### Changed
- The live smoke test (`test/smoke.mjs`) now discovers a granted application
  and an application with claims text through search at run time, falling
  back to fixed application numbers if discovery fails.
- Manifest description now states accurately how the API key is stored and
  where it is sent, matching the privacy policy.
- README install instructions refer to the current package name; README
  documents the plugin bundle, how to rebuild it, and that plugin users set
  `USPTO_ODP_API_KEY` in their environment.
- Manifest carries the icon, repository, homepage, documentation, support
  and privacy policy fields.
- `package-lock.json` refreshed to current patch releases
  (`@modelcontextprotocol/sdk` 1.32.0), the versions the bundle is built from.

## 1.1.1 (2026-10-04)

### Security
- The API key is now sent only over HTTPS to uspto.gov hosts. Redirects are
  followed manually and the key is dropped on any redirect that leaves
  uspto.gov (Node's fetch otherwise forwards custom headers such as
  x-api-key across hosts). Download links pointing outside uspto.gov are
  refused, and redirects to plain HTTP are refused.
- Responses are capped at 25 MB.
- Offline security test suite added (`test/security.mjs`).
- Dependencies updated with `npm audit fix` (indirect MCP SDK dependencies
  hono, @hono/node-server, fast-uri, ip-address, qs); `npm audit` now
  reports 0 vulnerabilities. These were in HTTP transport code the
  extension's stdio server does not use.

### Changed
- Privacy policy and README describe key storage accurately (saved by Claude
  Desktop in the extension settings on your computer).

## 1.1.0 (2026-10-03)

### Added
- `get_document_text` tool: reads claims, abstracts, specifications and other
  text documents from a file wrapper as plain text, with paging.
- Search modes: all words (default), exact phrase, any word, advanced field syntax.
- Search options: granted patents only, sort by relevance, newest or oldest, paging.
- Tool titles and annotations (read only, idempotent, open world) on every tool.
- Input validation for application numbers, dates and document IDs.
- Plain English errors for bad keys, rate limits, timeouts and not found.
- README, privacy policy, live smoke test (`npm test`).
- Licensed under the Apache License 2.0 (LICENSE and NOTICE files).

### Fixed
- Filing date filters were accepted but never sent to USPTO.
- Searches with no matches returned an error instead of an empty list.
- Reexamination records showed a patent number as the inventor name.
- Embedded image metadata no longer leaks into extracted document text.

### Changed
- Patent details return a concise summary instead of the raw USPTO record.
- Document lists show key documents by default (`filter: "all"` for everything).
- Manifest text rewritten for public users; misleading USPTO links removed.

## 1.0.0 (2026-07-13)

Initial private version: search, get application, list documents.
