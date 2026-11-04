# Teksanor Architecture Overview

## System context

- **Public product site:** product scope, sectors, trust and pilot information
- **Role-aware portal:** operational and management workflows
- **Application runtime:** React, TypeScript and Vinext on Cloudflare
- **Structured data:** Cloudflare D1 / SQLite-compatible access
- **Files:** optional Cloudflare R2 integration when storage is enabled
- **Delivery:** GitHub Actions checks followed by Cloudflare deployment

## Trust boundaries

1. Public pages must not expose credentials or private operational data.
2. Authentication and role checks protect portal and API operations.
3. Organisation scope must be applied to every tenant-owned query.
4. External services receive only the minimum authorised data.
5. File upload requires type, size, access and malware policy controls.
6. Audit records must identify material changes without storing secrets.

## Deployment gates

- Dependency installation from the lockfile
- Automated tests and type checking
- Production dependency audit
- Secret scanning and CodeQL analysis
- Production health and deployed-commit verification

## Production work still required

Target-environment tenant tests, backup/restore drills, load targets, monitoring and incident response, privacy documentation, customer acceptance and independent security review.
