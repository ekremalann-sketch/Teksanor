import Link from "next/link";
import { ArrowRight, CheckCircle2, CircleDashed, PlugZap, ShieldCheck } from "lucide-react";
import { PublicPage } from "@/components/PublicShell";
import { metaFor } from "@/lib/seo";

export const metadata = metaFor("/kurumsal-durum");

// Müşteriye dönük ürün durumu: hazır olan, bağlantıyla açılan ve yol haritasındaki özellikler ayrı gösterilir.
const ready = [
  ["Servis yönetimi", "Talep, teklif, müşteri onayı ve imza, saha kontrol listesi, iş raporu ve tahsilat takibi."],
  ["Bakım ve varlık", "Ekipman envanteri, periyodik bakım planı ve bir sonraki bakım tarihinin otomatik hesaplanması."],
  ["Operasyon", "İş emri, görev, saha ziyareti, satın alma, müşteri ve risk kayıtları."],
  ["Finans görünümü", "Ödeme, borç, gider, nakit ve dönem özetleri; Excel ile içe ve dışa aktarma."],
  ["Birimler", "İK, bilgi işlem, satın alma ve diğer birimler için onaylı süreç akışları."],
  ["Yetki ve kayıt", "Firma bazlı veri ayrımı, rol bazlı erişim ve her değişiklik için işlem geçmişi."],
];

const connected = [
  ["Belge depolama", "Dosya yükleme, kurumunuzun depolama alanı ve virüs taraması bağlandığında açılır."],
  ["Yapay zekâ asistanı", "Kurumunuz onayladığında etkinleşir; kişisel veriler gönderilmeden önce maskelenir."],
  ["E-posta bildirimleri", "Hesap kurtarma ve hatırlatma e-postaları, e-posta hizmeti tanımlandığında gönderilir."],
];

const roadmap = ["e-Fatura (özel entegratör üzerinden)", "SMS bildirimi", "Rota ve harita planlama", "Mağaza uygulaması (bugün tarayıcıdan, ana ekrana eklenerek kullanılır)"];

export default function ProductStatusPage() {
  return (
    <PublicPage>
      <section className="enterprise-section status-hero">
        <span className="enterprise-kicker">Ürün durumu</span>
        <h1>Neyin hazır, neyin bağlantıyla açıldığını açıkça gösteriyoruz.</h1>
        <p>Teksanor, teknik servis, bakım ve mühendislik ekipleri için kurulmuş bir operasyon platformudur. Kurumunuza özel kullanım, kısa bir pilot ve bağlantı kontrolleriyle başlar.</p>
        <div className="enterprise-cta-row">
          <Link className="enterprise-primary" href="/pilot">Pilot görüşmesi planlayın <ArrowRight size={17} /></Link>
          <Link className="enterprise-secondary" href="/guven">Güven merkezi</Link>
        </div>
      </section>

      <section className="enterprise-section">
        <div className="enterprise-heading"><span className="enterprise-kicker">Kullanıma hazır</span><h2>Bugün çalışan modüller</h2></div>
        <div className="status-grid">
          {ready.map(([title, text]) => <article key={title}><CheckCircle2 size={20} aria-hidden="true" /><h3>{title}</h3><p>{text}</p></article>)}
        </div>
      </section>

      <section className="enterprise-section">
        <div className="enterprise-heading"><span className="enterprise-kicker">Bağlantıyla açılır</span><h2>Kurumunuzun hizmetiyle etkinleşenler</h2></div>
        <div className="status-grid">
          {connected.map(([title, text]) => <article key={title}><PlugZap size={20} aria-hidden="true" /><h3>{title}</h3><p>{text}</p></article>)}
        </div>
      </section>

      <section className="enterprise-section">
        <div className="enterprise-heading"><span className="enterprise-kicker">Yol haritası</span><h2>Sıradaki geliştirmeler</h2></div>
        <ul className="status-roadmap">{roadmap.map((item) => <li key={item}><CircleDashed size={18} aria-hidden="true" />{item}</li>)}</ul>
        <p className="status-note"><ShieldCheck size={17} aria-hidden="true" /> Entegratör veya mesaj sağlayıcısı bağlanmadan resmî fatura ya da mesaj gönderilmez; ekranlar bu durumu her zaman açıkça belirtir.</p>
      </section>
    </PublicPage>
  );
}
