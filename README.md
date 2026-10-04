# Patent Tools

Two companion tools that give Claude patent superpowers: live access to the
USPTO Open Data Portal, and the ability to draft and check USPTO-compliant
patent drawings.

> These are research and drafting tools, not legal advice. Have a registered
> patent attorney or agent review anything before you rely on it or file.

## What's inside

Versions: Patent Connector (USPTO) 1.2.0, Patent Drawing skill 1.2.0,
plugin 1.1.0.

| Component | What it is |
|---|---|
| [`connector/`](connector/) | **Patent Connector (USPTO)** — an MCP server / Claude Desktop extension. Search USPTO patents and applications and read the actual text of claims, abstracts and specifications, using your own free USPTO API key. |
| [`skills/patent-drawing/`](skills/patent-drawing/) | **Patent Drawing skill** — drafts patent figures under 37 CFR 1.84, runs an automated compliance checker, compares reference numerals against your specification, and assembles a filing-ready PDF. |

## Install

Pick the channel you use:

* **Claude Desktop.** Double-click `patent-connector-1.2.0.mcpb` (or drag it
  into **Settings > Extensions**). See
  [connector/README.md](connector/README.md) for setup and your API key.
* **Claude.ai.** Zip the `skills/patent-drawing` folder and upload it under
  **Customize > Skills**. See
  [skills/patent-drawing/README.md](skills/patent-drawing/README.md).
* **Claude Code.** Copy `skills/patent-drawing/` into `~/.claude/skills/`
  (all projects) or `.claude/skills/` (one project). Or install the whole
  repo as a plugin — the `.claude-plugin/` manifest also wires up the
  Patent Connector MCP server (requires `node` and a `USPTO_ODP_API_KEY`
  environment variable). The plugin starts the committed single file
  bundle `connector/dist/patent-connector.mjs`, which already contains every
  dependency, so no `npm install` is needed. Set `USPTO_ODP_API_KEY` in the
  environment that starts Claude Code (for example in your shell profile);
  the plugin has no settings screen for it.
* **Devin CLI / Desktop / cloud.** `devin plugins install
  Beginnerinvestorhub/patent-tools`. Installs the skill and the connector
  MCP server together.

## Repository layout

```
.claude-plugin/plugin.json   Plugin manifest (works in Devin and Claude Code)
.mcp.json                    Plugin-provided Patent Connector MCP server
connector/                   Patent Connector (USPTO) MCP server + .mcpb source
connector/dist/              Single file bundle the plugin runs (npm run build)
skills/patent-drawing/       Patent Drawing skill (self-contained; zip this
                             folder for Claude.ai or copy it for Claude Code)
```

Each component keeps its own README, CHANGELOG, LICENSE and NOTICE, so the
skill folder and the connector folder are each distributable on their own.

## Development

```
cd connector
npm install
USPTO_ODP_API_KEY=your_key npm test   # live test suite (needs a free key)
node test/security.mjs                # offline security tests
node test/retry.mjs                   # offline retry tests
npm run build                         # rebuilds dist/patent-connector.mjs
npm run test:bundle                   # offline tests against the bundle
npm run pack                          # rebuilds ../patent-connector-1.2.0.mcpb

cd ../skills/patent-drawing
pip install -r scripts/requirements.txt   # only the PDF builder needs packages
python tests/run_script_tests.py      # automated script tests
```

Rebuild and commit `connector/dist/patent-connector.mjs` whenever
`connector/index.js` or its dependencies change; the plugin runs the bundle,
not `index.js`. See [connector/README.md](connector/README.md#the-plugin-bundle).

## Security and privacy

The connector sends your API key and queries only to api.uspto.gov over
HTTPS; it collects nothing and has no servers. The skill's scripts run
locally with no network access. See [connector/SECURITY.md](connector/SECURITY.md),
[connector/PRIVACY.md](connector/PRIVACY.md) and
[skills/patent-drawing/SECURITY.md](skills/patent-drawing/SECURITY.md).

## License

Copyright 2026 Kevin Ringler. Licensed under the Apache License, Version
2.0; see LICENSE and NOTICE.
