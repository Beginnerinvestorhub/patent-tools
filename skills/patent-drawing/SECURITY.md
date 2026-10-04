# Security Policy

## Supported versions

Only the latest released version receives security fixes.

## Reporting a vulnerability

Please report security problems privately through the repository's
"Report a vulnerability" (GitHub Security Advisories) feature rather than a
public issue. Include what you found, how to reproduce it, and the version.
You can expect an acknowledgement within 7 days.

## Design notes

* The scripts make no network calls and run no shell commands.
* SVG files containing DOCTYPE or ENTITY declarations, scripts, embedded or
  linked images, or links to other files are refused before parsing, which
  blocks entity expansion attacks and local file inclusion.
* SKILL.md instructs Claude to treat inventions as confidential and never to
  send invention details to outside services without explicit permission.
