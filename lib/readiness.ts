export type ReadinessStatus = "done" | "partial" | "planned" | "blocked";
export type ReadinessPriority = "critical" | "high" | "medium" | "low";

export const readinessSnapshot = {
  version: "2026-09-06-pilot-v3",
  title: "Teksanor ürün durumu, güvenlik ve pilot hazırlık özeti",
  summary: "Son kaynak kodda finans, proje, görev, iş emri, saha ziyareti, varlık envanteri, periyodik bakım, satın alma, CRM, İK, risk, otomasyon ve ajan sohbeti çekirdeği eklendi. Kurumsal canlı satış için kimlik güvenliği, yedek dönüş, ödeme/faturalama ve KVKK seti hâlâ tamamlanmalıdır.",
  stats: [
    { label: "Çalışan çekirdek", value: "13+ akış", note: "Finans, proje, görev, saha, varlık, bakım, satın alma, CRM, İK, risk, otomasyon ve ajan sohbeti" },
    { label: "Departman gerçekliği", value: "Kayıt düzeyi", note: "Birçok departman artık veri modeli + API + panel ekranı seviyesine çıkarıldı" },
    { label: "Güvenlik uygulandı", value: "Başlık + Origin", note: "CSP/HSTS, cross-site mutation kontrolü ve dosya imza kontrolü eklendi" },
    { label: "Canlı satış kararı", value: "Pilot sonrası", note: "MFA, e-posta doğrulama, parola kurtarma, yedek ve sözleşme seti kapanmadan açık müşteri alınmaz" },
  ],
} as const;

export const workingModules = [
  { name: "Kullanıcı kaydı, giriş ve çıkış", status: "done" as ReadinessStatus, note: "PBKDF2-SHA256 + benzersiz salt, session cookie ve rate limit var." },
  { name: "Çok firmalı çalışma alanı", status: "partial" as ReadinessStatus, note: "organization_id ile satır bazlı izolasyon var; otomatik test kapsamı genişletildi ama kurumsal seviyede daha fazla test gerekir." },
  { name: "Finans ve hazine", status: "done" as ReadinessStatus, note: "Ödeme, borç, gider, nakit, manuel kur, dönem özeti ve altın/döviz referansı aktif." },
  { name: "Proje ve görev yönetimi", status: "done" as ReadinessStatus, note: "Proje kartı, görev, durum, öncelik, bütçe ve ilerleme akışı panelde çalışır." },
  { name: "İş emri ve saha ziyareti", status: "partial" as ReadinessStatus, note: "İş emri ve ziyaret kaydı var; fotoğraf kanıtı/versiyon/onay bağları daha da güçlendirilmeli." },
  { name: "Varlık envanteri ve periyodik bakım", status: "done" as ReadinessStatus, note: "Ekipman kodu, konum, sorumlu, durum, bakım sıklığı ve otomatik sonraki bakım tarihi çalışır." },
  { name: "Satın alma, CRM, İK ve risk", status: "partial" as ReadinessStatus, note: "Temel kayıt, listeleme, durum ve silme/güncelleme akışları var; ileri raporlama ve entegrasyonlar sonraki faz." },
  { name: "Dosya yükleme", status: "partial" as ReadinessStatus, note: "R2 yükleme, boyut, MIME, uzantı ve magic-byte kontrolü var; gerçek AV/karantina servisi ayrı faz." },
  { name: "Excel/CSV içe aktarma", status: "done" as ReadinessStatus, note: "xlsx kaldırıldı; ExcelJS + Türkçe para/ondalık parser kullanılır." },
  { name: "Otomasyon ve yapay zekâ ajanları", status: "partial" as ReadinessStatus, note: "Ajan sohbeti ve otomatik özet var; bağlantı yoksa açıkça etiketlenmiş kayıt özeti gösterilir." },
] as const;

