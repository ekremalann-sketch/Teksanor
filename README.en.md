# Teksanor | Field Service and Operations

Teksanor is a working prototype that brings service requests, approvals, field visits, maintenance, assets, work orders, and management reporting into one organization-aware workspace. It pairs a public product site with a role-based operations portal.

[Live product site](https://teksanor.pages.dev/) · [Service flow](https://teksanor.pages.dev/servis) · [Trust and scope](https://teksanor.pages.dev/guven) · [Türkçe README](README.md)

![Illustration of Teksanor field operations; no customer records](public/assets/teksanor-field-operations.svg)

## What it demonstrates

- A service journey from request and quotation through customer approval, technician visit, service record, and collection tracking.
- Organization-scoped access to tasks, customers, equipment, maintenance history, and financial records.
- Cloudflare Workers and D1 deployment backed by automated tests, security checks, and production health verification.
- Optional R2 attachment support. File uploads stay unavailable when storage is not configured; the core product demo does not require R2.

## Responsible use

The public presentation uses demonstration data. Do not enter real customer, employee, or financial records into the demo. This project is a prototype, not an audited commercial ERP or accounting product. Real-company deployment requires access review, backups and restore testing, privacy documentation, and an acceptance pilot.

## Local verification

Node.js 22 and npm 11 are required.

```bash
npm ci
npm test
npm run typecheck
npm run build:pages
```

Configuration keys are documented in [`.env.example`](.env.example). Keep actual credentials in the hosting provider's secret store. See the [security policy](SECURITY.md), [roadmap](docs/ROADMAP.md), and [source license](LICENSE) for scope and use terms.
