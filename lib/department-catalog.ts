// Birim iş akışları: her iş biriminin kendine özgü süreçleri, aşamaları, onay sahipleri ve süre hedefleri.
//
// Neden kod içinde bir katalog?
// - Her şirkette İK "işe alım", Satın alma "talep → teklif → sipariş", Kalite "DÖF" gibi süreçler
//   aynı iskeletle yürür. İskeleti kodda sabitlemek, kuralların (kim onaylar, hangi bilgi olmadan
//   ilerlenmez, kaç günde bitmeli) arayüzden atlatılmasını engeller; sunucu her adımda aynı kuralı uygular.
// - Firmaya özel alanlar süreç kaydının `data` alanında tutulur; yeni bir süreç türü eklemek
//   şema değişikliği gerektirmez, yalnız bu kataloğa bir giriş eklenir.
import { EXTRA_TEMPLATES, LINKS } from "./workflow-library";
import type { AccessProfile } from "./access";

export type FieldType = "text" | "textarea" | "date" | "number" | "choice";
export type WorkflowField = { key: string; label: string; type: FieldType; required?: boolean; options?: string[]; hint?: string };
export type WorkflowStage = {
  key: string;
  label: string;
  /** Bu aşamada beklenen iş; kartta ve süreç ayrıntısında gösterilir. */
  todo: string;
  /** Aşamadan ileri geçmek için bu profillerden biri gerekir (onay adımı). Boşsa birimde düzenleme yetkisi yeter. */
  approvers?: AccessProfile[];
  /** Aşamada en fazla kaç gün kalınmalı; aşılırsa "gecikti" sayılır. */
  slaDays?: number;
  /** Bu aşamadan çıkmadan önce doldurulması gereken alanlar. */
  requires?: string[];
};
export type WorkflowTemplate = {
  key: string;
  label: string;
  summary: string;
  /** Çalışanın kendisi başlatabilir (izin, erişim, satın alma talebi gibi). */
  selfService?: boolean;
  fields: WorkflowField[];
  stages: WorkflowStage[];
  /** Son aşamada seçilen sonuç (ör. işe alındı / vazgeçildi). */
  outcomes: string[];
  /** Mevzuat veya iç kural notu; ekranda kısa bilgi olarak gösterilir, hukuki görüş değildir. */
  note?: string;
  /** Süreç ağı: bu süreç kapanınca (isteğe bağlı olarak belirli sonuçlarla) kendiliğinden açılan süreçler. */
  next?: { slug: string; template: string; when?: string[] }[];
};
export type Department = {
  slug: string;
  name: string;
  short: string;
  mission: string;
  /** Bu birimde düzenleme yapabilen uzman profilleri (yönetim profilleri her zaman yapabilir). */
  owners: AccessProfile[];
  /** Mevcut panel modülleri; birim sayfasından kısayol olarak açılır. */
  modules: { id: string; label: string }[];
  templates: WorkflowTemplate[];
};

const MGMT: AccessProfile[] = ["owner", "company_admin", "ceo"];
const LEAD: AccessProfile[] = [...MGMT, "manager"];


