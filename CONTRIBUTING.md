# Contributing to patent-tools

Thanks for your interest in improving `patent-tools`.

This project helps researchers, inventors, and IP teams work with USPTO data and patent drafting workflows. Contributions are welcome in the form of bug reports, feature ideas, documentation improvements, and code fixes.

## Ways to contribute

- Report bugs or unexpected behavior
- Suggest new features or improvements
- Improve documentation and examples
- Help test changes across the connector and drawing skill
- Submit pull requests with focused, well-documented changes

## Before you start

Please read:

- [README.md](README.md)
- [SECURITY.md](SECURITY.md)
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)

If you are making a code change, review the relevant component docs:

- [connector/README.md](connector/README.md)
- [skills/patent-drawing/README.md](skills/patent-drawing/README.md)

## Development setup

### Repository layout

- `connector/` — Patent Connector MCP server
- `skills/patent-drawing/` — patent drawing skill
- `.github/` — CI, issue templates, and PR workflows

### Connector

```bash
cd connector
npm ci
npm run test:offline
```

### Drawing skill

```bash
cd skills/patent-drawing
python tests/run_script_tests.py
```

For optional PDF generation dependencies:

```bash
pip install -r scripts/requirements.txt
```

## Contribution guidelines

### Issues

Before opening a bug report, please check whether the issue already exists and include the following details:

- Clear title and summary
- Steps to reproduce
- Expected behavior
- Actual behavior
- Environment details (OS, Node/Python versions, tool used)
- Relevant logs or screenshots

### Pull requests

Open a PR with:

- A clear explanation of the problem and fix
- Tests or validation steps performed
- Notes on any limitations or follow-up work
- Small, focused changes when possible

### Coding expectations

- Keep changes targeted and easy to review
- Prefer readable, maintainable code over clever implementations
- Add or update tests when behavior changes
- Do not commit API keys or sensitive credentials

## Documentation

We welcome improvements to:

- Setup and installation instructions
- Usage examples and prompt examples
- Troubleshooting and error handling
- Rule explanations for patent drafting workflow

## Review process

Maintainers may ask for revisions before merging. Please be responsive to feedback and help keep the repository consistent and easy to use.

## Community standards

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). Please be respectful and constructive in all discussions.

## License

By contributing, you agree that your contributions will be licensed under the Apache License 2.0, as described in [LICENSE](LICENSE).
