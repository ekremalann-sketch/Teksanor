<div align="center">

# Teksanor Enterprise Operations Platform

An end-to-end product prototype combining a public corporate website and a role-based operations workspace for technical service, maintenance and engineering teams.

[Open live demo](https://teksanor.pages.dev/en) · [View Turkish README](README.md) · [Roadmap](docs/ROADMAP.md) · [Security](SECURITY.en.md)

</div>

> **Portfolio and product prototype:** The public environment is intended only for synthetic demo data. Teksanor is not an official accounting, banking or ERP product and is not represented as production-ready.

## What the product demonstrates

- Work orders, field visits, assets and preventive maintenance
- Organisation- and role-scoped access
- Projects, teams, documents and operational records
- Payments, liabilities, expenses and management visibility
- Audit history and controlled approval flows
- Cloudflare D1-compatible data layer and optional R2 storage
- Automated testing, security scanning and deployment gates

## A typical workflow

1. Register a request or work order.
2. Link it to the relevant customer, project, asset and team.
3. Record field findings, maintenance history and authorised documents.
4. Separate operational and financial visibility by role.
5. Close the process with a service record and an auditable history.

## Current status

Teksanor is a working prototype and a candidate for a controlled paid pilot. It must not be marketed as a generally available SaaS or production system until the critical controls in [the roadmap](docs/ROADMAP.md) are verified in the target customer environment.

## Technology

React 19, TypeScript, Vinext, Cloudflare runtime, D1/SQLite-compatible queries, optional R2 storage, GitHub Actions and automated security checks.

## Trust and responsible use

- [Security policy](SECURITY.en.md)
- [Responsible use policy](docs/ETHICAL-USE.en.md)
- [Licensing guide](docs/LICENSING.en.md)
- [Support scope](SUPPORT.en.md)
- [Binding source license](LICENSE)

## Copyright and licence notice

Copyright © 2026 Ekrem Alan. All rights reserved.

This repository is source-available for portfolio review and limited non-commercial evaluation only. It is **not open source**. Copying, modification, redistribution, hosting, resale, white-label use, derivative works, training-data use or incorporation into another product is prohibited unless the copyright holder grants prior written permission. The binding terms are stated in [LICENSE](LICENSE).

No statement on this page replaces jurisdiction-specific legal advice or guarantees enforcement in every country.