export const DEPARTMENTS: Department[] = [
  {
    slug: "yonetim", name: "Yönetim ve strateji", short: "Yönetim", owners: [],
    mission: "Hedefleri, kararları ve birimler arası öncelikleri tek gündemde toplar.",
    modules: [{ id: "overview", label: "Yönetim özeti" }, { id: "reports", label: "Raporlar" }],
    templates: [
      { key: "karar", label: "Yönetim kararı", summary: "Gündeme alınan konunun analizden uygulamaya kadar izlenmesi.",
        fields: [{ key: "konu", label: "Karar konusu", type: "text", required: true }, { key: "etki", label: "Beklenen etki", type: "textarea" }, { key: "karar", label: "Alınan karar", type: "textarea" }],
        stages: [
          { key: "gundem", label: "Gündem", todo: "Konuyu ve karar ihtiyacını yazın.", slaDays: 7 },
          { key: "analiz", label: "Analiz", todo: "Seçenekleri, maliyeti ve riski ekleyin.", slaDays: 14 },
          { key: "karar", label: "Karar", todo: "Yönetim kararı verilir.", approvers: MGMT, requires: ["karar"], slaDays: 7 },
          { key: "uygulama", label: "Uygulama takibi", todo: "Sorumlu ve termin üzerinden izleyin.", slaDays: 30 },
          { key: "kapanis", label: "Kapanış", todo: "Sonucu ve öğrenimi yazın." },
        ], outcomes: ["Uygulandı", "Ertelendi", "Vazgeçildi"] },
      { key: "hedef", label: "Çeyrek hedefi", summary: "Ölçülebilir hedefin belirlenmesi, ara ölçüm ve kapanış.",
        fields: [{ key: "hedef", label: "Hedef", type: "text", required: true }, { key: "olcut", label: "Başarı ölçütü", type: "text", required: true }, { key: "sonuc", label: "Gerçekleşen", type: "text" }],
        stages: [
          { key: "taslak", label: "Taslak", todo: "Hedef ve ölçütü yazın.", slaDays: 10 },
          { key: "onay", label: "Onay", todo: "Üst yönetim hedefi onaylar.", approvers: MGMT, slaDays: 5 },
          { key: "izleme", label: "İzleme", todo: "Ara ölçümleri ekleyin.", slaDays: 90 },
          { key: "degerlendirme", label: "Değerlendirme", todo: "Gerçekleşeni yazıp kapatın.", requires: ["sonuc"] },
        ], outcomes: ["Ulaşıldı", "Kısmen ulaşıldı", "Ulaşılamadı"] },
    ],
  },
  {
    slug: "finans", name: "Finans ve hazine", short: "Finans", owners: ["finance"],
    mission: "Nakit akışını, ödeme taleplerini ve bütçe değişikliklerini kontrollü yürütür.",
    modules: [{ id: "financial", label: "Finans özeti" }, { id: "payments", label: "Ödemeler" }, { id: "treasury", label: "Nakit ve döviz" }],
    templates: [
      { key: "odeme-talebi", label: "Ödeme talebi", summary: "Bir ödemenin talepten ödendi kaydına kadar dört göz ilkesiyle geçişi.", selfService: true,
        fields: [{ key: "alici", label: "Alıcı / tedarikçi", type: "text", required: true }, { key: "tutar", label: "Tutar (TL)", type: "number", required: true }, { key: "vade", label: "Vade", type: "date" }, { key: "dayanak", label: "Dayanak (fatura/sözleşme no)", type: "text" }],
        stages: [
          { key: "talep", label: "Talep", todo: "Talep eden tutarı ve dayanağı yazar.", slaDays: 2, requires: ["dayanak"] },
          { key: "butce", label: "Bütçe kontrolü", todo: "Finans bütçe ve nakit uygunluğunu kontrol eder.", approvers: ["finance", ...MGMT], slaDays: 2 },
          { key: "onay", label: "Yönetici onayı", todo: "Ödeme yetkilisi onaylar.", approvers: MGMT, slaDays: 2 },
          { key: "planlama", label: "Ödeme planı", todo: "Ödeme günü ve hesabı belirlenir.", slaDays: 5 },
          { key: "odendi", label: "Ödendi", todo: "Dekont eklenip kapatılır." },
        ], outcomes: ["Ödendi", "Reddedildi"], note: "Talep eden kişi kendi talebini onaylayamaz (görevler ayrılığı)." },
      { key: "butce-revizyonu", label: "Bütçe revizyonu", summary: "Birim bütçesinde artış veya kaydırma talebi.",
        fields: [{ key: "birim", label: "Birim", type: "text", required: true }, { key: "fark", label: "Değişiklik (TL)", type: "number", required: true }, { key: "gerekce", label: "Gerekçe", type: "textarea", required: true }],
        stages: [
          { key: "talep", label: "Talep", todo: "Gerekçe ve tutar yazılır.", slaDays: 5 },
          { key: "analiz", label: "Finans analizi", todo: "Nakit etkisi hesaplanır.", approvers: ["finance", ...MGMT], slaDays: 5 },
          { key: "karar", label: "Yönetim kararı", todo: "Onay veya ret.", approvers: MGMT, slaDays: 5 },
          { key: "uygulandi", label: "Uygulandı", todo: "Bütçe tablosu güncellenir." },
        ], outcomes: ["Onaylandı", "Reddedildi"] },
    ],
  },
  {
    slug: "muhasebe", name: "Muhasebe ve vergi koordinasyonu", short: "Muhasebe", owners: ["finance"],
    mission: "Belgeleri doğru döneme bağlar, ay sonu kapanışını ve müşavir iletişimini düzenler.",
    modules: [{ id: "expenses", label: "Gelir ve giderler" }, { id: "files", label: "Belgeler" }],
    templates: [
      { key: "ay-sonu", label: "Ay sonu kapanışı", summary: "Belge toplama, mutabakat ve beyan kontrolüyle dönem kapanışı.",
        fields: [{ key: "donem", label: "Dönem (YYYY-AA)", type: "text", required: true }, { key: "eksik", label: "Eksik belgeler", type: "textarea" }, { key: "beyan", label: "Beyan / tahakkuk notu", type: "text" }],
        stages: [
          { key: "belge", label: "Belge toplama", todo: "Fatura, dekont ve masraf fişleri toplanır.", slaDays: 5 },
          { key: "mutabakat", label: "Mutabakat", todo: "Banka ve cari hesaplar karşılaştırılır.", slaDays: 5 },
          { key: "musavir", label: "Müşavire iletim", todo: "Dönem dosyası gönderilir.", slaDays: 3 },
          { key: "beyan", label: "Beyan kontrolü", todo: "Tahakkuklar kontrol edilir.", approvers: ["finance", ...MGMT], requires: ["beyan"], slaDays: 5 },
          { key: "kapandi", label: "Dönem kapandı", todo: "Dönem kilitlenir." },
        ], outcomes: ["Kapandı"], note: "Beyan süreleri her ay değişebilir; güncel takvimi mali müşavirinizle teyit edin." },
      { key: "gelen-fatura", label: "Gelen fatura onayı", summary: "Tedarikçi faturasının sipariş ve teslimle eşleştirilip onaylanması.",
        fields: [{ key: "fatura", label: "Fatura no", type: "text", required: true }, { key: "tedarikci", label: "Tedarikçi", type: "text", required: true }, { key: "tutar", label: "Tutar (TL)", type: "number", required: true }],
        stages: [
          { key: "geldi", label: "Fatura geldi", todo: "Fatura kaydedilir.", slaDays: 1 },
          { key: "eslestirme", label: "Sipariş eşleştirme", todo: "Sipariş ve teslim tutanağıyla karşılaştırılır.", slaDays: 3 },
          { key: "onay", label: "Onay", todo: "Muhasebe onaylar veya itiraz eder.", approvers: ["finance", ...MGMT], slaDays: 2 },
          { key: "kayit", label: "Kayda alındı", todo: "Ödeme planına aktarılır." },
        ], outcomes: ["Onaylandı", "İtiraz edildi"] },
    ],
  },
  {
    slug: "proje", name: "Proje ve mühendislik", short: "Proje", owners: [],
    mission: "Kapsam, teknik teslim ve değişiklikleri kontrollü yönetir.",
    modules: [{ id: "projects", label: "Proje portföyü" }, { id: "tasks", label: "Görevler" }],
    templates: [
      { key: "degisiklik", label: "Değişiklik talebi", summary: "Kapsam, süre veya bütçeyi etkileyen değişikliğin etki analiziyle onaylanması.",
        fields: [{ key: "proje", label: "Proje", type: "text", required: true }, { key: "etki", label: "Süre / bütçe etkisi", type: "textarea" }],
        stages: [
          { key: "talep", label: "Talep", todo: "Değişikliği ve nedenini yazın.", slaDays: 3 },
          { key: "etki", label: "Etki analizi", todo: "Süre, maliyet ve risk etkisini yazın.", requires: ["etki"], slaDays: 5 },
          { key: "onay", label: "Onay", todo: "Proje sahibi veya yönetim onaylar.", approvers: LEAD, slaDays: 3 },
          { key: "uygulama", label: "Uygulama", todo: "Plan güncellenir, iş yapılır.", slaDays: 20 },
          { key: "dogrulama", label: "Doğrulama", todo: "Kabul ölçütü kontrol edilir." },
        ], outcomes: ["Uygulandı", "Reddedildi"] },
    ],
  },
  {
    slug: "operasyon", name: "Operasyon yönetimi", short: "Operasyon", owners: [],
    mission: "Günlük iş emirlerini, saha işlerini ve operasyon aksaklıklarını yönetir.",
    modules: [{ id: "work-orders", label: "İş emirleri" }, { id: "field-visits", label: "Saha ziyaretleri" }, { id: "maintenance", label: "Bakım planı" }],
    templates: [
      { key: "aksaklik", label: "Operasyon aksaklığı", summary: "Hizmeti etkileyen bir aksaklığın bildirimden kök neden kapanışına kadar takibi.", selfService: true,
        fields: [{ key: "yer", label: "Yer / hat", type: "text", required: true }, { key: "etki", label: "Etki", type: "choice", options: ["Düşük", "Orta", "Yüksek"], required: true }, { key: "kok", label: "Kök neden", type: "textarea" }],
        stages: [
          { key: "bildirim", label: "Bildirim", todo: "Ne oldu, nerede, ne zaman?", slaDays: 1 },
          { key: "mudahale", label: "Müdahale", todo: "Geçici çözüm uygulanır.", slaDays: 1 },
          { key: "kok-neden", label: "Kök neden", todo: "Neden tekrarlanmasın?", requires: ["kok"], slaDays: 7 },
          { key: "kapanis", label: "Kapanış", todo: "Kalıcı önlem doğrulanır." },
        ], outcomes: ["Giderildi", "Kalıcı önlem bekliyor"] },
    ],
  },
  {
    slug: "satin-alma", name: "Satın alma ve tedarik", short: "Satın alma", owners: [],
    mission: "İhtiyacı, teklifleri, onayı, siparişi ve teslimi izlenebilir hâle getirir.",
    modules: [{ id: "procurement", label: "Satın alma talepleri" }],
    templates: [
      { key: "talep", label: "Satın alma talebi", summary: "Talepten fatura eşleştirmesine kadar üç teklif ve onay kuralıyla satın alma.", selfService: true,
        fields: [{ key: "urun", label: "Ürün / hizmet", type: "text", required: true }, { key: "miktar", label: "Miktar", type: "text", required: true }, { key: "tahmini", label: "Tahmini tutar (TL)", type: "number" }, { key: "teklifler", label: "Alınan teklifler", type: "textarea", hint: "Tedarikçi – tutar – teslim süresi" }, { key: "secilen", label: "Seçilen tedarikçi", type: "text" }, { key: "siparis", label: "Sipariş no", type: "text" }],
        stages: [
          { key: "talep", label: "Talep", todo: "İhtiyaç ve teknik şart yazılır.", slaDays: 2 },
          { key: "teklif", label: "Teklif toplama", todo: "En az üç teklif istenir.", requires: ["teklifler"], slaDays: 7 },
          { key: "secim", label: "Karşılaştırma", todo: "Fiyat, süre ve kaliteye göre seçilir.", requires: ["secilen"], slaDays: 3 },
          { key: "onay", label: "Onay", todo: "Birim yöneticisi / yönetim onaylar.", approvers: LEAD, slaDays: 3 },
          { key: "siparis", label: "Sipariş", todo: "Sipariş verilir.", requires: ["siparis"], slaDays: 3 },
          { key: "teslim", label: "Teslim alma", todo: "Miktar ve kalite kontrol edilir.", slaDays: 14 },
          { key: "fatura", label: "Fatura eşleştirme", todo: "Fatura sipariş ve teslimle eşleştirilir." },
        ], outcomes: ["Teslim alındı", "İptal edildi"], note: "Talep eden kişi kendi talebini onaylayamaz." },
      { key: "tedarikci", label: "Tedarikçi onayı", summary: "Yeni tedarikçinin belge kontrolü ve değerlendirmeyle onaylı listeye alınması.",
        fields: [{ key: "firma", label: "Firma", type: "text", required: true }, { key: "belgeler", label: "Kontrol edilen belgeler", type: "textarea" }, { key: "puan", label: "Değerlendirme puanı (0–100)", type: "number" }],
        stages: [
          { key: "basvuru", label: "Başvuru", todo: "Firma bilgileri alınır.", slaDays: 5 },
          { key: "belge", label: "Belge kontrolü", todo: "Vergi levhası, yetki belgesi, sertifikalar.", requires: ["belgeler"], slaDays: 5 },
          { key: "degerlendirme", label: "Değerlendirme", todo: "Puanlanır.", requires: ["puan"], slaDays: 5 },
          { key: "onay", label: "Onaylı listeye alma", todo: "Yönetim onayı.", approvers: LEAD },
        ], outcomes: ["Onaylandı", "Reddedildi"] },
    ],
  },
  {
    slug: "satis", name: "Satış ve iş geliştirme", short: "Satış", owners: [],
    mission: "Fırsatları, teklifleri ve indirim onaylarını sözleşmeye kadar yönetir.",
    modules: [{ id: "crm", label: "Müşteriler" }],
    templates: [
      { key: "teklif", label: "Teklif süreci", summary: "Fırsattan kazanılan/kaybedilen sonuca kadar teklif takibi, indirim onayıyla.",
        fields: [{ key: "musteri", label: "Müşteri", type: "text", required: true }, { key: "tutar", label: "Teklif tutarı (TL)", type: "number", required: true }, { key: "indirim", label: "İndirim (%)", type: "number" }, { key: "kayip", label: "Kaybedilme nedeni", type: "text" }],
        stages: [
          { key: "firsat", label: "Fırsat", todo: "İhtiyaç ve karar vericiyi yazın.", slaDays: 7 },
          { key: "hazirlik", label: "Teklif hazırlığı", todo: "Kapsam ve fiyat hazırlanır.", slaDays: 5 },
          { key: "indirim", label: "İndirim onayı", todo: "İndirim varsa yönetici onaylar.", approvers: LEAD, slaDays: 2 },
          { key: "gonderildi", label: "Gönderildi", todo: "Müşteriden dönüş beklenir.", slaDays: 14 },
          { key: "muzakere", label: "Müzakere", todo: "Revizyonlar işlenir.", slaDays: 14 },
          { key: "sonuc", label: "Sonuç", todo: "Kazanıldı veya kaybedildi." },
        ], outcomes: ["Kazanıldı", "Kaybedildi"] },
    ],
  },
  {
    slug: "destek", name: "Müşteri deneyimi ve destek", short: "Destek", owners: [],
    mission: "Şikâyet ve talepleri süre hedefiyle çözer, müşteriye dönüşü kayıt altına alır.",
    modules: [{ id: "crm", label: "Müşteriler" }, { id: "work-orders", label: "İş emirleri" }],
    templates: [
      { key: "sikayet", label: "Şikâyet yönetimi", summary: "Kayıt, sınıflandırma, çözüm ve müşteri teyidiyle kapanış.", selfService: true,
        fields: [{ key: "musteri", label: "Müşteri", type: "text", required: true }, { key: "kanal", label: "Geldiği kanal", type: "choice", options: ["Telefon", "E-posta", "Web", "Yüz yüze", "Sosyal medya"], required: true }, { key: "kategori", label: "Kategori", type: "choice", options: ["Ürün", "Hizmet", "Fatura", "Teslimat", "Diğer"] }, { key: "cozum", label: "Çözüm", type: "textarea" }],
        stages: [
          { key: "kayit", label: "Kayıt", todo: "Müşteriye alındı bilgisi verilir.", slaDays: 1 },
          { key: "siniflandirma", label: "Sınıflandırma", todo: "Kategori ve sorumlu belirlenir.", requires: ["kategori"], slaDays: 1 },
          { key: "cozum", label: "Çözüm", todo: "Çözüm uygulanır.", requires: ["cozum"], slaDays: 5 },
          { key: "teyit", label: "Müşteri teyidi", todo: "Müşteri aranır, memnuniyet sorulur.", slaDays: 3 },
          { key: "kapandi", label: "Kapandı", todo: "Kayıt kapatılır." },
        ], outcomes: ["Çözüldü", "Müşteri haklı değil", "Tazmin edildi"] },
    ],
  },
  {
    slug: "ik", name: "İnsan ve organizasyon", short: "İnsan Kaynakları", owners: ["hr"],
    mission: "İşe alımdan ayrılışa kadar çalışan yaşam döngüsünü, izinleri ve gelişimi yönetir.",
    modules: [{ id: "hr", label: "Çalışan listesi" }, { id: "users", label: "Kullanıcı erişimleri" }],
    templates: [
      { key: "ise-alim", label: "İşe alım", summary: "Kadro talebinden işe başlamaya kadar aday süreci.",
        fields: [{ key: "pozisyon", label: "Pozisyon", type: "text", required: true }, { key: "birim", label: "Birim", type: "text", required: true }, { key: "aday", label: "Seçilen aday (ad soyad)", type: "text" }, { key: "baslama", label: "Başlama tarihi", type: "date" }],
        stages: [
          { key: "kadro", label: "Kadro talebi", todo: "Pozisyon, gerekçe ve bütçe yazılır.", slaDays: 5 },
          { key: "kadro-onay", label: "Kadro onayı", todo: "Yönetim kadroyu onaylar.", approvers: MGMT, slaDays: 5 },
          { key: "ilan", label: "İlan", todo: "İlan yayımlanır, başvurular toplanır.", slaDays: 21 },
          { key: "eleme", label: "Ön eleme", todo: "Özgeçmişler değerlendirilir.", slaDays: 7 },
          { key: "mulakat", label: "Mülakat", todo: "Mülakat notları kaydedilir.", slaDays: 14 },
          { key: "teklif", label: "Teklif", todo: "Seçilen adaya teklif yapılır.", requires: ["aday"], approvers: ["hr", ...MGMT], slaDays: 7 },
          { key: "giris", label: "İşe giriş", todo: "Başlama tarihi kesinleşir; işe giriş süreci açılır.", requires: ["baslama"] },
        ], outcomes: ["İşe alındı", "Aday kabul etmedi", "Kadro iptal"], note: "Aday bilgileri yalnız işe alım amacıyla tutulur; başarısız adayların verisi saklama süresi sonunda silinmelidir." },
      { key: "ise-giris", label: "İşe giriş (oryantasyon)", summary: "Belge, SGK girişi, ekipman, erişim ve deneme süresi.",
        fields: [{ key: "calisan", label: "Çalışan", type: "text", required: true }, { key: "baslama", label: "İşe başlama", type: "date", required: true }, { key: "sgk", label: "SGK giriş bildirgesi verildi mi?", type: "choice", options: ["Evet", "Hayır"] }, { key: "zimmet", label: "Zimmetlenen ekipman", type: "textarea" }],
        stages: [
          { key: "belge", label: "Belge toplama", todo: "Sözleşme, kimlik, diploma, sağlık raporu.", slaDays: 3 },
          { key: "sgk", label: "SGK girişi", todo: "İşe başlamadan önce sigorta girişi yapılır.", requires: ["sgk"], approvers: ["hr", ...MGMT], slaDays: 1 },
          { key: "ekipman", label: "Ekipman ve erişim", todo: "Bilgisayar, kart, hesaplar verilir.", requires: ["zimmet"], slaDays: 2 },
          { key: "oryantasyon", label: "Oryantasyon", todo: "İSG eğitimi ve birim tanıtımı.", slaDays: 7 },
          { key: "deneme", label: "Deneme süresi", todo: "Deneme süresi sonunda değerlendirme.", slaDays: 60 },
        ], outcomes: ["Kadroya alındı", "Deneme süresinde ayrıldı"], note: "SGK işe giriş bildirgesi kural olarak çalışma başlamadan verilir." },
      { key: "izin", label: "İzin talebi", summary: "Yıllık, mazeret veya ücretsiz izin talebi ve onayı.", selfService: true,
        fields: [{ key: "tur", label: "İzin türü", type: "choice", options: ["Yıllık", "Mazeret", "Ücretsiz", "Rapor"], required: true }, { key: "baslangic", label: "Başlangıç", type: "date", required: true }, { key: "bitis", label: "Bitiş", type: "date", required: true }, { key: "vekil", label: "Yerine bakacak kişi", type: "text" }],
        stages: [
          { key: "talep", label: "Talep", todo: "Tarihleri ve vekili yazın.", slaDays: 1 },
          { key: "yonetici", label: "Yönetici onayı", todo: "Birim yöneticisi onaylar.", approvers: [...LEAD, "hr"], slaDays: 2 },
          { key: "ik", label: "İK kaydı", todo: "İzin bakiyesinden düşülür.", approvers: ["hr", ...MGMT], slaDays: 2 },
          { key: "tamam", label: "Tamamlandı", todo: "Takvime işlendi." },
        ], outcomes: ["Kullanıldı", "Reddedildi", "Geri çekildi"] },
      { key: "ayrilis", label: "İşten ayrılış", summary: "Bildirimden SGK çıkışı ve ibranameye kadar.",
        fields: [{ key: "calisan", label: "Çalışan", type: "text", required: true }, { key: "son-gun", label: "Son çalışma günü", type: "date", required: true }, { key: "zimmet-iade", label: "Zimmet iadesi tamam mı?", type: "choice", options: ["Evet", "Hayır"] }, { key: "erisim", label: "Hesaplar kapatıldı mı?", type: "choice", options: ["Evet", "Hayır"] }],
        stages: [
          { key: "bildirim", label: "Bildirim", todo: "Fesih türü ve son gün yazılır.", slaDays: 2 },
          { key: "devir", label: "İş devri", todo: "Açık işler devredilir.", slaDays: 10 },
          { key: "zimmet", label: "Zimmet iadesi", todo: "Ekipman teslim alınır.", requires: ["zimmet-iade"], slaDays: 3 },
          { key: "erisim", label: "Erişim kapatma", todo: "Tüm hesaplar son gün kapatılır.", requires: ["erisim"], slaDays: 1 },
          { key: "cikis", label: "SGK çıkış ve hesap", todo: "Çıkış bildirgesi, son bordro, ibraname.", approvers: ["hr", ...MGMT] },
        ], outcomes: ["Ayrıldı"] },
      { key: "performans", label: "Performans değerlendirme", summary: "Öz değerlendirme, yönetici görüşmesi ve gelişim planı.",
        fields: [{ key: "calisan", label: "Çalışan", type: "text", required: true }, { key: "donem", label: "Dönem", type: "text", required: true }, { key: "plan", label: "Gelişim planı", type: "textarea" }],
        stages: [
          { key: "oz", label: "Öz değerlendirme", todo: "Çalışan formu doldurur.", slaDays: 7 },
          { key: "yonetici", label: "Yönetici değerlendirmesi", todo: "Yönetici görüşme yapar.", approvers: [...LEAD, "hr"], slaDays: 7 },
          { key: "plan", label: "Gelişim planı", todo: "Eğitim ve hedefler yazılır.", requires: ["plan"], slaDays: 7 },
          { key: "kapandi", label: "Kapandı", todo: "Çalışanla paylaşıldı." },
        ], outcomes: ["Beklentinin üstünde", "Beklentiyi karşılıyor", "Gelişim gerekli"] },
    ],
  },
  {
    slug: "bt", name: "Bilgi teknolojileri ve güvenlik", short: "Bilgi İşlem", owners: ["it"],
    mission: "Erişim taleplerini, cihazları ve güvenlik olaylarını kayıt altında yönetir.",
    modules: [{ id: "users", label: "Kullanıcılar" }, { id: "assets", label: "Varlıklar" }, { id: "readiness", label: "Sistem durumu" }],
    templates: [
      { key: "erisim", label: "Erişim talebi", summary: "Bir sisteme yetki talebinin yönetici onayıyla tanımlanması.", selfService: true,
        fields: [{ key: "sistem", label: "Sistem / uygulama", type: "text", required: true }, { key: "yetki", label: "İstenen yetki", type: "text", required: true }, { key: "bitis", label: "Geçici ise bitiş tarihi", type: "date" }],
        stages: [
          { key: "talep", label: "Talep", todo: "Sistem ve gerekçe yazılır.", slaDays: 1 },
          { key: "onay", label: "Yönetici onayı", todo: "Birim yöneticisi gerekliliği onaylar.", approvers: LEAD, slaDays: 2 },
          { key: "tanimlama", label: "Tanımlama", todo: "Bilgi işlem yetkiyi verir.", approvers: ["it", ...MGMT], slaDays: 2 },
          { key: "dogrulama", label: "Doğrulama", todo: "Kullanıcı erişimi teyit eder." },
        ], outcomes: ["Verildi", "Reddedildi"], note: "En az yetki ilkesi: yalnız görev için gerekli yetki verilir." },
      { key: "olay", label: "Güvenlik olayı", summary: "Tespit, sınırlama, inceleme ve kişisel veri ihlali değerlendirmesi.", selfService: true,
        fields: [{ key: "tespit", label: "Ne tespit edildi?", type: "textarea", required: true }, { key: "kisisel-veri", label: "Kişisel veri etkilendi mi?", type: "choice", options: ["Hayır", "Evet", "Belirsiz"] }, { key: "kurul", label: "Kurul bildirimi notu", type: "text" }],
        stages: [
          { key: "tespit", label: "Tespit", todo: "Olay kaydedilir, zaman damgası alınır.", slaDays: 1 },
          { key: "sinirlama", label: "Sınırlama", todo: "Hesap kapatma, ağ izolasyonu.", slaDays: 1 },
          { key: "inceleme", label: "İnceleme", todo: "Kapsam ve kök neden.", requires: ["kisisel-veri"], slaDays: 2 },
          { key: "kvkk", label: "KVKK değerlendirmesi", todo: "Kişisel veri varsa bildirim kararı verilir.", approvers: MGMT, slaDays: 1 },
          { key: "kapanis", label: "Kapanış", todo: "Önlemler ve öğrenimler yazılır." },
        ], outcomes: ["Kapatıldı", "Kurula bildirildi"], note: "Kişisel veri ihlalinde Kurul'a bildirim için öngörülen süre 72 saattir; süreyi tespit anından izleyin." },
    ],
  },
  {
    slug: "hukuk", name: "Hukuk ve uyum", short: "Hukuk", owners: [],
    mission: "Sözleşme incelemesini ve kişisel veri başvurularını süreli olarak yürütür.",
    modules: [{ id: "risks", label: "Risk kaydı" }, { id: "files", label: "Belgeler" }],
    templates: [
      { key: "sozlesme", label: "Sözleşme inceleme", summary: "Talepten imza ve yenileme takibine kadar sözleşme.", selfService: true,
        fields: [{ key: "karsi-taraf", label: "Karşı taraf", type: "text", required: true }, { key: "tur", label: "Sözleşme türü", type: "text", required: true }, { key: "bitis", label: "Bitiş / yenileme tarihi", type: "date" }],
        stages: [
          { key: "talep", label: "Talep", todo: "Taslak ve ticari koşullar eklenir.", slaDays: 2 },
          { key: "inceleme", label: "Hukuki inceleme", todo: "Riskli maddeler işaretlenir.", slaDays: 5 },
          { key: "revizyon", label: "Revizyon", todo: "Karşı tarafla müzakere.", slaDays: 10 },
          { key: "onay", label: "Onay", todo: "İmza yetkilisi onaylar.", approvers: MGMT, slaDays: 3 },
          { key: "imza", label: "İmza ve arşiv", todo: "İmzalı nüsha arşive, bitiş tarihi takvime.", requires: ["bitis"] },
        ], outcomes: ["İmzalandı", "Vazgeçildi"] },
      { key: "kvkk-basvuru", label: "KVKK ilgili kişi başvurusu", summary: "Kişinin verisine ilişkin başvurusunun 30 gün içinde yanıtlanması.",
        fields: [{ key: "basvuru-tarihi", label: "Başvuru tarihi", type: "date", required: true }, { key: "talep", label: "Talep türü", type: "choice", options: ["Bilgi", "Düzeltme", "Silme", "İtiraz", "Diğer"], required: true }, { key: "yanit", label: "Yanıt özeti", type: "textarea" }],
        stages: [
          { key: "basvuru", label: "Başvuru", todo: "Başvuru kaydedilir.", slaDays: 2 },
          { key: "kimlik", label: "Kimlik doğrulama", todo: "Başvuranın kimliği doğrulanır.", slaDays: 5 },
          { key: "inceleme", label: "İnceleme", todo: "Veriler ve talep incelenir.", slaDays: 15 },
          { key: "yanit", label: "Yanıt", todo: "Yazılı yanıt gönderilir.", requires: ["yanit"], approvers: MGMT, slaDays: 8 },
          { key: "kapandi", label: "Kapandı", todo: "Kayıt arşivlenir." },
        ], outcomes: ["Kabul", "Kısmi kabul", "Ret"], note: "6698 sayılı Kanun md. 13: başvuru en geç 30 gün içinde sonuçlandırılır." },
    ],
  },
  {
    slug: "kalite", name: "Kalite ve risk yönetimi", short: "Kalite", owners: [],
    mission: "Uygunsuzlukları düzeltici faaliyetle kapatır, iç denetimleri yürütür.",
    modules: [{ id: "risks", label: "Risk kaydı" }],
    templates: [
      { key: "dof", label: "Düzeltici faaliyet (DÖF)", summary: "Uygunsuzluktan etkinlik doğrulamasına kadar.", selfService: true,
        fields: [{ key: "uygunsuzluk", label: "Uygunsuzluk", type: "textarea", required: true }, { key: "kok", label: "Kök neden", type: "textarea" }, { key: "aksiyon", label: "Aksiyon planı", type: "textarea" }, { key: "etkinlik", label: "Etkinlik kontrolü sonucu", type: "text" }],
        stages: [
          { key: "tespit", label: "Tespit", todo: "Uygunsuzluk tanımlanır.", slaDays: 2 },
          { key: "kok", label: "Kök neden", todo: "5 Neden / balık kılçığı.", requires: ["kok"], slaDays: 7 },
          { key: "plan", label: "Aksiyon planı", todo: "Sorumlu ve termin.", requires: ["aksiyon"], approvers: LEAD, slaDays: 5 },
          { key: "uygulama", label: "Uygulama", todo: "Aksiyonlar yapılır.", slaDays: 30 },
          { key: "etkinlik", label: "Etkinlik doğrulama", todo: "Sorun tekrarlandı mı?", requires: ["etkinlik"] },
        ], outcomes: ["Etkin", "Etkin değil, yeniden açıldı"] },
      { key: "denetim", label: "İç denetim", summary: "Plan, saha, bulgu ve rapor.",
        fields: [{ key: "kapsam", label: "Kapsam", type: "text", required: true }, { key: "bulgular", label: "Bulgular", type: "textarea" }],
        stages: [
          { key: "plan", label: "Plan", todo: "Kapsam ve tarih.", slaDays: 10 },
          { key: "saha", label: "Saha denetimi", todo: "Kanıt toplanır.", slaDays: 5 },
          { key: "bulgu", label: "Bulgular", todo: "Bulgular yazılır; gerekirse DÖF açılır.", requires: ["bulgular"], slaDays: 5 },
          { key: "rapor", label: "Rapor", todo: "Yönetime sunulur.", approvers: LEAD },
        ], outcomes: ["Bulgu yok", "Bulgular DÖF'e aktarıldı"] },
    ],
  },
  {
    slug: "arge", name: "Ar-Ge ve inovasyon", short: "Ar-Ge", owners: [],
    mission: "Fikirleri deney ve prototiple doğrular; fikri hakları ve destek başvurularını yönetir.",
    modules: [{ id: "projects", label: "Proje portföyü" }],
    templates: [
      { key: "fikir", label: "Fikirden prototipe", summary: "Fikir, ön değerlendirme, deney, prototip ve devam/durdur kararı.", selfService: true,
        fields: [{ key: "problem", label: "Çözülecek problem", type: "textarea", required: true }, { key: "olcut", label: "Başarı ölçütü", type: "text" }, { key: "sonuc", label: "Deney sonucu", type: "textarea" }],
        stages: [
          { key: "fikir", label: "Fikir", todo: "Problemi ve fikri yazın.", slaDays: 7 },
          { key: "on-degerlendirme", label: "Ön değerlendirme", todo: "Ölçüt ve kaynak ihtiyacı.", requires: ["olcut"], approvers: LEAD, slaDays: 7 },
          { key: "deney", label: "Deney", todo: "Sınırlı deney yapılır.", slaDays: 30 },
          { key: "prototip", label: "Prototip", todo: "Çalışan örnek hazırlanır.", slaDays: 45 },
          { key: "karar", label: "Karar", todo: "Devam, durdur veya projeye dönüştür.", requires: ["sonuc"], approvers: MGMT },
        ], outcomes: ["Projeye dönüştü", "Durduruldu", "Ertelendi"] },
      { key: "patent", label: "Fikri mülkiyet başvurusu", summary: "Buluş bildiriminden başvuru takibine kadar.",
        fields: [{ key: "bulus", label: "Buluş özeti", type: "textarea", required: true }, { key: "arastirma", label: "Ön araştırma sonucu", type: "textarea" }, { key: "basvuru-no", label: "Başvuru no", type: "text" }],
        stages: [
          { key: "bildirim", label: "Buluş bildirimi", todo: "Buluşu yapan bildirir.", slaDays: 10 },
          { key: "arastirma", label: "Ön araştırma", todo: "Benzerlik araştırması.", requires: ["arastirma"], slaDays: 20 },
          { key: "hazirlik", label: "Başvuru hazırlığı", todo: "Vekille dosya hazırlanır.", approvers: MGMT, slaDays: 30 },
          { key: "basvuru", label: "Başvuru yapıldı", todo: "Başvuru numarası kaydedilir.", requires: ["basvuru-no"], slaDays: 5 },
          { key: "takip", label: "Takip", todo: "İnceleme ve itirazlar." },
        ], outcomes: ["Tescil edildi", "Reddedildi", "Geri çekildi"] },
      { key: "destek", label: "Destek programı başvurusu", summary: "Kamu veya özel destek çağrısına proje başvurusu.",
        fields: [{ key: "program", label: "Program / çağrı", type: "text", required: true }, { key: "son-tarih", label: "Son başvuru tarihi", type: "date", required: true }, { key: "butce", label: "Proje bütçesi (TL)", type: "number" }],
        stages: [
          { key: "cagri", label: "Çağrı inceleme", todo: "Uygunluk koşulları okunur.", slaDays: 5 },
          { key: "oneri", label: "Proje önerisi", todo: "Amaç, yöntem, iş paketleri.", slaDays: 20 },
          { key: "butce", label: "Bütçe", todo: "Personel, alet, hizmet giderleri.", requires: ["butce"], approvers: ["finance", ...MGMT], slaDays: 7 },
          { key: "basvuru", label: "Başvuru", todo: "Sisteme yüklenir.", slaDays: 3 },
          { key: "sonuc", label: "Değerlendirme", todo: "Sonuç beklenir." },
        ], outcomes: ["Desteklendi", "Desteklenmedi"] },
    ],
  },
];

