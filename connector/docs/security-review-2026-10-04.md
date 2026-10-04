# Security and Privacy Review: 2026-10-04

Scope: Patent Drawing skill 1.0.0 and Patent Connector (USPTO) 1.1.1.
Reviewer: Claude (Cowork), at the author's request. This is an engineering
review, not a third party audit.

## Summary

| Area | Result |
|---|---|
| Secrets in source, tests, docs, packages | None found |
| Personal data | None beyond the author's name in copyright and metadata (intended) |
| API key containment (connector) | **Issue found and fixed**: key could follow a cross host redirect |
| Response size limits (connector) | **Added**: 25 MB cap |
| Malicious SVG input (skill scripts) | **Issue found and fixed**: entity expansion and file links were processed by build_pdf.py |
| Prompt injection via documents (skill) | **Added** ground rule 6 |
| Privacy policy accuracy (connector) | **Corrected**: key storage and redirect wording |
| Dependency vulnerabilities | Skill: 0. Connector: 5 indirect (3 moderate, 2 high) on the author's machine, fixed with `npm audit fix`, now 0 |
| Network access | Skill scripts: none. Connector: HTTPS to uspto.gov only (plus key free redirected downloads) |
| Shell or file writes | None in either project's runtime code |
| Confidentiality of inventions | Skill rule 1 plus test 17 (fresh session): no search without explicit OK |

## Findings

### 1. API key forwarded on cross host redirect (connector), fixed
Node's fetch keeps custom headers such as `x-api-key` when following a
redirect to another host (reproduced: a local redirect delivered the key to
the second host). The connector also fetched `downloadUrl` values from USPTO
responses without checking the host. Impact required a malicious or
compromised response, so likelihood was low, but the key would leak.
**Fix:** requests must be HTTPS to uspto.gov; redirects followed manually;
key attached only to uspto.gov hops; plain HTTP redirects refused.
**Verified by** `test/security.mjs` (10 checks) and the live suite.

### 2. Unbounded response size (connector), fixed
Downloads were read fully into memory. **Fix:** 25 MB cap via content
length and streamed byte count.

### 3. Malicious SVG processing (skill scripts), fixed
`build_pdf.py` built a PDF from an SVG with an entity expansion payload, an
`<image>` linking a local file and a `<use>` linking another file.
**Fix:** both scripts refuse DOCTYPE, ENTITY, script, image,
foreignObject, external href and external url()/@import before parsing.
**Verified by** `tests/run_script_tests.py` (4 new checks) and a sweep of 13
real drawings from testing (no false positives).

### 4. Prompt injection via user and USPTO text (skill), mitigated
Added ground rule 6 and a note in `patent-connector-tools.md`.

### 5. Privacy policy overstated key protection (connector), corrected
The policy said the key was kept in "secure settings storage". On the
author's Windows machine Claude Desktop saved it in a plain JSON settings
file. The policy and README now describe this accurately and explain how
the key is protected in transit and how to revoke it.

### 6. Dependency minimums (skill), tightened
Minimum versions raised to those tested on Windows and Linux. Only
published svglib CVE (CVE-2020-10799, versions 0.9.3 and older) is far below
the minimum and the new guard blocks that class of attack anyway.

## Residual risks (accepted, documented)

- The key's protection at rest depends on Claude Desktop.
- Search terms leave the user's computer when they search; the skill asks
  before sending invention details, the connector cannot tell what is
  confidential.
- OCR text from USPTO can contain errors; the skill shows suspect passages.
- The skill's legal content is not legal advice and can go stale.
