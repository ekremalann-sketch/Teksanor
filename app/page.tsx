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
  ShieldCheck,
  Sparkles,
  UserRound,
  Workflow,
} from "lucide-react";

const services = [
  {
    icon: BrainCircuit,
    href: "/icerikler/yapay-zeka-is-analizi",
    title: "Yapay zekâ destekli iş analizi",
    text: "Tekrarlanan işleri, dağınık verileri ve karar noktalarını inceler; daha sade ve ölçülebilir bir çalışma modeli tasarlarız.",
  },
  {
    icon: BarChart3,
    href: "/icerikler/veri-karar-destek",
    title: "Veri ve karar destek sistemleri",
    text: "Excel ve farklı kaynaklardaki verileri anlaşılır panellere, izlenebilir göstergelere ve yönetilebilir raporlara dönüştürürüz.",
  },
  {
    icon: Workflow,
    href: "/icerikler/surec-otomasyonu",
    title: "Süreç otomasyonu",
    text: "Manuel takip yükünü azaltan, insan kontrolünü koruyan ve iş akışlarını hızlandıran dijital çözümler geliştiririz.",
  },
  {
    icon: Settings2,
    href: "/icerikler/muhendislik-danismanligi",
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
          <Link href="/cozumler">Çözümler</Link>
          <Link href="/muhendislik">Mühendislik</Link>
          <Link href="/yapay-zeka">Yapay Zekâ</Link>
          <Link href="/hakkimizda">Hakkımızda</Link>
        </nav>
        <Link className="login-link" href={authenticated ? "/panel" : "/giris"}>
          <span className="login-link-icon"><UserRound size={17} /></span>
          <span className="login-link-label">{authenticated ? "Panel" : "Giriş"}</span>
          <ArrowRight className="login-link-arrow" size={16} />
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
            <Link className="primary-action" href="/cozumler">Çözümleri keşfet <ArrowRight size={18} /></Link>
            <Link className="secondary-action" href="/giris?mode=register"><LockKeyhole size={17} /> Ücretsiz deneyin</Link>
          </div>
          <div className="trust-row">
            <span><CheckCircle2 size={16} /> Ölçülebilir</span>
            <span><CheckCircle2 size={16} /> Uygulanabilir</span>
            <span><CheckCircle2 size={16} /> Güvenli</span>
          </div>
        </div>
        <div className="hero-visual engineering-hero-visual" aria-label="Teksanor mühendislik laboratuvarı">
          <img src="/assets/teksanor-engineering-lab.webp" alt="Akıllı üretim, robotik ve veri mühendisliği laboratuvarı" />
          <div className="hero-brand-stamp"><img src="/assets/teksanor-logo.png" alt="Teksanor" /><span>ENGINEERING INTELLIGENCE</span></div>
          <div className="metric-float metric-one"><Database size={19} /><span><b>Tek kaynak</b>Dağınık veriler için</span></div>
          <div className="metric-float metric-two"><Gauge size={19} /><span><b>Anlık görünürlük</b>Kararlar için</span></div>
        </div>
      </section>

      <section className="executive-strip" aria-label="Teksanor platform özellikleri">
        <article><div><ShieldCheck size={21} /></div><span><b>Şirket bazlı güvenli alan</b><small>Her firma yalnızca kendi kayıtlarına erişir.</small></span></article>
        <article><div><Gauge size={21} /></div><span><b>Tek ekranda finansal görünüm</b><small>Borç, gider, nakit ve belgeler birlikte izlenir.</small></span></article>
        <article><div><Workflow size={21} /></div><span><b>İzlenebilir operasyon</b><small>Yetkiler ve işlem geçmişi merkezi olarak yönetilir.</small></span></article>
        <article><div><Database size={21} /></div><span><b>Excel’den düzenli veriye</b><small>Dağınık tablolar anlaşılır kayıtlara dönüşür.</small></span></article>
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
          {services.map(({ icon: Icon, href, title, text }, index) => (
            <Link className="service-card" href={href} key={title}>
              <div className="service-number">0{index + 1}</div>
              <div className="service-icon"><Icon size={23} /></div>
              <h3>{title}</h3>
              <p>{text}</p><span className="service-discover">Alanı keşfet <ArrowRight size={15} /></span>
            </Link>
          ))}
        </div>
      </section>

      <section className="platform-showcase" aria-label="Teksanor yönetim platformu">
        <div className="platform-showcase-copy">
          <span className="section-kicker">Kurumsal yönetim altyapısı</span>
          <h2>Dağınık kayıtları, güvenilir bir yönetim sistemine dönüştürün.</h2>
          <p>Finansal takipten belge yönetimine kadar günlük operasyonlar tek bir çalışma alanında birleşir. Her kullanıcı yalnızca yetkili olduğu firma verisine ulaşır.</p>
          <div className="platform-points">
            <span><LockKeyhole size={19} /><b>Firma bazlı veri ayrımı</b><small>Her şirketin kayıtları diğerlerinden tamamen ayrılır.</small></span>
            <span><BarChart3 size={19} /><b>Karar vermeyi kolaylaştıran görünüm</b><small>Borç, gider ve nakit bilgileri anlaşılır özetlere dönüşür.</small></span>
            <span><Workflow size={19} /><b>Kontrollü iş akışı</b><small>Kullanıcı ve yönetici yetkileri tek merkezden yönetilir.</small></span>
          </div>
        </div>
        <div className="platform-preview" aria-label="Yönetim paneli ön izlemesi">
          <div className="preview-bar"><i /><i /><i /><span>TEKSANOR / YÖNETİM MERKEZİ</span></div>
          <div className="preview-layout">
            <div className="preview-sidebar"><b /><span /><span /><span /><span /></div>
            <div className="preview-content">
              <div className="preview-heading"><span /><i /></div>
              <div className="preview-cards"><i /><i /><i /></div>
              <div className="preview-chart"><span /><span /><span /><span /><span /></div>
            </div>
          </div>
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

      <section className="insights-section">
        <div className="insights-preview">
          <span className="section-kicker">Teksanor içgörüleri</span>
          <h2>Teknolojiyi değil, dönüşen işi anlatıyoruz.</h2>
          <p>Mühendislik, veri ve yapay zekânın işletme problemlerinde nasıl değer ürettiğini özgün ve anlaşılır içeriklerle ele alıyoruz.</p>
          <div className="insights-preview-grid">
            <Link href="/icerikler/yapay-zeka-is-analizi"><img src="/assets/teksanor-digital-twin.webp" alt="Endüstriyel dijital ikiz ve veri mühendisliği merkezi" /><span>YAPAY ZEKÂ · İŞ ANALİZİ</span><b>Yapay zekâ bir işletmenin gerçek problemini nasıl anlamlandırır?</b><em>8 dakikalık yazıyı oku <ArrowRight size={15} /></em></Link>
            <Link href="/icerikler/muhendislik-danismanligi"><span>MÜHENDİSLİK YAKLAŞIMI</span><b>Teknoloji yatırımı yapmadan önce hangi sorular sorulmalı?</b><em>10 dakikalık yazıyı oku <ArrowRight size={15} /></em></Link>
            <Link href="/icerikler/veri-karar-destek"><span>FİNANSAL GÖRÜNÜRLÜK</span><b>Dağınık Excel kayıtları yönetim görünümüne nasıl dönüşür?</b><em>9 dakikalık yazıyı oku <ArrowRight size={15} /></em></Link>
          </div>
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
