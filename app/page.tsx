"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  BrainCircuit,
  CheckCircle2,
  Database,
  Gauge,
  Layers3,
  LockKeyhole,
  Settings2,
  Sparkles,
  Workflow,
} from "lucide-react";

const services = [
  {
    icon: BrainCircuit,
    title: "Yapay zekâ destekli iş analizi",
    text: "Tekrarlanan işleri, dağınık verileri ve karar noktalarını inceler; daha sade ve ölçülebilir bir çalışma modeli tasarlarız.",
  },
  {
    icon: BarChart3,
    title: "Veri ve karar destek sistemleri",
    text: "Excel ve farklı kaynaklardaki verileri anlaşılır panellere, izlenebilir göstergelere ve yönetilebilir raporlara dönüştürürüz.",
  },
  {
    icon: Workflow,
    title: "Süreç otomasyonu",
    text: "Manuel takip yükünü azaltan, insan kontrolünü koruyan ve iş akışlarını hızlandıran dijital çözümler geliştiririz.",
  },
  {
    icon: Settings2,
    title: "Mühendislik ve teknoloji danışmanlığı",
    text: "İhtiyacı doğru tanımlar, uygulanabilir teknoloji seçeneklerini karşılaştırır ve sürdürülebilir çözüm yolunu birlikte belirleriz.",
  },
];

const principles = [
  "Karmaşıklığı artırmadan dijitalleşme",
  "Veriye dayalı ve açıklanabilir kararlar",
  "İnsan kontrolünü koruyan yapay zekâ",
  "İhtiyaca göre büyüyebilen sistemler",
];

