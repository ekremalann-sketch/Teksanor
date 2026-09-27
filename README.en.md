# Teksanor | Field Service and Operations

Teksanor is a working prototype that brings service requests, approvals, field visits, maintenance, assets, work orders, and management reporting into one organization-aware workspace. It pairs a public product site with a role-based operations portal.

[Live product site](https://teksanor.pages.dev/) · [Service flow](https://teksanor.pages.dev/servis) · [Trust and scope](https://teksanor.pages.dev/guven) · [Türkçe README](README.md)

![Illustration of Teksanor field operations; no customer records](public/assets/teksanor-field-operations.svg)

## What it demonstrates

- A service journey from request and quotation through customer approval, technician visit, service record, and collection tracking.
- Organization-scoped access to tasks, customers, equipment, maintenance history, and financial records.
- Cloudflare Workers and D1 deployment backed by automated tests, security checks, and production health verification.
- Optional R2 attachment support. File uploads stay unavailable when storage is not configured; the core product demo does not require R2.

## What is live and what is not (25 Sep 2026)

| Capability | Status |
|---|---|
| Public product pages | Live; the UI is Turkish only (this README is the English entry point). |
| Sign-in, sign-up, role and organization scope | Live. Role × organization boundaries are behaviour-tested (`tests/access-matrix.test.mjs`). |
| Service desk: work order → quote → customer approval → field work → service record → collection | Live; covered by an end-to-end behaviour test (`tests/workflow-e2e.test.mjs`). Photo/document attachments need R2 and are off. |
| Finance records, expenses, Excel/CSV import and export | Live. Missing values are not treated as zero; double submissions and repeated imports do not create duplicates. |
| Customer signature | Optional finger-drawn signature on the approval page; validated server-side and stored in D1 as an SVG path (no R2 needed). Shown on the service record. Not a qualified e-signature. |
| Add to home screen and offline | Installable as a web app. Without a connection an offline page opens; field notes can be kept with "save draft on device". Records and API responses are **never** cached on the device; there is no offline sync. |
| Field checklists | Managers design form templates (starters: AC maintenance, generator load test, H&S); technicians fill them on site. Required items block completion; forms lock after customer approval. |
| Scheduling board | `/servis/plan`: weekly technician × day board; managers assign date and owner; warns at 3+ jobs per person per day. |
| E-invoice draft | UBL 2.1 accounting pre-draft (standards compliance not verified) from an approved job. **Not transmitted**; sending via GİB/Peppol requires a separate provider. |
| File upload / download | **Off**: R2 is not bound; `/api/health` reports this as a warning. |
| Central Bank FX and gold reference | Live (`/api/public/fx`); informational reference, not a binding price. |
| Email password recovery, generative AI, external file scanning | Depend on configuration; without keys they are clearly disabled or labelled and never shown as working. |
| D1 backup and restore | Backup script and local drill available (`npm run drill:restore`); a real D1 restore drill still needs Cloudflare access. |

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
