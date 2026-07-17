"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  BrainCircuit,
  CheckCircle2,
  LockKeyhole,
  Settings2,
  UserRound,
  Workflow,
} from "lucide-react";

const solutions = [
  {
    icon: Settings2,
    title: "Otomasyon",
    text: "Tekrarlanan işleri azaltan, insan kontrolünü koruyan akıllı süreçler.",
  },
  {
    icon: BrainCircuit,
    title: "Yapay zekâ",
    text: "Belge, veri ve iş akışlarını anlamlandıran kontrollü karar desteği.",
  },
  {
    icon: BarChart3,
    title: "Veri analizi",
    text: "Dağınık verileri anlaşılır göstergelere ve yönetilebilir raporlara dönüştürün.",
  },
  {
    icon: Workflow,
    title: "Kurumsal yazılım",
    text: "Projeleri, görevleri, belgeleri ve ekipleri tek çalışma alanında yönetin.",
  },
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
    <main className="tn-home">
      <header className="tn-nav">
        <Link href="/" aria-label="Teksanor ana sayfa">
          <img className="tn-logo" src="/assets/teksanor-logo.png" alt="Teksanor" />
        </Link>

        <nav className="tn-menu" aria-label="Ana menü">
          <a href="#cozumler">Çözümler</a>
          <Link href="/muhendislik">Mühendislik</Link>
          <Link href="/yapay-zeka">Yapay Zekâ</Link>
          <Link href="/hakkimizda">Hakkımızda</Link>
        </nav>

        <Link className="tn-login" href={authenticated ? "/panel" : "/giris"}>
          <UserRound size={16} />
          {authenticated ? "Panele Git" : "Giriş Yap"}
          <ArrowRight size={15} />
        </Link>
      </header>

      <section className="tn-hero">
        <div className="tn-grid" aria-hidden="true" />

        <div className="tn-copy">
          <span className="tn-kicker">Mühendislik · Yapay zekâ · Veri</span>
          <h1>
            İş yükünü azaltan
            <span>mühendislik platformu.</span>
          </h1>
          <p>
            Teksanor; projeleri, görevleri, belgeleri, finansal görünümü ve ekip çalışmasını tek merkezde
            birleştirir. Şirketlerin daha hızlı, daha düzenli ve daha ölçülebilir çalışmasını sağlar.
          </p>

          <div className="tn-actions">
            <a className="tn-primary" href="#platform">
              Platformu İncele <ArrowRight size={17} />
            </a>
            <Link className="tn-secondary" href="/giris?mode=register">
              <LockKeyhole size={16} /> Ücretsiz Deneyin
            </Link>
          </div>

          <div className="tn-proof">
            <span><CheckCircle2 size={16} /> Proje odaklı</span>
            <span><CheckCircle2 size={16} /> Ölçülebilir</span>
            <span><CheckCircle2 size={16} /> Güvenli</span>
          </div>
        </div>

        <div className="tn-brand-stage" aria-label="Teksanor mühendislik sistemi">
          <div className="tn-ring tn-ring-a" />
          <div className="tn-ring tn-ring-b" />
          <img src="/assets/teksanor-brand.png" alt="Teksanor amblemi" />
          <div className="tn-float tn-float-a">
            <b>Proje merkezi</b>
            <small>Görev · ekip · belge</small>
          </div>
          <div className="tn-float tn-float-b">
            <b>Akıllı karar desteği</b>
            <small>Veri · analiz · rapor</small>
          </div>
        </div>
      </section>

      <section className="tn-solutions" id="cozumler">
        <div className="tn-section-head">
          <div>
            <span>Çözüm alanları</span>
            <h2>Tek platform. Daha az yük. Daha güçlü kararlar.</h2>
          </div>
          <p>
            Teksanor, şirketin günlük işlerini çoğaltmak yerine sadeleştirir. Kullanıcılar projelerini yürütür,
            yöneticiler ise süreci gerçek zamanlı olarak izler.
          </p>
        </div>

        <div className="tn-solution-list">
          {solutions.map(({ icon: Icon, title, text }) => (
            <article className="tn-solution" key={title}>
              <Icon size={25} />
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="tn-platform" id="platform">
        <div>
          <span className="tn-kicker">Teksanor yönetim sistemi</span>
          <h2>Projeler yalnızca listelenmez; gerçekten yönetilir.</h2>
          <p>
            Her proje için görevler, sorumlular, belgeler, takvim, ilerleme oranı ve raporlar aynı çalışma
            alanında tutulur. Böylece şirket içinde bilgi kaybı ve gereksiz iş yükü azalır.
          </p>

          <div className="tn-points">
            <div>
              <b>Proje ve görev yönetimi</b>
              <small>Takvim, sorumlu, öncelik ve ilerleme tek ekranda.</small>
            </div>
            <div>
              <b>Belge ve rapor merkezi</b>
              <small>PDF, Excel ve teknik dokümanlar proje ile ilişkilendirilir.</small>
            </div>
            <div>
              <b>Yönetim görünümü</b>
              <small>Geciken işler ve kritik karar noktaları anında görünür.</small>
            </div>
          </div>
        </div>

        <div className="tn-preview" aria-label="Teksanor panel ön izlemesi">
          <div className="tn-preview-top">
            <span>TEKSANOR / YÖNETİM MERKEZİ</span>
            <span>Canlı görünüm</span>
          </div>
          <div className="tn-preview-grid">
            <div className="tn-preview-card">
              <span>Aktif projeler</span>
              <strong>12</strong>
            </div>
            <div className="tn-preview-card">
              <span>Tamamlanan görevler</span>
              <strong>86%</strong>
            </div>
            <div className="tn-preview-card wide">
              <span>Aylık proje ilerlemesi</span>
              <div className="tn-bars" aria-hidden="true">
                <i /><i /><i /><i />
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="tn-footer">
        <div>
          <img src="/assets/teksanor-logo.png" alt="Teksanor" />
          <span>Mühendislik zekâsı. Ölçülebilir ilerleme.</span>
        </div>
        <span>© 2026 Teksanor</span>
      </footer>
    </main>
  );
}
