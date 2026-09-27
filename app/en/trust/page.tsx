import Link from "next/link";
import type { Metadata } from "next";
import { SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Trust and privacy status | Teksanor",
  description: "Implemented controls, disabled features and the evidence still required before a real-customer pilot.",
  alternates: { canonical: `${SITE_URL}/en/trust`, languages: { tr: `${SITE_URL}/guven`, en: `${SITE_URL}/en/trust` } },
};

const rows = [
  ["Company and role access", "Implemented and covered by access tests", "Independent penetration test remains open"],
  ["Session protection", "Secure cookie and account controls in code", "Pilot identity and recovery exercise remains open"],
  ["Database backup", "Ordered export and local restore drill", "Production recovery time and data-loss targets not measured"],
  ["File storage and malware scanning", "Uploads disabled while R2 is unconfigured", "Do not enable uploads without storage and scanning policy"],
  ["Invoicing and finance", "Operational finance and XML pre-draft", "No official e-invoice submission or certified double-entry ledger"],
  ["Privacy requests", "No destructive name-based anonymisation exposed", "Verified identity, record scope, retention and review needed"],
];

export default function EnglishTrust(){return <main className="enterprise-page" lang="en">
  <header className="enterprise-header"><Link className="enterprise-brand" href="/en"><img src="/assets/teksanor-logo.png" alt="Teksanor"/></Link><nav aria-label="Main navigation"><Link href="/en">Platform</Link><Link href="/en/trust">Trust and privacy</Link></nav><div className="enterprise-actions"><Link href="/guven" hrefLang="tr">Türkçe</Link></div></header>
  <section className="enterprise-hero center"><span className="enterprise-kicker">EVIDENCE BEFORE CLAIMS</span><h1>Security controls have a status, a limit and a test.</h1><p>The product is a prototype. Code checks and passing tests do not establish legal compliance, certification or safety for live personal data.</p></section>
  <section className="enterprise-table-wrap" tabIndex={0} role="region" aria-label="Security and privacy status"><table className="enterprise-table"><thead><tr><th>Area</th><th>Current evidence</th><th>Open work</th></tr></thead><tbody>{rows.map(([area,evidence,open])=><tr key={area}><td>{area}</td><td>{evidence}</td><td>{open}</td></tr>)}</tbody></table></section>
  <section className="legal-context-note"><div><b>Turkey and Europe</b><p>KVKK and GDPR applicability depends on the actual organisation, data, purpose, location and contracts. Before using real customer data, identify controller and processor roles, lawful basis, retention, rights handling, subcontractors, transfer routes, incident response and independent review. No ISO, HIPAA or GDPR certification is claimed.</p><Link href="/en">← Back to platform</Link></div></section>
  </main>}
