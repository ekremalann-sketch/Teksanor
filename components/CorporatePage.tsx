import type { AnchorHTMLAttributes } from "react";
import { ArrowRight, BarChart3, BrainCircuit, CheckCircle2, Cpu, Database, Settings2, ShieldCheck, Workflow } from "lucide-react";

function Link({ href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return <a href={href} {...props} />;
}

const content = {
  cozumler: { kicker: "Çözüm portföyü", title: "İşletmeler için ölçülebilir teknoloji çözümleri.", text: "Dağınık verileri, manuel takip yükünü ve karar gecikmelerini azaltan sistemleri ihtiyaca göre tasarlarız.", cards: [["Finansal yönetim", "Borç, gider, nakit ve belgeleri tek görünümde izleyin."], ["Veri analitiği", "Excel ve operasyon verilerini anlaşılır göstergelere dönüştürün."], ["Süreç otomasyonu", "Tekrarlanan işleri kontrollü dijital akışlara taşıyın."], ["Kurumsal portal", "Her firma için ayrılmış güvenli çalışma alanı oluşturun."]] },
  muhendislik: { kicker: "Mühendislik yaklaşımı", title: "Problemi doğru tanımlayan, uygulanabilir sistemler.", text: "Teknoloji seçiminden süreç tasarımına kadar her adımı güvenlik, sürdürülebilirlik ve gerçek iş ihtiyacı üzerinden değerlendiririz.", cards: [["İhtiyaç analizi", "Mevcut süreci, veri kaynaklarını ve darboğazları belirleriz."], ["Sistem tasarımı", "Büyümeye uygun teknik ve operasyonel yapı kurarız."], ["Uygulama", "Çözümü küçük, ölçülebilir ve test edilebilir adımlarla hayata geçiririz."], ["Sürekli iyileştirme", "Kullanım verileriyle sistemi düzenli olarak geliştiririz."]] },
  yapayzeka: { kicker: "Yapay zekâ ve veri", title: "İnsan kontrolünü koruyan yapay zekâ çözümleri.", text: "Yapay zekâyı gösteriş için değil; bilgiye daha hızlı ulaşmak, tekrarları azaltmak ve karar kalitesini yükseltmek için kullanırız.", cards: [["Akıllı analiz", "Veri içindeki eğilimleri ve dikkat gerektiren alanları görünür kılın."], ["Belge işleme", "Dağınık belgeleri ve tabloları düzenli kayıtlara dönüştürün."], ["Karar desteği", "Açıklanabilir göstergelerle yöneticilerin karar sürecini güçlendirin."], ["Kontrollü otomasyon", "Kritik işlemlerde insan onayını ve izlenebilirliği koruyun."]] },
  hakkimizda: { kicker: "Teksanor hakkında", title: "Mühendislik disipliniyle geliştirilen teknoloji markası.", text: "Teksanor; işletmelerin süreçlerini daha anlaşılır, izlenebilir ve verimli hâle getirmeyi amaçlayan mühendislik, veri ve yapay zekâ odaklı bir teknoloji girişimidir.", cards: [["Misyon", "Karmaşık teknolojileri işletmeler için sade ve uygulanabilir hâle getirmek."], ["Çalışma ilkesi", "Doğrulanabilir bilgi, ölçülebilir sonuç ve açık iletişim."], ["Güvenlik", "Firma bazlı veri ayrımı ve rol temelli erişim yaklaşımı."], ["Gelişim", "İhtiyaca göre büyüyen, sürdürülebilir ürünler tasarlamak."]] },
} as const;

export default function CorporatePage({ type }: { type: keyof typeof content }) {
  const page = content[type];
  const icons = [BarChart3, Database, Workflow, ShieldCheck];
  return <main className="corporate-page">
    <header className="corporate-header"><Link href="/"><img src="/assets/teksanor-logo.png" alt="Teksanor" /></Link><nav><Link href="/cozumler">Çözümler</Link><Link href="/muhendislik">Mühendislik</Link><Link href="/yapay-zeka">Yapay Zekâ</Link><Link href="/hakkimizda">Hakkımızda</Link></nav><Link className="corporate-login" href="/giris">Portala giriş <ArrowRight size={16} /></Link></header>
    <section className="corporate-hero"><img src="/assets/teksanor-engineering-lab.webp" alt="Teksanor mühendislik ve akıllı üretim laboratuvarı" /><div><span>{page.kicker}</span><h1>{page.title}</h1><p>{page.text}</p><Link href="/giris?mode=register">Ücretsiz deneyin <ArrowRight size={17} /></Link></div></section>
    <section className="corporate-values">{page.cards.map(([title, text], index) => { const Icon = icons[index]; return <article key={title}><Icon size={24} /><span>0{index + 1}</span><h2>{title}</h2><p>{text}</p></article>; })}</section>
    <section className="corporate-process"><div><span>Teksanor çalışma modeli</span><h2>Önce ekibinizi dinler, sonra çalışan sistemi birlikte kurarız.</h2></div><ol><li><CheckCircle2 />İhtiyacı ve başarı ölçüsünü birlikte netleştiririz</li><li><Settings2 />İşe uyan en sade sistemi tasarlarız</li><li><Cpu />Gerçek senaryolarla test edip kontrollü biçimde açarız</li><li><BrainCircuit />Kullanım verisini izler, gerekli iyileştirmeyi planlarız</li></ol></section>
    <footer className="corporate-footer"><img src="/assets/teksanor-logo.png" alt="Teksanor" /><span>© 2026 Teksanor · Mühendislik, veri ve yapay zekâ</span></footer>
  </main>;
}