// Genişletilmiş kütüphaneyi ve süreç ağını birimlere ekle.
for (const dep of DEPARTMENTS) {
  for (const t of EXTRA_TEMPLATES[dep.slug] ?? []) {
    if (dep.templates.some((x) => x.key === t.key)) throw new Error(`Yinelenen süreç anahtarı: ${dep.slug}/${t.key}`);
    dep.templates.push(t);
  }
}
for (const [from, links] of Object.entries(LINKS)) {
  const [slug, key] = from.split("/");
  const t = DEPARTMENTS.find((d) => d.slug === slug)?.templates.find((x) => x.key === key);
  if (!t) throw new Error(`Süreç ağında bilinmeyen kaynak: ${from}`);
  t.next = links.map((l) => { const [s2, k2] = l.to.split("/"); return { slug: s2, template: k2, ...(l.when ? { when: l.when } : {}) }; });
}
/** Bir süreç verilen sonuçla kapanınca açılması gereken süreçler. */
export function followUpsFor(template: WorkflowTemplate, outcome: string) {
  return (template.next ?? []).filter((n) => !n.when || n.when.includes(outcome));
}
/** Bu sürece hangi süreçlerden gelinir (ağ görünümü için). */
export function triggeredBy(slug: string, key: string) {
  const out: { slug: string; template: string; label: string; when?: string[] }[] = [];
  for (const d of DEPARTMENTS) for (const t of d.templates) for (const n of t.next ?? []) if (n.slug === slug && n.template === key) out.push({ slug: d.slug, template: t.key, label: t.label, when: n.when });
  return out;
}

