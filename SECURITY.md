# Security Policy

## Supported versions

The project maintainers aim to support the current default branch and the latest released versions of the repository components.

## Reporting a vulnerability

If you discover a security issue, please do not open a public issue. Instead, report it privately through GitHub by contacting the repository owner or by opening a private security report if available in the repository settings.

Please include:

- A clear description of the issue
- Steps to reproduce
- Potential impact
- Relevant files or commands involved
- Any suggested fix or mitigation

We will review the report as quickly as possible and keep you informed of our progress.

## Security notes

This repository includes tools that may interact with USPTO APIs and local patent drafting workflows. Please avoid committing or sharing:

- API keys
- Private patent filings
- Sensitive client or invention details in public issues or discussions

The repository also includes component-level security guidance:

- [connector/SECURITY.md](connector/SECURITY.md)
- [skills/patent-drawing/SECURITY.md](skills/patent-drawing/SECURITY.md)
- [connector/PRIVACY.md](connector/PRIVACY.md)

## Responsible disclosure

We appreciate responsible disclosure and will work with reporters to validate and resolve issues in a timely and professional manner.
