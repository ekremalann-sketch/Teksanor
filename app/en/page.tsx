import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Database,
  Gauge,
  Layers3,
  LockKeyhole,
  Settings2,
  ShieldCheck,
  Workflow,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Teksanor | Field Service and Engineering Operations",
  description:
    "A working product prototype for field service, maintenance, asset, project and operational-finance workflows.",
  alternates: { canonical: "/en", languages: { "tr-TR": "/", "en": "/en" } },
};

const capabilities = [
  {
    icon: Workflow,
    title: "Field operations",
    text: "Connect work orders, site visits, findings and service records in one traceable workflow.",
  },
  {
    icon: Settings2,
    title: "Assets and maintenance",
    text: "Track equipment ownership, location, maintenance intervals, history and next actions.",
  },
  {
    icon: BarChart3,
    title: "Management visibility",
    text: "Bring operational and financial records into role-aware summaries without presenting estimates as facts.",
  },
  {
    icon: ShieldCheck,
    title: "Controlled access",
    text: "Separate organisations and roles, preserve audit history and require human approval for material actions.",
  },
];

export default function EnglishHome() {
  return (
    <main className="site-shell" lang="en">
      <header className="site-header">
        <Link className="brand-link" href="/en" aria-label="Teksanor English home">
          <img src="/assets/teksanor-logo.png" alt="Teksanor" className="header-logo" />
        </Link>
        <nav className="desktop-nav" aria-label="English navigation">
          <a href="#platform">Platform</a>
          <a href="#workflow">Workflow</a>
          <a href="#trust">Trust</a>
          <a href="#pilot">Pilot</a>
        </nav>
        <Link className="login-link" href="/">
          <span className="login-link-icon">TR</span>
          <span className="login-link-label">Türkçe</span>
        </Link>
      </header>

      <section className="hero">
        <div className="hero-grid" aria-hidden="true" />
        <div className="hero-glow hero-glow-one" aria-hidden="true" />
        <div className="hero-glow hero-glow-two" aria-hidden="true" />
        <div className="hero-copy">
          <div className="eyebrow">Field service · Maintenance · Engineering</div>
          <h1>Connect field work<br /><span>to accountable decisions.</span></h1>
          <p>
            Work orders, site visits, equipment, preventive maintenance, projects, documents
            and operational finance come together in one role-aware workspace.
          </p>
          <div className="hero-actions">
            <a className="primary-action" href="#platform">Explore the platform <ArrowRight size={18} /></a>
            <a className="secondary-action" href="#pilot"><Gauge size={17} /> Pilot model</a>
            <Link className="secondary-action" href="/giris"><LockKeyhole size={17} /> Corporate sign-in</Link>
          </div>
          <div className="trust-row">
            <span><CheckCircle2 size={16} /> Measurable</span>
            <span><CheckCircle2 size={16} /> Deployable</span>
            <span><CheckCircle2 size={16} /> Accountable</span>
          </div>
        </div>
        <div className="hero-visual engineering-hero-visual" aria-label="Teksanor field operations">
          <img src="/assets/teksanor-field-operations.svg" alt="Engineering team managing field operations" />
          <div className="hero-brand-stamp"><img src="/assets/teksanor-logo.png" alt="Teksanor" /><span>ENGINEERING INTELLIGENCE</span></div>
          <div className="metric-float metric-one"><Database size={19} /><span><b>One source</b>For operational records</span></div>
          <div className="metric-float metric-two"><Gauge size={19} /><span><b>Live visibility</b>For decisions</span></div>
        </div>
      </section>

      <section className="section-block" id="platform">
        <div className="section-heading">
          <div>
            <span className="section-kicker">Product scope</span>
            <h2>A working operations backbone, not a collection of disconnected screens.</h2>
          </div>
          <p>Teksanor is designed for technical service, maintenance and engineering teams that need a controlled path from request to service record.</p>
        </div>
        <div className="services-grid">
          {capabilities.map(({ icon: Icon, title, text }, index) => (
            <article className="service-card" key={title}>
              <div className="service-number">0{index + 1}</div>
              <div className="service-icon"><Icon size={23} /></div>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="operations-command-section" id="workflow">
        <div className="operations-command-copy">
          <span className="section-kicker">Traceable workflow</span>
          <h2>Follow the job from request and asset to field evidence and cost.</h2>
          <p>The prototype links the records that usually live in spreadsheets, messages and paper forms while keeping organisation and role boundaries visible.</p>
          <div className="operations-command-list">
            <span><Layers3 size={20}/><b>01 · Register</b><small>Request, customer, project and asset</small></span>
            <span><Workflow size={20}/><b>02 · Execute</b><small>Assignment, visit, findings and documents</small></span>
            <span><ShieldCheck size={20}/><b>03 · Verify</b><small>Approval, service record and audit history</small></span>
            <span><BarChart3 size={20}/><b>04 · Learn</b><small>Operational and financial visibility</small></span>
          </div>
        </div>
        <div className="operations-command-visual" aria-label="Teksanor workflow preview">
          <div className="command-top"><span>TEKSANOR / OPERATIONS</span><em>DEMO</em></div>
          <div className="command-stats"><article><small>Assets</small><b>Inventory</b><i/></article><article><small>Maintenance</small><b>Schedule</b><i/></article><article><small>Work orders</small><b>Field</b><i/></article></div>
          <div className="command-flow">
            <div><span>01</span><b>Asset registered</b><small>Code · location · owner</small></div>
            <div><span>02</span><b>Work planned</b><small>Team · checklist · date</small></div>
            <div><span>03</span><b>Record closed</b><small>Evidence · history · next action</small></div>
          </div>
        </div>
      </section>

      <section className="approach-section" id="trust">
        <div className="approach-copy">
          <span className="section-kicker">Trust centre</span>
          <h2>Clear limits are part of the product.</h2>
          <p>The public environment is a synthetic-data demonstration. Real-customer use requires environment separation, verified access controls, backups, monitoring, privacy work and independent security review.</p>
          <ul className="principles-list">
            <li><CheckCircle2 size={18}/>Human review for material decisions</li>
            <li><CheckCircle2 size={18}/>Minimum necessary data and access</li>
            <li><CheckCircle2 size={18}/>No hidden employee surveillance</li>
            <li><CheckCircle2 size={18}/>No production claim before customer acceptance</li>
          </ul>
        </div>
        <div className="system-card">
          <div className="system-topline"><span>TEKSANOR / TRUST</span><span className="status-dot">TRANSPARENT</span></div>
          <div className="system-center">
            <div className="system-core"><ShieldCheck size={32}/><b>Responsible system</b><small>Access · Evidence · Human review</small></div>
          </div>
          <div className="system-footer"><span>Security policy</span><span>Ethical use</span><span>Auditability</span></div>
        </div>
      </section>

      <section className="portal-callout" id="pilot">
        <div>
          <span className="section-kicker">Controlled paid pilot</span>
          <h2>Prove one operational workflow before scaling.</h2>
          <p>A limited pilot should define users, data boundaries, success metrics, acceptance criteria and exit conditions before any broader rollout.</p>
        </div>
        <a className="primary-action" href="https://github.com/ekremalann-sketch/Teksanor">Review the project <ArrowRight size={18}/></a>
      </section>

      <footer className="site-footer">
        <div><img src="/assets/teksanor-logo.png" alt="Teksanor"/><p>Smart systems. Measurable progress.</p></div>
        <div className="footer-note">Working product prototype · Synthetic demo data only · Not represented as generally available production software.</div>
        <div className="footer-end">© 2026 Ekrem Alan · All rights reserved · Copying and commercial reuse prohibited except as expressly permitted by the repository licence.</div>
      </footer>
    </main>
  );
}
