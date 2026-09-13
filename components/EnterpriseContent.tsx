import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Settings2,
  Wrench,
  HardHat,
} from "lucide-react";

/* ---------- Shared site chrome (header + footer) ---------- */
export function SiteChrome({ children }: { children: ReactNode }) {
  return (
    <div className="doc-shell">
      <header className="site-header">
        <Link className="brand-link" href="/" aria-label="Teksanor ana sayfa">
          <img src="/assets/teksanor-logo.png" alt="Teksanor" className="header-logo" />
        </Link>
        <nav className="desktop-nav" aria-label="Ana menü">
          <Link href="/platform">Platform</Link>
          <Link href="/sektorler">Sektörler</Link>
          <Link href="/entegrasyonlar">Entegrasyonlar</Link>
          <Link href="/guven">Güven</Link>
          <Link href="/hakkimizda">Hakkımızda</Link>
        </nav>
        <Link className="login-link" href="/giris">
          <span className="login-link-label">Giriş</span>
          <ArrowRight className="login-link-arrow" size={16} />
        </Link>
      </header>
      {children}
      <footer className="site-footer">
        <div>
          <img src="/assets/teksanor-logo.png" alt="Teksanor" />
          <p>Akıllı sistemler. Ölçülebilir ilerleme.</p>
        </div>
        <div className="footer-end">© 2026 Teksanor</div>
      </footer>
    </div>
  );
}

export type DocSection = {
  title: string;
  body?: string;
  bullets?: string[];
  cards?: { title: string; text: string }[];
};

export type DocPageProps = {
  eyebrow: string;
  title: string;
  intro: string;
  pills?: string[];
  sections: DocSection[];
  cta?: { label: string; href: string };
};

/* ---------- Generic corporate/document page ---------- */
export function DocPage({ eyebrow, title, intro, pills, sections, cta }: DocPageProps) {
  return (
    <SiteChrome>
      <section className="doc-hero">
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{intro}</p>
        {pills && pills.length > 0 && (
          <div className="pill-row">
            {pills.map((pill) => (
              <span className="pill" key={pill}>
                {pill}
              </span>
            ))}
          </div>
        )}
      </section>

      {sections.map((section) => (
        <section className="doc-section" key={section.title}>
          <h2>{section.title}</h2>
          {section.body && <p>{section.body}</p>}
          {section.bullets && (
            <ul className="doc-list">
              {section.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          )}
          {section.cards && (
            <div className="doc-grid">
              {section.cards.map((card) => (
                <div className="doc-card" key={card.title}>
                  <CheckCircle2 size={20} />
                  <h3>{card.title}</h3>
                  <p>{card.text}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      ))}

      {cta && (
        <section className="doc-section" style={{ textAlign: "center" }}>
          <Link className="primary-action" href={cta.href} style={{ justifyContent: "center" }}>
            {cta.label} <ArrowRight size={18} />
          </Link>
        </section>
      )}

      <Link className="doc-back" href="/">
        <ArrowLeft size={16} /> Ana sayfaya dön
      </Link>
    </SiteChrome>
  );
}

/* ---------- /sektorler landing ---------- */
const sectors = [
  {
    icon: Wrench,
    href: "/sektorler/teknik-servis",
    title: "Teknik servis",
    text: "Arıza kaydından saha müdahalesine, iş emri takibinden faturalandırmaya kadar tüm servis akışı.",
  },
  {
    icon: Settings2,
    href: "/sektorler/bakim-onarim",
    title: "Bakım ve onarım",
    text: "Periyodik bakım planları, ekipman envanteri, kontrol listeleri ve otomatik yeni tarih hesaplama.",
  },
  {
    icon: HardHat,
    href: "/sektorler/muhendislik-taahhut",
    title: "Mühendislik ve taahhüt",
    text: "Proje bazlı planlama, ilerleme takibi, maliyet ve belge yönetimi tek çalışma alanında.",
  },
];

export function SectorsPage() {
  return (
    <SiteChrome>
      <section className="doc-hero">
        <div className="eyebrow">Sektörler</div>
        <h1>İşe göre düzenlenen çözümler</h1>
        <p>
          Teksanor; teknik servis, bakım-onarım ve mühendislik-taahhüt ekiplerinin gerçek iş akışına göre
          şekillenir. Her sektör için ortak operasyon omurgası, alanına özgü ekranlarla tamamlanır.
        </p>
      </section>

      <section className="doc-section">
        <h2>Çözüm alanları</h2>
        <div className="doc-grid">
          {sectors.map(({ icon: Icon, href, title, text }) => (
            <Link className="doc-card" href={href} key={title}>
              <Icon size={22} />
              <h3>{title}</h3>
              <p>{text}</p>
              <span className="service-discover">
                İncele <ArrowRight size={15} />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <Link className="doc-back" href="/">
        <ArrowLeft size={16} /> Ana sayfaya dön
      </Link>
    </SiteChrome>
  );
}