export function departmentBySlug(slug: string) { return DEPARTMENTS.find((d) => d.slug === slug) ?? null; }
export function templateOf(dep: Department, key: string) { return dep.templates.find((t) => t.key === key) ?? null; }

/** Yönetim profilleri tüm birimleri; uzman profiller kendi birimlerini; birim yöneticisi kendi birimini yönetir. */
export function departmentRole(profile: AccessProfile, memberDepartment: string | null, dep: Department): "manage" | "member" | "none" {
  if (MGMT.includes(profile)) return "manage";
  if (dep.owners.includes(profile)) return "manage";
  if (profile === "manager" && memberDepartment === dep.name) return "manage";
  if (memberDepartment === dep.name) return "member";
  // Herkes, çalışan talebi (self-service) açılan birimlere talep gönderebilir.
  return dep.templates.some((t) => t.selfService) ? "member" : "none";
}

export class WorkflowError extends Error { constructor(message: string, readonly status = 400) { super(message); } }

export function cleanData(template: WorkflowTemplate, input: unknown, previous: Record<string, string> = {}) {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const out: Record<string, string> = { ...previous };
  for (const key of Object.keys(raw)) if (!template.fields.some((f) => f.key === key)) throw new WorkflowError("Bilinmeyen alan gönderildi.");
  for (const field of template.fields) {
    if (!(field.key in raw)) continue;
    const value = String(raw[field.key] ?? "").trim().slice(0, field.type === "textarea" ? 2000 : 200);
    if (!value) { delete out[field.key]; continue; }
    if (field.type === "number") { const n = Number(value.replace(/\./g, "").replace(",", ".")); if (!Number.isFinite(n) || n < 0) throw new WorkflowError(`${field.label} geçerli bir sayı olmalı.`); }
    if (field.type === "date" && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value + "T00:00:00Z")))) throw new WorkflowError(`${field.label} geçerli bir tarih olmalı.`);
    if (field.type === "choice" && !field.options?.includes(value)) throw new WorkflowError(`${field.label} için listeden seçim yapın.`);
    out[field.key] = value;
  }
  return out;
}

