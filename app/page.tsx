"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import PublicMarket from "@/components/PublicMarket";
import {
  ArrowRight,
  BarChart3,
  BrainCircuit,
  CheckCircle2,
  CalendarCheck2,
  Database,
  Factory,
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
          <Link href="/platform">Platform</Link>
          <Link href="/sektorler">Sektörler</Link>
          <Link href="/entegrasyonlar">Entegrasyonlar</Link>
          <Link href="/guven">Güven</Link>
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
          <div className="eyebrow"><Sparkles size={15} /> Teknik servis · Bakım · Mühendislik</div>
          <h1>Sahadaki işi,<br /><span>merkezdeki karara bağlayın.</span></h1>
          <p>
            İş emirleri, saha ziyaretleri, ekipmanlar, periyodik bakım, projeler, belgeler ve finansal
            kayıtlar aynı çalışma alanında buluşur. Yönetici ne olduğunu görür; ekip ne yapacağını bilir.
          </p>
          <div className="hero-actions">
            <Link className="primary-action" href="/platform">Platformu incele <ArrowRight size={18} /></Link>
            <Link className="secondary-action" href="/pilot"><Gauge size={17} /> Pilot çalışma</Link>
            <Link className="secondary-action" href={authenticated ? "/panel" : "/giris"}><LockKeyhole size={17} /> {authenticated ? "Panele dön" : "Kurumsal giriş"}</Link>
          </div>
          <div className="trust-row">
            <span><CheckCircle2 size={16} /> Ölçülebilir</span>
            <span><CheckCircle2 size={16} /> Uygulanabilir</span>
            <span><CheckCircle2 size={16} /> Güvenli</span>
          </div>
        </div>
        <div className="hero-visual engineering-hero-visual" aria-label="Teksanor saha operasyonu yönetimi">
          <img src="/assets/teksanor-field-operations.svg" alt="Saha operasyonunu merkezden yöneten mühendislik ekibi" />
          <div className="hero-brand-stamp"><img src="/assets/teksanor-logo.png" alt="Teksanor" /><span>ENGINEERING INTELLIGENCE</span></div>
          <div className="metric-float metric-one"><Database size={19} /><span><b>Tek kaynak</b>Dağınık veriler için</span></div>
          <div className="metric-float metric-two"><Gauge size={19} /><span><b>Anlık görünürlük</b>Kararlar için</span></div>
        </div>
      </section>

      <section className="enterprise-entry-strip" aria-label="Teksanor kurumsal çözüm alanları">
        <div>
          <span>OPERASYON PLATFORMU</span>
          <h2>Teknik servis, bakım ve mühendislik ekipleri için tasarlandı.</h2>
          <p>Ürün turunu, sektör akışlarını, entegrasyon durumunu ve güvenlik kontrollerini ayrı kurumsal sayfalarda inceleyin.</p>
        </div>
        <div>
          <Link href="/platform"><Layers3 size={22}/><b>Platform</b><small>Modüller ve iş akışları</small><ArrowRight size={17}/></Link>
          <Link href="/sektorler"><Settings2 size={22}/><b>Sektörler</b><small>İşe göre düzenlenen çözümler</small><ArrowRight size={17}/></Link>
          <Link href="/guven"><ShieldCheck size={22}/><b>Güven merkezi</b><small>Mevcut ve planlı kontroller</small><ArrowRight size={17}/></Link>
          <Link href="/pilot"><Gauge size={22}/><b>Ücretli pilot</b><small>6–12 haftada ölçülebilir kanıt</small><ArrowRight size={17}/></Link>
        </div>
      </section>

      <section className="operations-command-section" aria-label="Teksanor operasyon omurgası">
        <div className="operations-command-copy">
          <span className="section-kicker">ÇALIŞAN OPERASYON OMURGASI</span>
          <h2>İşi yalnızca kaydetmeyin; varlıktan bakıma, sahadan maliyete kadar izleyin.</h2>
          <p>Teksanor’un paneli artık ekipman envanteri ve periyodik bakım planlarını da gerçek firma kayıtları olarak tutar. Bakım tamamlandığında sonraki tarih belirlenen sıklığa göre kendiliğinden hesaplanır.</p>
          <div className="operations-command-list">
            <span><Factory size={20}/><b>Varlık envanteri</b><small>Makine, araç, cihaz, konum ve sorumlu kaydı</small></span>
            <span><CalendarCheck2 size={20}/><b>Periyodik bakım</b><small>Kontrol listesi, gecikme ve otomatik yeni tarih</small></span>
            <span><Workflow size={20}/><b>İş emri ve saha</b><small>Görev, ziyaret, bulgu ve operasyon akışı</small></span>
            <span><BarChart3 size={20}/><b>Finansal görünüm</b><small>Ödeme, borç, gider, döviz ve altın karşılığı</small></span>
          </div>
          <Link className="primary-action" href={authenticated ? "/panel#panel=assets" : "/giris"}>Çalışma alanını aç <ArrowRight size={18}/></Link>
        </div>
        <div className="operations-command-visual" aria-label="Operasyon yönetim ekranı örneği">
          <div className="command-top"><span>TEKSANOR / OPERASYON</span><em>CANLI</em></div>
          <div className="command-stats"><article><small>Aktif ekipman</small><b>Envanter</b><i/></article><article><small>Yaklaşan bakım</small><b>Takvim</b><i/></article><article><small>Açık iş emri</small><b>Saha</b><i/></article></div>
          <div className="command-flow">
            <div><span>01</span><b>Varlık tanımlanır</b><small>Kod · konum · sorumlu</small></div>
            <div><span>02</span><b>Bakım planlanır</b><small>Sıklık · liste · tarih</small></div>
            <div><span>03</span><b>Sahada tamamlanır</b><small>Kayıt · geçmiş · yeni tarih</small></div>
          </div>
        </div>
      </section>

      <section className="readiness-mini-strip" aria-label="Teksanor ürün durumu">
        <div>
          <span>Yeni</span>
          <b>Son kaynak kodda operasyon modülleri ve güvenlik sertleştirmeleri işlendi.</b>
          <small>Finans, proje, iş emri, saha, satın alma, CRM, İK, risk ve otomasyon çekirdeği görünür; canlı müşteri öncesi kalan kritik işler ayrı listelenir.</small>
        </div>
        <Link href="/kurumsal-durum">Durumu ve yapılacakları aç <ArrowRight size={16} /></Link>
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

      <PublicMarket />

      <section className="home-agent-section" aria-labelledby="agent-heading">
        <div className="home-agent-copy">
          <span className="section-kicker">İsteğe bağlı yapay zekâ ekibi</span>
          <h2 id="agent-heading">Her departmana sohbet kutusu değil, sınırları yazılı bir çalışma arkadaşı.</h2>
          <p>Finans, proje ve operasyon ekiplerinin tekrar eden takip işlerini inceliyoruz. Ardından yalnızca izin verilen veriyi kullanan, taslağını sorumlu kişiye sunan ve kritik adımlarda insan onayı bekleyen ajan profilleri kuruyoruz.</p>
          <div className="home-agent-actions">
            <Link className="primary-action" href="/yapay-zeka-hizmeti">Ajan çalışma modelini incele <ArrowRight size={18} /></Link>
            <span><ShieldCheck size={17} /> Prototip · İnsan onayı zorunlu</span>
          </div>
        </div>
        <div className="home-agent-visual">
          <img src="/assets/teksanor-digital-twin.webp" alt="Teksanor kontrollü yapay zekâ çalışma katmanı" />
          <div><BrainCircuit size={25} /><span><b>Görev tanımı</b>Net çıktı ve sınır</span></div>
          <div><LockKeyhole size={25} /><span><b>En az erişim</b>Yalnızca gerekli veri</span></div>
          <div><UserRound size={25} /><span><b>İnsan kararı</b>Kritik işlemde onay</span></div>
        </div>
      </section>

      <section className="insights-section" id="icgoruler">
        <div className="insights-preview">
          <div className="insights-heading">
            <div>
              <span className="section-kicker">Teksanor içgörüleri</span>
              <h2>İşletmenin içinden gelen, uygulanabilir fikirler.</h2>
              <p>Yönetim kararlarını etkileyen konuları; saha deneyimi, finansal görünürlük ve mühendislik disipliniyle ele alıyoruz.</p>
            </div>
            <aside>
              <span>YAYIN DOSYASI · 01</span>
              <b>İşletme dönüşümü</b>
              <small>4 kapsamlı inceleme · 35 dakika</small>
            </aside>
          </div>

          <div className="insights-topics" aria-label="İçerik başlıkları">
            <span>İş analizi</span><span>Mühendislik</span><span>Finansal görünürlük</span><span>Süreç tasarımı</span>
          </div>

          <div className="insights-editorial-grid">
            <Link className="insight-feature" href="/icerikler/yapay-zeka-is-analizi">
              <img src="/assets/teksanor-digital-twin.webp" alt="Endüstriyel veri ve iş analizi merkezi" />
              <div className="insight-feature-copy">
                <div><span>YAPAY ZEKÂ · İŞ ANALİZİ</span><small>8 dakika</small></div>
                <b>Yapay zekâ, bir işletmenin gerçek problemini nasıl anlamlandırır?</b>
                <p>İyi bir sistem neden teknoloji seçerek değil, doğru iş sorusunu tanımlayarak başlar?</p>
                <em>İncelemeyi oku <ArrowRight size={16} /></em>
              </div>
            </Link>

            <div className="insight-side-stack">
              <Link className="insight-card insight-engineering" href="/icerikler/muhendislik-danismanligi">
                <img src="/assets/teksanor-engineering-lab.webp" alt="Teksanor mühendislik çalışma ortamı" />
                <div>
                  <span>MÜHENDİSLİK YAKLAŞIMI · 10 DAKİKA</span>
                  <b>Teknoloji yatırımı yapmadan önce hangi sorular sorulmalı?</b>
                  <em>Yazıyı aç <ArrowRight size={15} /></em>
                </div>
              </Link>
              <Link className="insight-card insight-finance" href="/icerikler/veri-karar-destek">
                <div className="insight-card-icon"><BarChart3 size={28} /></div>
                <div>
                  <span>FİNANSAL GÖRÜNÜRLÜK · 9 DAKİKA</span>
                  <b>Dağınık Excel kayıtları yönetim görünümüne nasıl dönüşür?</b>
                  <p>Veriyi yeniden girmeden ortak bir karar ekranı kurmanın temel adımları.</p>
                  <em>Yazıyı aç <ArrowRight size={15} /></em>
                </div>
              </Link>
            </div>

            <Link className="insight-wide" href="/icerikler/surec-otomasyonu">
              <div>
                <span>SÜREÇ TASARIMI · 8 DAKİKA</span>
                <b>Otomasyon nerede başlamalı, insan kararı nerede kalmalı?</b>
                <p>Tekrar eden işi sadeleştirirken yetki, sorumluluk ve kontrol çizgisini kaybetmeyen bir çalışma modeli.</p>
              </div>
              <div className="insight-wide-action"><Workflow size={22} /><ArrowRight size={18} /></div>
            </Link>
          </div>
        </div>
      </section>

      <section className="portal-callout">
        <div>
          <span className="section-kicker">Teksanor Yönetim Portalı</span>
          <h2>Finansal görünürlüğü Excel karmaşasından çıkarın.</h2>
          <p>Ödeme, borç, gider, belge ve dönemsel değişimleri tek panelde yönetin. Kullanıcılar kolayca veri girsin; kritik değişiklikler yönetici kontrolünden geçsin.</p>
        </div>
        <Link className="primary-action" href={authenticated ? "/panel" : "/giris#kayit"}>{authenticated ? "Panele dön" : "14 gün ücretsiz deneyin"} <ArrowRight size={18} /></Link>
      </section>

      <footer className="site-footer">
        <div><img src="/assets/teksanor-logo.png" alt="Teksanor" /><p>Akıllı sistemler. Ölçülebilir ilerleme.</p></div>
        <div className="footer-note">Teksanor, mühendislik ve teknoloji çözümleri için geliştirilen marka kimliğidir. Resmî şirket ve iletişim bilgileri kuruluş süreci tamamlandığında eklenecektir.</div>
        <div className="footer-end">© 2026 Teksanor</div>
      </footer>
    </main>
  );
}
