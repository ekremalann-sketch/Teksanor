# Security Policy

## Supported version

Security fixes are considered only for the current version on the main branch. Teksanor is a product prototype and does not currently provide a public service-level commitment.

## Reporting a vulnerability

Do not disclose technical details in a public issue, pull request or discussion. Use GitHub's **Security → Report a vulnerability** channel. If private reporting is unavailable, contact the repository owner with a message that states only that a security issue exists.

Include the affected page/API/version, safe reproduction steps, likely impact and a suggested mitigation. Never send passwords, tokens, customer records or personal data.

## Production gates

Before any real-customer deployment, verify authentication and session controls, tenant isolation, input and file validation, CSRF/XSS/SSRF protection, rate limiting, backups and restore drills, tamper-resistant audit retention, privacy obligations, monitoring, incident response and an independent security assessment.

The public demo is intended only for synthetic data.