export const criticalBacklog = [
  { priority: "critical" as ReadinessPriority, title: "Hesap güvenliği bağlantılarının canlı doğrulanması", impact: "Admin hesabı ele geçirilirse kurumsal veri riske girer.", exit: "MFA isteğe bağlı kurulur; e-posta bağlantıları gerçek test hesabında doğrulanır." },
  { priority: "critical" as ReadinessPriority, title: "Kurumsal test paketi", impact: "Çok modüllü panelde küçük bir API hatası müşteri güvenini bozar.", exit: "Tenant izolasyonu, rol yetkisi, iş emri, saha ziyareti, dosya yükleme ve finans akışları otomatik testtedir." },
  { priority: "high" as ReadinessPriority, title: "Dosya karantina ve zararlı içerik taraması", impact: "Magic-byte kontrolü iyi başlangıçtır ama antivirüs değildir.", exit: "Şüpheli dosya R2'ye kalıcı yazılmadan karantinaya alınır veya reddedilir." },
  { priority: "high" as ReadinessPriority, title: "D1/R2 yedekleme ve geri yükleme tatbikatı", impact: "Yedek almak ile geri dönebilmek aynı şey değildir.", exit: "Aylık geri dönüş denemesi, süre ve sorumlu kişiyle kayıt altına alınır." },
  { priority: "high" as ReadinessPriority, title: "Faturalama ve abonelik yönetimi", impact: "Plan/trial alanı var ama tahsilat, yenileme ve fatura akışı ürünleşmeden gelir takibi elle kalır.", exit: "iyzico/Stripe veya fatura tabanlı kurumsal billing akışı test edilir." },
  { priority: "medium" as ReadinessPriority, title: "KVKK ve sözleşme seti", impact: "Kurumsal müşteri ürün kadar veri işleme ve olay müdahale sürecini de satın alır.", exit: "Aydınlatma metni, veri işleme eki, saklama-imha ve ihlal müdahale planı hazırdır." },
  { priority: "medium" as ReadinessPriority, title: "Mobil/PWA saha kullanımı", impact: "Saha ekipleri masaüstü panelden çok mobil ve düşük sürtünmeli ekran ister.", exit: "İş emri, ziyaret ve fotoğraf kanıtı mobilde hızlı kaydedilir." },
] as const;

export const roadmapPhases = [
  { period: "0-30 gün", title: "Güvenlik ve doğrulama", items: ["MFA/e-posta/parola kurtarma", "CSP/HSTS ve Origin kontrolünün doğrulanması", "ExcelJS + dosya imzası + parser testleri", "Tenant, rol ve finans testlerinin genişletilmesi"] },
  { period: "30-60 gün", title: "Operasyonel güven", items: ["D1/R2 geri yükleme provası", "Dosya karantina/AV entegrasyonu", "İş emri-fotoğraf-belge ilişkisinin güçlendirilmesi", "KVKK ve sözleşme seti"] },
  { period: "60-90 gün", title: "Ücretli pilot", items: ["Tek dikeyde 3 müşteri", "6-12 haftalık sınırlı kapsam", "Rapor süresi, eksik kayıt, geciken iş ve kullanıcı kabulü ölçümü", "Pilot sonrası yıllık sözleşme kararı"] },
] as const;

export const departmentReality = [
  { name: "Finans ve Hazine", state: "Çalışıyor", detail: "Ödeme, borç, gider, nakit, kur ve dönem özeti panelde çalışır." },
  { name: "Proje, görev, operasyon ve saha", state: "Temel çalışıyor", detail: "Proje, görev, iş emri ve saha ziyareti kayıtları artık ayrı API ve ekranlara bağlandı." },
  { name: "Varlık ve bakım yönetimi", state: "Çalışıyor", detail: "Makine, araç ve cihaz envanteri; sorumlu, durum ve periyodik bakım tarihleriyle firma bazında tutulur." },
  { name: "Satın alma, müşteri, İK, risk ve otomasyon", state: "Kayıt düzeyi", detail: "Listeleme, yeni kayıt ve durum akışları var; ileri entegrasyon ve raporlama sonraki fazdır." },
  { name: "Muhasebe, satış sözleşmeleri, mühendislik dokümanları, hukuk ve BT", state: "Vizyon/entegrasyon", detail: "Tam modül değil; mevcut kayıt altyapısına bağlanacak ayrı ürün fazlarıdır." },
] as const;

export function statusLabel(status: ReadinessStatus) {
  return status === "done" ? "Çalışıyor" : status === "partial" ? "Kısmi" : status === "planned" ? "Planlı" : "Engelli";
}

export function priorityLabel(priority: ReadinessPriority) {
  return priority === "critical" ? "Acil" : priority === "high" ? "Yüksek" : priority === "medium" ? "Orta" : "Düşük";
}
