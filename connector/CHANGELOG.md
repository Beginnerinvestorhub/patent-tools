# Changelog

Versions follow semantic versioning.

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
