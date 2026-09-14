# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it by email to **juan12fc@gmail.com**. **Do not** open a public GitHub issue for security problems.

Include in your report:

- Description of the vulnerability and its potential impact
- Steps to reproduce, or a proof-of-concept
- Affected versions or commits (if known)
- Suggested fix (optional)

You should receive an acknowledgement within 72 hours. We will follow up with a triage decision and (if confirmed) a remediation timeline.

## Supported Versions

Only the latest commit on the `main` branch receives security updates. Older versions are not patched.

## Scope

In scope: any code under `src/`, `drizzle/`, or configuration that ships with the repository.

Out of scope:

- Third-party services (360dialog, GitHub, Render, Railway, Neon)
- Local-only development setup (Docker Compose credentials are dev defaults, documented in [`docs/decisions/0001-local-postgres-docker.md`](docs/decisions/0001-local-postgres-docker.md))
- Issues requiring physical access to a deployed instance

## Recognition

We are happy to credit reporters who follow responsible disclosure, unless they prefer to remain anonymous.