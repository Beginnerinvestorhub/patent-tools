# Changelog

Versions follow semantic versioning.

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
