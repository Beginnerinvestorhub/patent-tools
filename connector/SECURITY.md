# Security Policy

## Supported versions

Only the latest released version receives security fixes.

## Reporting a vulnerability

Please report security problems privately through the repository's
"Report a vulnerability" (GitHub Security Advisories) feature rather than a
public issue. Include what you found, how to reproduce it, and the version.
You can expect an acknowledgement within 7 days.

## Design notes

* The USPTO API key is read from the environment, sent only over HTTPS to
  uspto.gov hosts, dropped on any redirect that leaves uspto.gov, and never
  included in tool output. See `test/security.mjs`.
* All tools are read only. The extension writes no files and runs no shell
  commands.
* Responses are capped at 25 MB; inputs are validated before any request.
* `get_drawings` parses PDFs from USPTO with a small reader in `lib/pdf.js`
  that treats every file as untrusted: at most 50 MB decompressed per image,
  20000 pixels per side, 2000 pages, bounded nesting, reference chains and
  content stream size, and every parse problem becomes a plain English
  message. PDFs and images are processed in memory only and never written
  to disk. `test/features.mjs` covers these limits.
* The plugin runs `dist/patent-connector.mjs`, a bundle of `index.js` and
  the exact dependency versions in `package-lock.json`, built with a pinned
  esbuild version (`npm run build`). It contains no API key or other secret;
  `npm run test:bundle` runs the offline security tests against it. Rebuild
  it whenever a dependency gets a security fix.
