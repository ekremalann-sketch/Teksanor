# Teksanor product readiness — 27 September 2026

This is a working field operations prototype. A passing build and security workflow verify specific checks; they do not certify a commercial deployment or legal compliance.

| Area | In this code | Required before a real customer pilot |
| --- | --- | --- |
| Work orders and planning | Requests, assignments, weekly plan and workload warnings | Device-level field trial, scheduling conflicts and acceptance evidence |
| Mobile fieldwork | Responsive checklist, customer approval and an offline **connection notice** | Durable offline editing and synchronisation if the customer needs it |
| Invoices and finance | Operational records and XML accounting pre-draft | Licensed/contracted e-invoice integration, tax and ledger review |
| Files | R2 intentionally disabled | Storage, malware controls, retention and backup before enabling uploads |
| Company access | Scoped queries and access tests | Independent review of every tenant-facing API and recovery workflow |
| Disaster recovery | Ordered D1 export and local restore drill | Production backup policy, isolated restore exercise and measured RPO/RTO |
| Privacy | No automatic destructive name-based anonymisation | Verified identity, data inventory, record-level scope, retention, review and audit |

## Comparison boundary

Microsoft Dynamics 365 Field Service documents work orders, scheduling and a configurable mobile offline profile. ServiceNow FSM documents dispatch queues and mobile work-order tasks. Teksanor currently covers a narrower workflow and only an offline notice; it does not claim feature parity or reuse their code or design.

Sources: https://learn.microsoft.com/en-us/dynamics365/field-service/ ; https://learn.microsoft.com/en-us/dynamics365/field-service/mobile/set-up-offline-profile ; https://www.servicenow.com/docs/r/field-service-management/field-service-scheduling/scheduling-and-dispatching-agents.html

## Privacy and regulatory boundary

Actual KVKK/GDPR duties depend on data flows, organisations and jurisdictions. An ISO 27001 certificate, HIPAA status, GDPR compliance and complete security have **not** been established. Review the KVKK security guide and GDPR with qualified advisers before processing real personal data.

References: https://www.kvkk.gov.tr/yayinlar/veri_guvenligi_rehberi.pdf ; https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng
