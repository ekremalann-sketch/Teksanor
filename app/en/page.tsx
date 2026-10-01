import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Teksanor | Field service and operations",
  description: "A working prototype for service requests, scheduling, field checklists, customer approvals and operational records. Review the current limits before a pilot.",
  alternates: { canonical: `${SITE_URL}/en`, languages: { tr: `${SITE_URL}/`, en: `${SITE_URL}/en` } },
  openGraph: { title: "Teksanor | Field service and operations", description: "Field operations with accountable approvals. Working prototype; pilot limits are explicit.", url: `${SITE_URL}/en`, locale: "en_US" },
};

const capabilities = [
  ["Service work", "Track requests, assigned work, field checklists and customer approval in one record chain."],
  ["Planning", "See weekly assignments and workload warnings before sending a team to the field."],
  ["Assets and maintenance", "Record equipment, its owner and location, and upcoming maintenance."],
  ["Scoped access", "Company and role checks limit which operational records a user can read or change."],
];

export default function EnglishHome() {
  return <main className="enterprise-page" lang="en">
    <header className="enterprise-header">
      <Link href="/en" className="enterprise-brand" aria-label="Teksanor home"><img src="/assets/teksanor-logo.png" alt="Teksanor" /></Link>
      <nav aria-label="Main navigation"><a href="#platform">Platform</a><a href="#workflow">Workflow</a><Link href="/en/trust">Trust and privacy</Link></nav>
      <details className="public-mobile-menu"><summary>Menu</summary><nav aria-label="Mobile navigation"><a href="#platform">Platform</a><a href="#workflow">Workflow</a><Link href="/en/trust">Trust and privacy</Link><Link href="/" hrefLang="tr">Türkçe</Link></nav></details><div className="enterprise-actions"><Link href="/" hrefLang="tr">Türkçe</Link><Link className="enterprise-login" href="/giris" hrefLang="tr">Sign in (Turkish UI) <ArrowRight size={16}/></Link></div>
    </header>
    <section className="enterprise-hero enterprise-hero-split"><div><span className="enterprise-kicker">FIELD SERVICE · MAINTENANCE · ENGINEERING</span><h1>Connect work in the field with decisions at the office.</h1><p>Teksanor brings service requests, assignments, equipment, maintenance, approvals and operational records into one workspace. It is a working prototype with defined pilot boundaries, not a certified accounting or safety system.</p><Link className="enterprise-primary" href="#platform">Explore the platform <ArrowRight size={17}/></Link></div><div className="enterprise-image-card"><img src="/assets/teksanor-field-operations.svg" alt="Illustration of a field team and its operations workspace"/></div></section>
    <section className="enterprise-section" id="platform"><div className="enterprise-heading"><span>PRODUCT SCOPE</span><h2>Follow each job from request to evidence.</h2><p>Operational records stay linked to the responsible team and the customer's decision.</p></div><div className="legal-grid">{capabilities.map(([title,body])=><article key={title}><ShieldCheck/><h3>{title}</h3><p>{body}</p></article>)}</div></section>
    <section className="enterprise-section" id="workflow"><div className="enterprise-heading"><span>CONTROLLED WORKFLOW</span><h2>Plan, perform, approve and review.</h2></div><div className="workflow-diagram light">{["Receive and assign", "Complete the field checklist", "Request customer approval", "Review records and costs"].map((step,i)=><div key={step}><b>{i+1}</b><span>{step}</span>{i<3&&<ArrowRight size={18}/>}</div>)}</div></section>
    <section className="legal-context-note"><ShieldCheck/><div><b>What the prototype does not claim</b><p>No official e-invoice submission, certified double-entry accounting, complete offline work-order editing or activated file storage. The XML output is an accounting pre-draft. Real customer deployment requires a documented data inventory, contracts, recovery exercise and security acceptance.</p><Link href="/en/trust">Review the trust and privacy status →</Link></div></section>
    <footer className="enterprise-footer"><div className="enterprise-footer-lead"><img src="/assets/teksanor-logo.png" alt="Teksanor"/><p>Field service and operations prototype with accountable human decisions.</p></div><div><b>Explore</b><Link href="/en/trust">Trust and privacy</Link><Link href="/" hrefLang="tr">Turkish site</Link><Link href="/giris" hrefLang="tr">Sign in (Turkish UI)</Link></div><div className="enterprise-footer-bottom"><span>© 2026 Teksanor · Ekrem Alan</span><a href="https://github.com/ekremalann-sketch" target="_blank" rel="noopener noreferrer">GitHub profile and projects</a><span>Prototype · Pilot evaluation required</span></div></footer>
  </main>;
}
