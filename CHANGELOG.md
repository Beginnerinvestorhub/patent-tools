# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.4.0] - 2026-10-10

### Changed
- Patent Connector has no npm dependencies: a small built in MCP server
  (`connector/lib/mcp.js`) replaces the SDK, and the plugin runs
  `connector/index.js` directly instead of the bundled `connector/dist/`
- Key error messages point to the plugin or extension settings

### Removed
- `connector/dist/` bundle, its third party notices and the build step
- `PATENT_CONNECTOR_RETRY_SCALE` test setting from the shipped server

## [1.3.1] - 2026-10-05

### Added
- Patent Connector (USPTO) MCP server and support tooling
- Patent drawing skill for drafting and checking USPTO-compliant figures
- CI workflow for offline validation
- Documentation for installation, setup, and usage
- Repository-level contribution and community standards documentation
- GitHub issue templates for bugs, feature requests, and usage questions
- Pull request template for consistent review workflow
- Root-level security policy and community guidance
- README badges and documentation links for project visibility

### Fixed
- Patent drawing checker converts SVG/CSS length units (mm, cm, in, pt,
  pc, px) to physical millimeters, fixing sheet size and text/line clash
  detection on sheets that use px or mixed units
- Clarified public project documentation and support paths

### Changed
- Consolidated patent research and legal-drafting tooling into one repository

### Security
- Added explicit privacy and security documentation for USPTO API usage and local tooling
