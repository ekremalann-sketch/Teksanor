import type { Metadata } from "next";

export const SITE_URL = "https://teksanor.pages.dev";
export const SITE_NAME = "Teksanor";
const OG_IMAGE = { url: "/og/teksanor-og.png", width: 1200, height: 630, alt: "Teksanor saha servis, bakım ve operasyon platformu" };

/** Sayfa başlığı, açıklaması, kanonik adresi ve paylaşım kartı (Open Graph / X). */
export function pageMeta(title: string, description: string, path: string, options: { index?: boolean } = {}): Metadata {
  const index = options.index ?? true;
  return {
    title,
    description,
    alternates: { canonical: path },
    robots: index ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: { type: "website", locale: "tr_TR", siteName: SITE_NAME, url: path, title: `${title} | ${SITE_NAME}`, description, images: [OG_IMAGE] },
    twitter: { card: "summary_large_image", title: `${title} | ${SITE_NAME}`, description, images: [OG_IMAGE.url] },
  };
}

/** Herkese açık, arama motorlarına açılacak sayfalar (sitemap.xml ile aynı liste). */
export const PUBLIC_PAGES: Array<{ path: string; title: string; description: string }> = [
  { path: "/", title: "Saha servis, bakım ve operasyon platformu", description: "Teknik servis, bakım ve mühendislik ekipleri için iş emri, teklif ve müşteri onayı, saha kaydı, tahsilat ve rol bazlı yönetim panelini tek çalışma alanında birleştiren ürün prototipi." },
  { path: "/platform", title: "Platform", description: "Sahadaki işi merkezdeki karara bağlayan tek çalışma alanı: servis masası, varlık ve bakım, proje, finans ve rol bazlı erişim." },
  { path: "/cozumler", title: "Çözümler", description: "İşletmeler için ölçülebilir teknoloji çözümleri: servis, bakım, proje ve finans süreçlerinin tek operasyon görünümünde yönetimi." },
  { path: "/sektorler", title: "Sektörler", description: "Teknik servis, bakım-onarım ve mühendislik-taahhüt ekipleri için işin doğasına göre düzenlenmiş süreçler." },
  { path: "/sektorler/teknik-servis", title: "Teknik servis yazılımı", description: "Teknik servis operasyonunu ilk talepten müşteri onaylı kapanışa ve tahsilata kadar tek kayıt zincirinde yönetin." },
  { path: "/sektorler/bakim-onarim", title: "Bakım ve onarım yönetimi", description: "Periyodik bakım takvimini ekipman geçmişi, sorumlu ve sonraki bakım tarihiyle birlikte yönetin." },
  { path: "/sektorler/muhendislik-taahhut", title: "Mühendislik ve taahhüt", description: "Proje, saha, satın alma ve bütçeyi aynı ilerleme görünümünde birleştirin." },
  { path: "/entegrasyonlar", title: "Entegrasyonlar", description: "Kur, dosya, API ve bildirim bağlantıları; her bağlantının durumu ve veri yönü açıkça gösterilir, çalışmayan bağlantı hazırmış gibi sunulmaz." },
  { path: "/guven", title: "Güven merkezi", description: "Verinin nerede işlendiği, kimin erişebildiği, hangi güvenlik kontrollerinin uygulandığı ve hangilerinin henüz tamamlanmadığı." },
  { path: "/kurumsal-durum", title: "Ürün durumu ve yol haritası", description: "Teksanor'un çalışan modülleri, açık riskleri, pilot öncesi yapılacakları ve hazırlık yol haritası." },
  { path: "/pilot", title: "Kontrollü pilot", description: "Büyük sözleşmeden önce gerçek işte kanıtlanan, 6–12 haftalık sınırlı kapsamlı pilot modeli." },
  { path: "/fiyatlandirma", title: "Fiyatlandırma", description: "Fiyat, kullanıcı sayısından önce çözülen işin kapsamına göre belirlenir: pilot, operasyon ve kurumsal kapsam." },
  { path: "/muhendislik", title: "Mühendislik yaklaşımı", description: "Problemi doğru tanımlayan, uygulanabilir ve ölçülebilir sistemler." },
  { path: "/yapay-zeka", title: "Yapay zekâ ve veri", description: "İnsan kontrolünü koruyan yapay zekâ ve veri çözümleri; bağlantı yoksa özellik açıkça etiketlenir." },
  { path: "/yapay-zeka-hizmeti", title: "Yapay zekâ ajanları", description: "Ekibin yerine karar veren değil, ekibin dikkatini doğru işe taşıyan operasyon ajanları." },
  { path: "/hakkimizda", title: "Hakkımızda", description: "Mühendislik disipliniyle geliştirilen Teksanor ürününün yaklaşımı ve ilkeleri." },
  { path: "/yardim", title: "Yardım", description: "Teksanor'u kullanmadan önce bilinmesi gerekenler: hesap, roller, servis akışı ve veri güvenliği." },
  { path: "/icerikler/yapay-zeka-is-analizi", title: "Yapay zekâ bir işletmenin problemini nasıl anlamlandırır?", description: "Yapay zekâyı işletme problemine uygularken veri, karar sahibi ve insan kontrolü nasıl tasarlanır." },
  { path: "/icerikler/veri-karar-destek", title: "Dağınık Excel kayıtları yönetim görünümüne nasıl dönüşür?", description: "Dağınık tablolardan güvenilir bir yönetim görünümüne geçişte kayıt kaynağı, eksik veri ve doğrulama." },
  { path: "/icerikler/surec-otomasyonu", title: "Süreç otomasyonu ne zaman hız kazandırır?", description: "Otomasyonun hız kazandırdığı ve karmaşa ürettiği durumlar; önce süreci netleştirmek." },
  { path: "/icerikler/muhendislik-danismanligi", title: "Teknoloji yatırımından önce sorulacak sorular", description: "Teknoloji yatırımı yapmadan önce kapsam, sorumluluk, veri ve ölçüm soruları." },
];

export function metaFor(path: string) {
  const page = PUBLIC_PAGES.find((item) => item.path === path);
  if (!page) throw new Error(`SEO kaydı yok: ${path}`);
  return pageMeta(page.title, page.description, page.path);
}

/** Arama motorları için kuruluş ve yazılım tanımı (JSON-LD). */
export function structuredData() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", "@id": `${SITE_URL}/#org`, name: SITE_NAME, url: SITE_URL, logo: `${SITE_URL}/assets/teksanor-logo.png`, sameAs: ["https://github.com/ekremalann-sketch/Teksanor"] },
      { "@type": "SoftwareApplication", name: "Teksanor Kurumsal Operasyon Platformu", applicationCategory: "BusinessApplication", operatingSystem: "Web", url: SITE_URL, inLanguage: "tr", publisher: { "@id": `${SITE_URL}/#org` }, description: PUBLIC_PAGES[0].description },
    ],
  };
}
