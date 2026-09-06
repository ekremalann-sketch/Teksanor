import Link from "next/link";
import { ArrowRight, CheckCircle2, ShieldAlert, ShieldCheck, Workflow, Wrench } from "lucide-react";
import { criticalBacklog, departmentReality, priorityLabel, readinessSnapshot, roadmapPhases, statusLabel, workingModules } from "@/lib/readiness";

export const metadata = {
  title: "Teksanor Kurumsal Durum ve Yol Haritası",
  description: "Teksanor'un çalışan modülleri, kritik eksikleri, pilot öncesi yapılacakları ve kurumsal hazırlık yol haritası.",
};

export default function CorporateReadinessPage() {
  return (
    <main className="readiness-page">
      <header className="site-header readiness-header">
        <Link className="brand-link" href="/" aria-label="Teksanor ana sayfa">
          <img src="/assets/teksanor-logo.png" alt="Teksanor" className="header-logo" />
        </Link>
        <nav className="desktop-nav" aria-label="Ana menü">
          <Link href="/">Ana sayfa</Link>
          <Link href="/cozumler">Çözümler</Link>
          <Link href="/yapay-zeka-hizmeti">Yapay zekâ hizmeti</Link>
          <Link href="/giris">Giriş</Link>
        </nav>
      </header>

      <section className="readiness-hero">
        <div>
          <span className="section-kicker">Canlı siteye eklenen gerçek durum sayfası</span>
          <h1>{readinessSnapshot.title}</h1>
          <p>{readinessSnapshot.summary}</p>
          <div className="readiness-actions">
            <Link className="primary-action" href="/giris#kayit">Pilot çalışma alanı oluştur <ArrowRight size={18} /></Link>
            <Link className="secondary-action" href="/panel"><ShieldCheck size={17} /> Panele git</Link>
          </div>
        </div>
        <aside className="readiness-verdict">
          <ShieldAlert size={34} />
          <b>Net karar</b>
          <p>Açık müşteri satışı değil; güvenlik maddeleri kapanmış kontrollü ücretli pilot.</p>
        </aside>
      </section>

      <section className="readiness-stats" aria-label="Teksanor hızlı durum özeti">
        {readinessSnapshot.stats.map((item) => (
          <article key={item.label}>
            <span>{item.label}</span>
            <b>{item.value}</b>
            <p>{item.note}</p>
          </article>
        ))}
      </section>

      <section className="readiness-section two-column">
        <div>
          <span className="section-kicker">Kodda gerçekten çalışanlar</span>
          <h2>Vaat ile gerçek modülü ayırıyoruz.</h2>
          <p>Bu alan müşteriye güven vermek için parlatılmış pazarlama diliyle değil, teknik gerçeklikle gösterilir.</p>
        </div>
        <div className="readiness-list">
          {workingModules.map((item) => (
            <article key={item.name} className={`status-${item.status}`}>
              <CheckCircle2 size={19} />
              <span><b>{item.name}</b><em>{statusLabel(item.status)}</em><small>{item.note}</small></span>
            </article>
          ))}
        </div>
      </section>

      <section className="readiness-section">
        <div className="section-heading compact-heading">
          <div>
            <span className="section-kicker">Departman gerçekliği</span>
            <h2>13 departman vizyonu var; ilk ürün çekirdeği finans ve proje üstünde duruyor.</h2>
          </div>
          <p>Saha hizmetleri, iş emri ve ziyaret kanıtı ilk genişleme fazının merkezinde olmalı.</p>
        </div>
        <div className="department-reality-grid">
          {departmentReality.map((item) => (
            <article key={item.name}>
              <span>{item.state}</span>
              <h3>{item.name}</h3>
              <p>{item.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="readiness-section two-column critical-block">
        <div>
          <span className="section-kicker">Canlı müşteri öncesi zorunlu işler</span>
          <h2>Güvenlik ve operasyon kapısı kapanmadan açık satış yok.</h2>
          <p>Bu liste ürünü yavaşlatmak için değil, ilk ciddi müşteri görüşmesinde güven kaybetmemek için var.</p>
        </div>
        <div className="backlog-list">
          {criticalBacklog.map((item) => (
            <article key={item.title} className={`priority-${item.priority}`}>
              <div><Wrench size={18} /><span>{priorityLabel(item.priority)}</span></div>
              <h3>{item.title}</h3>
              <p>{item.impact}</p>
              <small>Çıkış ölçütü: {item.exit}</small>
            </article>
          ))}
        </div>
      </section>

      <section className="readiness-section roadmap-section">
        <div className="section-heading compact-heading">
          <div>
            <span className="section-kicker">90 günlük uygulama yolu</span>
            <h2>Önce güvenlik, sonra saha omurgası, sonra ücretli pilot.</h2>
          </div>
        </div>
        <div className="roadmap-cards">
          {roadmapPhases.map((phase) => (
            <article key={phase.period}>
              <span>{phase.period}</span>
              <h3>{phase.title}</h3>
              <ul>{phase.items.map((item) => <li key={item}><Workflow size={14} />{item}</li>)}</ul>
            </article>
          ))}
        </div>
      </section>

      <section className="readiness-final-cta">
        <div>
          <span className="section-kicker">Pilot stratejisi</span>
          <h2>Şimdi doğru hamle: 3 firmada sınırlı, ölçülü ve ücretli pilot.</h2>
          <p>Başarı ölçüsü “site güzel mi?” değil; rapor süresi, eksik kayıt, geciken iş, kullanıcı kabulü ve yöneticinin karar hızıdır.</p>
        </div>
        <Link className="primary-action" href="/giris#kayit">Pilot için başla <ArrowRight size={18} /></Link>
      </section>
    </main>
  );
}
