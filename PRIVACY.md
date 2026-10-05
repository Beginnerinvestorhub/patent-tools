# Privacy Policy

Patent Tools is a local-first plugin. This policy covers both components:
the Patent Connector MCP server and the Patent Drawing skill.

## Data collection

None. The plugin runs entirely on your machine. There are no servers,
accounts, analytics, telemetry or tracking of any kind.

## Use and storage

- **Your USPTO API key** is stored only on your machine: in Claude Code's
  secure storage (when entered via the plugin's configuration prompt), in
  Claude Desktop's extension settings, or in an environment variable you
  set yourself. It is never written into the plugin's files, never logged,
  and never shown to the model.
- **Your invention content** (descriptions, claims, sketches, SVG figures)
  is read locally by the skill's scripts to draft and check drawings.
  The scripts make no network calls and send nothing anywhere.

## Third-party sharing

The only outbound network traffic is to the United States Patent and
Trademark Office at `api.uspto.gov`, over HTTPS, when you use the Patent
Connector tools. What is sent:

- Your API key (required by USPTO, sent in the request header)
- The patent numbers, application numbers, document identifiers and
  search queries you ask for

Nothing else leaves your machine. No data is sent to the plugin author
or to any other third party.

## Data retention

Nothing is retained by the plugin beyond the files you ask it to create
or edit in your own working directory. There is no upload, so there is
nothing to delete elsewhere. To remove your API key, delete it from the
plugin configuration, the Desktop extension settings, or your
environment.

## Contact

Questions or privacy concerns: open an issue at
https://github.com/Beginnerinvestorhub/patent-tools/issues or see
SECURITY.md for sensitive reports.

*Last updated: 2026-10-05*