export function missingForStage(template: WorkflowTemplate, stageKey: string, data: Record<string, string>) {
  const stage = template.stages.find((s) => s.key === stageKey);
  return (stage?.requires ?? []).filter((k) => !data[k]).map((k) => template.fields.find((f) => f.key === k)?.label ?? k);
}

export function daysBetween(fromIso: string, to = new Date()) {
  const from = new Date(fromIso.includes("T") ? fromIso : fromIso.replace(" ", "T") + "Z");
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 86400000));
}

export function isOverdue(p: { status: string; stage_entered_at: string; due_date?: string | null; stage_key: string }, template: WorkflowTemplate | null, now = new Date()) {
  if (p.status !== "active" && p.status !== "blocked") return false;
  if (p.due_date && p.due_date < now.toISOString().slice(0, 10)) return true;
  const sla = template?.stages.find((s) => s.key === p.stage_key)?.slaDays;
  return !!sla && daysBetween(p.stage_entered_at, now) > sla;
}

export const departmentSchema = [
  `CREATE TABLE IF NOT EXISTS department_processes (
    id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, department_slug TEXT NOT NULL, template_key TEXT NOT NULL,
    title TEXT NOT NULL, stage_key TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','blocked','done','cancelled')),
    priority TEXT NOT NULL DEFAULT 'normal' CHECK(priority IN ('low','normal','high','critical')),
    owner_name TEXT, requester_id TEXT NOT NULL, requester_name TEXT, due_date TEXT, data TEXT NOT NULL DEFAULT '{}',
    outcome TEXT, blocked_reason TEXT, version INTEGER NOT NULL DEFAULT 1,
    stage_entered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, closed_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS department_process_events (
    id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, process_id TEXT NOT NULL REFERENCES department_processes(id),
    action TEXT NOT NULL, from_stage TEXT, to_stage TEXT, actor_id TEXT NOT NULL, actor_name TEXT, note TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  "CREATE INDEX IF NOT EXISTS idx_dept_proc_org ON department_processes(organization_id, department_slug, status)",
  "CREATE INDEX IF NOT EXISTS idx_dept_proc_events ON department_process_events(process_id, created_at)",
];
