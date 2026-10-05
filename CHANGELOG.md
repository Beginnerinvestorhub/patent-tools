# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