export default function Home() {
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    fetch("/api/auth/status", { cache: "no-store" })
      .then((response) => response.json())
      .then((result: { authenticated?: boolean }) => setAuthenticated(Boolean(result.authenticated)))
      .catch(() => setAuthenticated(false));
  }, []);

  return (
    <main className="site-shell">
      <header className="site-header">
        <Link className="brand-link" href="/" aria-label="Teksanor ana sayfa">
          <img src="/assets/teksanor-logo.png" alt="Teksanor" className="header-logo" />
        </Link>
        <nav className="desktop-nav" aria-label="Ana menü">
          <a href="#cozumler">Çözümler</a>
          <a href="#yaklasim">Yaklaşım</a>
          <a href="#kurumsal">Kurumsal</a>
        </nav>
        <Link className="login-link" href={authenticated ? "/panel" : "/giris"}>
          {authenticated ? "Panele dön" : "Giriş / Kayıt"} <ArrowRight size={16} />
        </Link>
      </header>

      <section className="hero" id="kurumsal">
        <div className="hero-grid" aria-hidden="true" />
        <div className="hero-glow hero-glow-one" aria-hidden="true" />
        <div className="hero-glow hero-glow-two" aria-hidden="true" />
        <div className="hero-copy">
          <div className="eyebrow"><Sparkles size={15} /> Mühendislik · Veri · Yapay zekâ</div>
          <h1>Mühendislik aklı.<br /><span>Yapay zekâ gücü.</span></h1>
          <p>
            Teksanor, iş süreçlerini daha anlaşılır, izlenebilir ve verimli hâle getirmek amacıyla
            mühendislik yaklaşımını veri analitiği ve yapay zekâ destekli çözümlerle bir araya getiren
            bir teknoloji markasıdır.
          </p>
          <div className="hero-actions">
            <a className="primary-action" href="#cozumler">Çözümleri keşfet <ArrowRight size={18} /></a>
            <Link className="secondary-action" href="/giris?mode=register"><LockKeyhole size={17} /> Ücretsiz deneyin</Link>
          </div>
          <div className="trust-row">
            <span><CheckCircle2 size={16} /> Ölçülebilir</span>
            <span><CheckCircle2 size={16} /> Uygulanabilir</span>
            <span><CheckCircle2 size={16} /> Güvenli</span>
          </div>
        </div>
        <div className="hero-visual" aria-label="Teksanor teknoloji amblemi">
          <div className="brand-orbit orbit-one" />
          <div className="brand-orbit orbit-two" />
          <img src="/assets/teksanor-brand.png" alt="Teksanor gümüş ve altın amblemi" />
          <div className="metric-float metric-one"><Database size={19} /><span><b>Tek kaynak</b>Dağınık veriler için</span></div>
          <div className="metric-float metric-two"><Gauge size={19} /><span><b>Anlık görünürlük</b>Kararlar için</span></div>
        </div>
      </section>

      <section className="section-block" id="cozumler">
        <div className="section-heading">
          <div>
            <span className="section-kicker">Çözüm alanları</span>
            <h2>Teknolojiyi, işin gerçekten ihtiyaç duyduğu yere uygularız.</h2>
          </div>
          <p>Hazır kalıplar yerine problemi anlamaya, veriyi düzenlemeye ve adım adım değer üretmeye odaklanırız.</p>
        </div>
        <div className="services-grid">
          {services.map(({ icon: Icon, title, text }, index) => (
            <article className="service-card" key={title}>
              <div className="service-number">0{index + 1}</div>
              <div className="service-icon"><Icon size={23} /></div>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="approach-section" id="yaklasim">
        <div className="approach-copy">
          <span className="section-kicker">Teksanor yaklaşımı</span>
          <h2>Önce ihtiyacı netleştirir, sonra sistemi sadeleştiririz.</h2>
          <p>
            Dijital dönüşüm yalnızca yeni bir yazılım kullanmak değildir. Doğru bilgiye, doğru zamanda ve doğru yetkiyle
            ulaşabilmek demektir. Bu nedenle her çözümü kullanıcı alışkanlıklarını, güvenliği ve büyüme ihtimalini birlikte
            düşünerek tasarırız.
          </p>
          <ul className="principles-list">
            {principles.map((principle) => <li key={principle}><CheckCircle2 size={18} />{principle}</li>)}
          </ul>
        </div>
        <div className="system-card">
          <div className="system-topline"><span>TEKSANOR / SYSTEM VIEW</span><span className="status-dot">Çevrimiçi</span></div>
          <div className="system-center">
            <div className="system-core"><Layers3 size={32} /><b>Akıllı Sistem</b><small>Veri · Süreç · Karar</small></div>
            <div className="connector connector-a" />
            <div className="connector connector-b" />
            <div className="connector connector-c" />
            <div className="system-node node-a">Veri</div>
            <div className="system-node node-b">Analiz</div>
            <div className="system-node node-c">Aksiyon</div>
          </div>
          <div className="system-footer"><span>Güvenli erişim</span><span>İzlenebilir işlemler</span><span>Ölçeklenebilir yapı</span></div>
        </div>
      </section>

      <section className="portal-callout">
        <div>
          <span className="section-kicker">Teksanor Yönetim Portalı</span>
          <h2>Finansal görünürlüğü Excel karmaşasından çıkarın.</h2>
          <p>Ödeme, borç, gider, belge ve dönemsel değişimleri tek panelde yönetin. Kullanıcılar kolayca veri girsin; kritik değişiklikler yönetici kontrolünden geçsin.</p>
        </div>
        <Link className="primary-action" href="/giris?mode=register">14 gün ücretsiz deneyin <ArrowRight size={18} /></Link>
      </section>

      <footer className="site-footer">
        <div><img src="/assets/teksanor-logo.png" alt="Teksanor" /><p>Akıllı sistemler. Ölçülebilir ilerleme.</p></div>
        <div className="footer-note">Teksanor, mühendislik ve teknoloji çözümleri için geliştirilen marka kimliğidir. Resmî şirket ve iletişim bilgileri kuruluş süreci tamamlandığında eklenecektir.</div>
        <div className="footer-end">© 2026 Teksanor</div>
      </footer>
    </main>
  );
}
