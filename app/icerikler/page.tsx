import Link from "next/link";
import { ArrowRight } from "lucide-react";

export const metadata = {
  title: "Teksanor İçgörüleri | Mühendislik, Veri ve Yapay Zekâ Yazıları",
  description: "Mühendislik, veri analitiği ve yapay zekânın işletme problemlerinde nasıl değer ürettiğini anlatan özgün içerikler.",
};

const articles = [
  { href: "/icerikler/yapay-zeka-is-analizi", kicker: "YAPAY ZEKÂ · İŞ ANALİZİ", title: "Yapay zekâ bir işletmenin gerçek problemini nasıl anlamlandırır?", minutes: 8 },
  { href: "/icerikler/veri-karar-destek", kicker: "FİNANSAL GÖRÜNÜRLÜK", title: "Dağınık Excel kayıtları yönetim görünümüne nasıl dönüşür?", minutes: 9 },
  { href: "/icerikler/muhendislik-danismanligi", kicker: "MÜHENDİSLİK YAKLAŞIMI", title: "Teknoloji yatırımı yapmadan önce hangi sorular sorulmalı?", minutes: 10 },
  { href: "/icerikler/surec-otomasyonu", kicker: "SÜREÇ OTOMASYONU", title: "Manuel takip yükü kontrollü dijital akışlara nasıl taşınır?", minutes: 8 },
];

export default function Page() {
  return (
    <main className="corporate-page">
      <header className="corporate-header">
        <Link href="/"><img src="/assets/teksanor-logo.png" alt="Teksanor" /></Link>
        <nav>
          <Link href="/cozumler">Çözümler</Link>
          <Link href="/muhendislik">Mühendislik</Link>
          <Link href="/yapay-zeka">Yapay Zekâ</Link>
          <Link href="/hakkimizda">Hakkımızda</Link>
        </nav>
        <Link className="corporate-login" href="/giris">Portala giriş <ArrowRight size={16} /></Link>
      </header>
      <section className="insights-section" style={{ paddingTop: 48 }}>
        <div className="insights-preview">
          <span className="section-kicker">Teksanor içgörüleri</span>
          <h2>Teknolojiyi değil, dönüşen işi anlatıyoruz.</h2>
          <p>Mühendislik, veri ve yapay zekânın işletme problemlerinde nasıl değer ürettiğini özgün içeriklerle ele alıyoruz.</p>
          <div className="insights-preview-grid">
            {articles.map((article) => (
              <Link key={article.href} href={article.href}>
                <span>{article.kicker}</span>
                <b>{article.title}</b>
                <em>{article.minutes} dakikalık yazıyı oku <ArrowRight size={15} /></em>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <footer className="corporate-footer"><img src="/assets/teksanor-logo.png" alt="Teksanor" /><span>© 2026 Teksanor · Mühendislik, veri ve yapay zekâ</span></footer>
    </main>
  );
}
