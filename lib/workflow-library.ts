// Genişletilmiş süreç kütüphanesi ve süreç ağı.
//
// Kısa yazım (her satır bir süreç):
//   [anahtar, ad, özet, aşamalar, alanlar?, sonuçlar?, seçenekler?]
//   aşamalar: "Ad|ne yapılır|gün|onay|zorunluAlan" ifadeleri ";" ile ayrılır.
//     onay kodu: M = yönetim, L = yönetim + birim yöneticisi, F = finans + yönetim,
//                H = İK + yönetim, I = bilgi işlem + yönetim, LH = birim yöneticisi + İK + yönetim
//   alanlar: "anahtar:Etiket:tür:!" ifadeleri ";" ile ayrılır ( ! = zorunlu; tür: text|textarea|date|number|choice=a/b/c )
//   seçenekler: "self" = çalışan kendisi başlatabilir
//
// Süreç ağı (LINKS): bir süreç belirli bir sonuçla kapanınca hangi birimde hangi sürecin
// kendiliğinden açılacağını tanımlar. Örnek: İK'da işe alım "İşe alındı" ile kapanınca İK'da işe giriş,
// Bilgi İşlem'de yeni çalışan kurulumu ve İK'da zimmet teslimi açılır.
import type { AccessProfile } from "./access";
import type { WorkflowField, WorkflowStage, WorkflowTemplate } from "./department-catalog";

const M: AccessProfile[] = ["owner", "company_admin", "ceo"];
const CODES: Record<string, AccessProfile[]> = {
  M, L: [...M, "manager"], F: ["finance", ...M], H: ["hr", ...M], I: ["it", ...M], LH: [...M, "manager", "hr"],
};
const DEFAULT_FIELDS = "konu:Konu:text:!;aciklama:Açıklama:textarea";

function fields(spec: string): WorkflowField[] {
  return spec.split(";").map((part) => {
    const [key, label, rawType = "text", req] = part.split(":").map((s) => s.trim());
    const [type, options] = rawType.startsWith("choice=") ? ["choice", rawType.slice(7).split("/")] : [rawType, undefined];
    return { key, label, type: type as WorkflowField["type"], required: req === "!", ...(options ? { options } : {}) };
  });
}
function stages(spec: string): WorkflowStage[] {
  return spec.split(";").map((part) => {
    const [label, todo, sla, approver, requires] = part.split("|").map((s) => s.trim());
    const key = label.toLocaleLowerCase("tr-TR").replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s").replace(/ö/g, "o").replace(/ç/g, "c").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return { key, label, todo, ...(sla ? { slaDays: Number(sla) } : {}), ...(approver ? { approvers: CODES[approver] } : {}), ...(requires ? { requires: requires.split(",") } : {}) };
  });
}
type Row = [string, string, string, string, string?, string?, string?];
function build(rows: Row[]): WorkflowTemplate[] {
  return rows.map(([key, label, summary, st, f, outcomes, opts]) => ({
    key, label, summary, stages: stages(st), fields: fields(f || DEFAULT_FIELDS),
    outcomes: (outcomes || "Tamamlandı;İptal edildi").split(";"), ...(opts?.includes("self") ? { selfService: true } : {}),
  }));
}

export const EXTRA_TEMPLATES: Record<string, WorkflowTemplate[]> = {
  yonetim: build([
    ["stratejik-plan", "Stratejik plan güncellemesi", "Yıllık hedeflerin birimlerle birlikte gözden geçirilmesi.", "Taslak|Birim hedefleri toplanır|14;Görüş|Birimler görüş yazar|10;Onay|Yönetim onaylar|7|M;Duyuru|Ekibe duyurulur|5"],
    ["kurul-toplantisi", "Yönetim kurulu toplantısı", "Gündem, sunum, karar ve tutanak.", "Gündem|Gündem maddeleri toplanır|7;Sunum|Raporlar hazırlanır|5;Toplantı|Kararlar yazılır|1|M|karar;Tutanak|Tutanak imzaya gider|3", "konu:Toplantı:text:!;tarih:Tarih:date:!;karar:Alınan kararlar:textarea"],
    ["yatirim", "Yatırım kararı", "Araç, makine veya yeni şube gibi yatırımın fizibiliteyle onayı.", "Talep|Gerekçe yazılır|5;Fizibilite|Maliyet ve geri dönüş hesaplanır|14|F|tutar;Karar|Yönetim karar verir|7|M;Uygulama|Satın alma başlatılır|30", "konu:Yatırım:text:!;tutar:Tutar (TL):number;geri-donus:Geri dönüş süresi (ay):number", "Onaylandı;Reddedildi;Ertelendi"],
    ["politika", "Şirket politikası onayı", "Yeni veya güncellenen politikanın görüş ve onayla yayımlanması.", "Taslak|Metin hazırlanır|10;Hukuk görüşü|Mevzuata uygunluk|7;Onay|Yönetim onaylar|5|M;Yayım|Çalışanlara duyurulur|3"],
    ["kriz", "Kriz toplantısı", "Ciddi olayda ilk 24 saatin koordinasyonu.", "Toplantı|Durum değerlendirmesi|1;Eylem planı|Sorumlular atanır|1|M;İletişim|Müşteri ve ekip bilgilendirilir|1;Takip|Önlemler izlenir|14"],
  ]),
  finans: build([
    ["avans", "Avans talebi", "Çalışanın iş avansı talebi ve kapanışı.", "Talep|Tutar ve gerekçe|1;Yönetici onayı|Birim yöneticisi onaylar|2|L;Ödeme|Finans öder|2|F;Kapama|Harcama belgeleriyle kapanır|30", "konu:Amaç:text:!;tutar:Tutar (TL):number:!", "Kapandı;Reddedildi", "self"],
    ["masraf", "Masraf iadesi", "Çalışanın cebinden yaptığı iş harcamasının iadesi.", "Talep|Fiş ve fatura eklenir|3;Yönetici onayı|Gerçekten iş harcaması mı?|2|L;Finans kontrolü|Belge ve tutar kontrolü|3|F;Ödeme|Hesaba yatırılır|5", "konu:Harcama:text:!;tutar:Tutar (TL):number:!;tarih:Harcama tarihi:date", "Ödendi;Reddedildi", "self"],
    ["nakit-tahmin", "Haftalık nakit tahmini", "Önümüzdeki 4 haftanın giriş ve çıkışlarının tahmini.", "Veri|Tahsilat ve ödemeler toplanır|2;Tahmin|Tablo hazırlanır|1;Yönetim notu|Açık varsa önlem önerilir|1|M"],
    ["kredi", "Kredi başvurusu", "Banka kredisi için teklif toplama ve onay.", "İhtiyaç|Tutar ve vade belirlenir|5;Teklif|Bankalardan teklif alınır|10|F|teklifler;Karar|Yönetim seçer|5|M;Kullanım|Sözleşme ve kullandırım|10", "konu:Amaç:text:!;tutar:Tutar (TL):number:!;teklifler:Banka teklifleri:textarea", "Kullanıldı;Vazgeçildi"],
    ["teminat", "Teminat mektubu talebi", "İhale veya sözleşme için teminat mektubu.", "Talep|Kurum, tutar, süre|2;Onay|Finans onaylar|2|F;Banka|Banka başvurusu|5;Teslim|Mektup ilgili kuruma verilir|3", "konu:Kurum:text:!;tutar:Tutar (TL):number:!;bitis:Bitiş tarihi:date"],
    ["tahsilat", "Vadesi geçen alacak takibi", "Geciken tahsilatın hatırlatma, görüşme ve hukuka devir adımları.", "Hatırlatma|Müşteriye yazılı hatırlatma|3;Görüşme|Ödeme planı konuşulur|7;Plan|Ödeme planı onayı|3|F;Takip|Taksitler izlenir|30", "konu:Müşteri:text:!;tutar:Alacak (TL):number:!;vade:Vade:date", "Tahsil edildi;Hukuka devredildi;Silindi"],
  ]),
  muhasebe: build([
    ["banka-mutabakat", "Banka mutabakatı", "Banka hareketleri ile kayıtların aylık karşılaştırılması.", "Ekstre|Ekstreler indirilir|2;Eşleştirme|Hareketler eşleştirilir|3;Fark|Farklar açıklanır|3|F|fark;Kapanış|Mutabakat onaylanır|2", "konu:Dönem:text:!;fark:Fark açıklaması:textarea"],
    ["cari-mutabakat", "Cari hesap mutabakatı", "Müşteri ve tedarikçilerle bakiye mutabakatı.", "Mektup|Mutabakat mektubu gönderilir|3;Yanıt|Karşı taraf yanıtı|10;Fark|Farklar düzeltilir|5|F;Kapanış|Mutabık kalındı|2", "konu:Cari:text:!;bakiye:Bakiye (TL):number"],
    ["kdv", "KDV beyanı hazırlığı", "Ayın faturalarının kontrolü ve müşavire iletimi.", "Toplama|Alış ve satış faturaları|5;Kontrol|Eksik ve hatalı fatura|3;Onay|Finans onaylar|2|F;İletim|Müşavire gönderilir|2", "konu:Dönem:text:!", "Beyan edildi"],
    ["demirbas", "Demirbaş kaydı", "Yeni alınan demirbaşın kayıt ve amortismana alınması.", "Fatura|Fatura eşleşir|3;Kayıt|Demirbaş kartı açılır|3;Etiket|Etiket ve zimmet|5", "konu:Demirbaş:text:!;tutar:Tutar (TL):number;seri:Seri no:text"],
    ["fatura-iptal", "Fatura iptal ve iade", "Hatalı kesilen faturanın iptali veya iade faturası.", "Talep|Hata ve neden|1;Onay|Finans onaylar|2|F;İşlem|İptal veya iade faturası|2;Bildirim|Müşteriye bilgi|1", "konu:Fatura no:text:!;neden:Neden:textarea:!"],
    ["sayim", "Yıl sonu envanter sayımı", "Stok ve demirbaşların sayımı ve farkların kaydı.", "Plan|Sayım ekipleri ve tarih|10;Sayım|Fiili sayım|3;Fark|Kayıt ile fark|5|F;Kapanış|Tutanak imzalanır|3"],
  ]),
  proje: build([
    ["baslatma", "Proje başlatma", "Kapsam, ekip, bütçe ve takvimin onaylanıp projenin açılması.", "Tanım|Amaç ve kapsam|7;Ekip|Proje ekibi atanır|5;Bütçe|Bütçe onayı|5|F;Açılış|Toplantı yapılır|3", "konu:Proje:text:!;butce:Bütçe (TL):number;bitis:Hedef bitiş:date"],
    ["kilometre", "Kilometre taşı onayı", "Ara teslimin kabul ölçütüne göre onayı.", "Teslim|Teslim edilen iş|3;İnceleme|Kabul ölçütleri|5;Onay|Proje sahibi onaylar|3|L"],
    ["kapanis", "Proje kapanışı", "Teslim, maliyet karşılaştırması ve çıkarılan dersler.", "Teslim|Son teslim|5;Maliyet|Bütçe ile karşılaştırma|5|F;Dersler|Neler iyi, neler kötü|7;Arşiv|Belgeler arşivlenir|3", "konu:Proje:text:!;dersler:Çıkarılan dersler:textarea"],
    ["kaynak", "Kaynak talebi", "Projeye ek kişi veya ekipman talebi.", "Talep|İhtiyaç ve süre|2;Değerlendirme|Diğer projelere etkisi|3|L;Atama|Kaynak atanır|3"],
    ["eskalasyon", "Risk eskalasyonu", "Projede çözülemeyen riskin yönetime taşınması.", "Bildirim|Risk ve etkisi|1;Analiz|Seçenekler|3;Karar|Yönetim karar verir|2|M;Uygulama|Önlem uygulanır|10"],
  ]),
  operasyon: build([
    ["sicak-calisma", "Sıcak çalışma izni", "Kaynak, kesme gibi işler için iş güvenliği izni.", "Talep|Yer, saat, ekip|1;Risk|Yangın önlemleri kontrol|1|L|kontrol;İzin|İzin verilir|1;Kapanış|İş sonrası alan kontrolü|1", "konu:İş:text:!;yer:Yer:text:!;kontrol:Alınan önlemler:textarea", "Tamamlandı;İzin verilmedi", "self"],
    ["arac", "Araç bakım ve arıza", "Servis aracının bakım, arıza ve muayene takibi.", "Bildirim|Arıza veya bakım zamanı|1;Servis|Servise gider|5;Onay|Masraf onayı|2|L;Teslim|Araç teslim alınır|2", "konu:Araç:text:!;km:Kilometre:number;masraf:Masraf (TL):number", "Tamamlandı", "self"],
    ["depo-sayim", "Depo sayımı", "Yedek parça deposunun aylık sayımı.", "Sayım|Raflar sayılır|2;Fark|Kayıtla fark|2;Onay|Fark onayı|2|L"],
    ["yeni-bolge", "Yeni hizmet bölgesi açılışı", "Yeni il veya ilçede servis vermeye başlama.", "Analiz|Talep ve rakip|14;Plan|Ekip, araç, depo|14|M;Hazırlık|İşe alım ve satın alma|30;Açılış|İlk müşteriler|14", "konu:Bölge:text:!;butce:Bütçe (TL):number"],
    ["musteri-devreye", "Yeni müşteriyi devreye alma", "Sözleşmesi imzalanan müşterinin cihaz envanteri ve bakım takvimi.", "Keşif|Cihazlar yerinde görülür|7;Envanter|Cihaz kartları açılır|5;Takvim|Bakım planı yazılır|3|L;İlk ziyaret|İlk bakım yapılır|14", "konu:Müşteri:text:!;cihaz:Cihaz sayısı:number"],
    ["periyodik-bakim", "Periyodik bakım turu", "Aylık bakım turunun planlanması ve raporlanması.", "Plan|Rota ve ekip|3;Saha|Ziyaretler|10;Rapor|Formlar kontrol edilir|3|L"],
  ]),
  "satin-alma": build([
    ["acil", "Acil satın alma", "Durmuş bir işi kurtarmak için hızlı alım; sonradan belge tamamlanır.", "Talep|Neden acil|1;Hızlı onay|Yönetici aynı gün onaylar|1|L;Alım|Alım yapılır|1;Belge|Fatura ve teklif sonradan eklenir|5", "konu:Ürün:text:!;tutar:Tutar (TL):number:!;neden:Neden acil:textarea:!", "Alındı;Reddedildi", "self"],
    ["cerceve", "Çerçeve sözleşme", "Sık alınan malzemeler için yıllık fiyat anlaşması.", "İhtiyaç|Yıllık miktarlar|10;Teklif|Tedarikçilerden teklif|14;Müzakere|Fiyat ve koşul|10;Onay|Yönetim onaylar|5|M;İmza|Sözleşme imzalanır|5"],
    ["iade", "Tedarikçiye iade", "Hatalı veya eksik gelen malzemenin iadesi.", "Tespit|Hata tutanağı|1;Bildirim|Tedarikçiye bildirilir|2;İade|Malzeme gönderilir|5;Kapanış|Değişim veya alacak dekontu|10", "konu:Malzeme:text:!;siparis:Sipariş no:text"],
    ["tedarikci-puan", "Tedarikçi performans değerlendirmesi", "Altı aylık fiyat, süre ve kalite puanlaması.", "Veri|Teslim süreleri ve iadeler|7;Puanlama|Puan verilir|5;Görüşme|Tedarikçiyle paylaşılır|10|L", "konu:Tedarikçi:text:!;puan:Puan (0–100):number", "Onaylı kaldı;Uyarıldı;Listeden çıkarıldı"],
    ["demirbas-talebi", "Demirbaş talebi", "Çalışanın masa, sandalye, alet gibi demirbaş talebi.", "Talep|Ne ve neden|2;Onay|Yönetici onaylar|3|L;Alım|Satın alma|10;Teslim|Zimmetlenir|3", "konu:Demirbaş:text:!;aciklama:Gerekçe:textarea", "Teslim edildi;Reddedildi", "self"],
  ]),
  satis: build([
    ["cari-acma", "Yeni müşteri kaydı", "Kazanılan müşterinin cari kartı, vergi ve iletişim bilgileri.", "Bilgi|Unvan, vergi no, adres|2;Kontrol|Risk ve ödeme koşulu|3|F;Açılış|Cari kart açılır|1", "konu:Müşteri:text:!;vergi:Vergi no:text"],
    ["sozlesme-yenileme", "Bakım sözleşmesi yenileme", "Biten sözleşmenin fiyat güncellemesiyle yenilenmesi.", "Hatırlatma|Bitişten 60 gün önce|7;Teklif|Yeni fiyat|7;Müzakere|Görüşme|14;Onay|İndirim onayı|3|L;İmza|Yenilenir|7", "konu:Müşteri:text:!;bitis:Bitiş tarihi:date:!;tutar:Yeni yıllık tutar (TL):number", "Yenilendi;Kaybedildi"],
    ["fiyat-listesi", "Fiyat listesi güncellemesi", "Maliyet değişimine göre hizmet fiyatlarının güncellenmesi.", "Analiz|Maliyet artışı|7;Öneri|Yeni liste|5;Onay|Yönetim onaylar|3|M;Duyuru|Müşterilere bildirim|7"],
    ["ihale", "İhale dosyası hazırlığı", "Kamu veya özel ihaleye teklif dosyası.", "İnceleme|Şartname okunur|5;Fiyat|Maliyet ve teklif|7|F;Belgeler|Teminat ve belgeler|5;Onay|Yönetim onaylar|2|M;Teslim|Dosya teslim edilir|1", "konu:İhale:text:!;son-tarih:Son teslim:date:!;tutar:Teklif (TL):number", "Kazanıldı;Kaybedildi;Katılınmadı"],
    ["bayi", "Bayi başvurusu", "Başka ildeki servisin bayi olma başvurusu.", "Başvuru|Firma bilgisi|5;Ziyaret|Yerinde görülür|14;Karar|Yönetim karar verir|7|M;Sözleşme|Bayi sözleşmesi|10", "konu:Firma:text:!;il:İl:text"],
    ["kayip-analiz", "Kayıp müşteri analizi", "Ayrılan müşterinin neden ayrıldığının incelenmesi.", "Görüşme|Müşteri aranır|7;Analiz|Neden yazılır|5|L|neden;Önlem|Benzer müşteriler için önlem|10", "konu:Müşteri:text:!;neden:Ayrılma nedeni:textarea"],
  ]),
  destek: build([
    ["garanti", "Garanti talebi", "Garanti kapsamındaki arızanın üreticiyle takibi.", "Kayıt|Seri no ve fatura|1;Kontrol|Garanti kapsamı|2;Üretici|Üreticiye bildirim|5;Sonuç|Parça değişimi veya ret|10", "konu:Cihaz:text:!;seri:Seri no:text:!;musteri:Müşteri:text", "Garanti kapsamında;Kapsam dışı"],
    ["iade-talebi", "Müşteri iade talebi", "Hizmet veya ürün için müşterinin para iadesi talebi.", "Kayıt|Talep ve neden|1;İnceleme|Haklı mı?|3;Onay|Finans ve yönetici|2|F;İade|Ödeme yapılır|5", "konu:Müşteri:text:!;tutar:Tutar (TL):number:!", "İade edildi;Reddedildi"],
    ["anket", "Memnuniyet anketi takibi", "Kapanan işlerden sonra müşteri anketi ve düşük puan takibi.", "Gönderim|Anket gönderilir|2;Yanıt|Yanıt beklenir|7;Takip|Düşük puan aranır|3|L", "konu:Müşteri:text:!;puan:Puan (1–5):number"],
    ["vip-ziyaret", "Önemli müşteri ziyareti", "Büyük müşteriye üç aylık yönetici ziyareti.", "Plan|Tarih ve gündem|7;Ziyaret|Görüşme notları|1;Aksiyon|Söz verilenler takip edilir|14|L"],
    ["bilgi-talebi", "Bilgi talebi", "Müşterinin teknik veya ticari bilgi talebi.", "Kayıt|Soru kaydedilir|1;Yanıt|Uzman yanıtlar|2;Kapanış|Müşteri teyidi|2", DEFAULT_FIELDS, undefined, "self"],
  ]),
  ik: build([
    ["egitim", "Eğitim talebi", "Çalışanın kurs, sertifika veya eğitim talebi.", "Talep|Eğitim ve gerekçe|3;Yönetici onayı|İşe katkısı|3|L;Bütçe|İK ve finans|3|H;Katılım|Eğitime katılır|30;Değerlendirme|Sertifika eklenir|7", "konu:Eğitim:text:!;tutar:Ücret (TL):number;tarih:Tarih:date", "Tamamlandı;Reddedildi", "self"],
    ["zimmet", "Zimmet teslimi", "Telefon, bilgisayar, araç, alet gibi zimmetlerin imzalı teslimi.", "Hazırlık|Liste hazırlanır|2;Teslim|Çalışana teslim|1;İmza|Zimmet formu imzalanır|1|H", "konu:Çalışan:text:!;liste:Zimmet listesi:textarea:!"],
    ["terfi", "Terfi ve ücret değişikliği", "Unvan veya ücret değişikliğinin yönetici ve İK onayı.", "Öneri|Yönetici önerir|5;İK|Ücret skalası kontrolü|5|H;Onay|Yönetim onaylar|5|M;Bildirim|Çalışana yazılı bildirim|3", "konu:Çalışan:text:!;yeni-unvan:Yeni unvan:text;yeni-ucret:Yeni ücret (TL):number", "Onaylandı;Reddedildi"],
    ["disiplin", "Disiplin süreci", "Savunma alma ve kurul kararıyla disiplin işlemi.", "Tutanak|Olay tutanağı|2;Savunma|Yazılı savunma istenir|3;Kurul|Disiplin kurulu|7|M;Bildirim|Karar tebliğ edilir|2", "konu:Çalışan:text:!;olay:Olay:textarea:!", "Uyarı;Kınama;İşlem yapılmadı"],
    ["is-kazasi", "İş kazası bildirimi", "Kazanın kaydı, SGK bildirimi ve kök neden.", "Kayıt|Ne oldu, nerede, kim|1;Bildirim|SGK'ya 3 iş günü içinde|3|H|sgk;İnceleme|Kök neden|7;Önlem|DÖF açılır|14", "konu:Olay:text:!;tarih:Tarih:date:!;sgk:SGK bildirimi yapıldı mı?:choice=Evet/Hayır", "Kapatıldı", "self"],
    ["staj", "Stajyer kabulü", "Okuldan gelen staj başvurusu ve kabul.", "Başvuru|Belgeler|5;Görüşme|Birimle görüşme|7;Kabul|İK onayı|3|H;Başlangıç|Oryantasyon|5", "konu:Öğrenci:text:!;okul:Okul:text;baslama:Başlama:date"],
    ["uzaktan", "Uzaktan çalışma talebi", "Belirli günlerde uzaktan çalışma talebi.", "Talep|Günler ve gerekçe|2;Yönetici|Onay|3|L;İK kaydı|Kayda alınır|2|H", "konu:Talep:text:!;gunler:Günler:text", "Onaylandı;Reddedildi", "self"],
    ["fazla-mesai", "Fazla mesai onayı", "Planlı fazla çalışmanın önceden onayı.", "Talep|Saat ve iş|1;Yönetici|Onay|1|L;Kayıt|Bordroya işlenir|5|H", "konu:İş:text:!;saat:Saat:number:!;tarih:Tarih:date:!", "Onaylandı;Reddedildi", "self"],
  ]),
  bt: build([
    ["yeni-calisan", "Yeni çalışan BT kurulumu", "E-posta, bilgisayar, yazılım ve yetkilerin ilk gün hazır olması.", "Hesap|E-posta ve sistem hesabı|2;Cihaz|Bilgisayar hazırlanır|3;Yetki|Rolüne göre yetki|2|I;Teslim|Kullanıcıyla kontrol|1", "konu:Çalışan:text:!;baslama:Başlama:date"],
    ["cihaz-ariza", "Cihaz arızası", "Bilgisayar, telefon veya yazıcı arızası.", "Kayıt|Arıza|1;İnceleme|Uzaktan veya yerinde|1;Çözüm|Onarım veya yedek cihaz|3", "konu:Cihaz:text:!;aciklama:Ne oluyor?:textarea", "Onarıldı;Değişim gerekli", "self"],
    ["lisans", "Yazılım lisans talebi", "Yeni yazılım veya lisans talebi.", "Talep|Yazılım ve neden|2;Güvenlik|Güvenlik ve uyum kontrolü|3|I;Onay|Bütçe onayı|3|F;Kurulum|Kurulur|3", "konu:Yazılım:text:!;tutar:Yıllık ücret (TL):number", "Kuruldu;Reddedildi", "self"],
    ["yedek-kontrol", "Yedekleme kontrolü", "Aylık yedek ve geri yükleme denemesi.", "Yedek|Yedek alınır|1;Geri yükleme|Boş ortamda denenir|2|I;Rapor|Sonuç yazılır|1"],
    ["hesap-kilidi", "Hesap kilidi ve parola sıfırlama", "Kilitlenen hesabın kimlik doğrulanarak açılması.", "Talep|Kullanıcı bildirir|1;Doğrulama|Kimlik doğrulanır|1|I;Açma|Hesap açılır|1", DEFAULT_FIELDS, "Açıldı", "self"],
    ["degisiklik", "Sistem değişiklik talebi", "Sunucu, ağ veya yazılım değişikliğinin planlı yapılması.", "Talep|Değişiklik ve gerekçe|2;Risk|Geri dönüş planı|3|I|geri-donus;Onay|Yönetim onayı|2|M;Uygulama|Bakım penceresinde|5;Doğrulama|Çalışıyor mu?|1", "konu:Değişiklik:text:!;geri-donus:Geri dönüş planı:textarea"],
    ["hesap-kapatma", "Ayrılan çalışanın hesap kapatması", "Son çalışma günü tüm erişimlerin kapatılması.", "Liste|Erişimler listelenir|1;Kapatma|Hesaplar kapatılır|1|I;Veri|E-posta ve dosyalar devredilir|3", "konu:Çalışan:text:!;son-gun:Son gün:date"],
  ]),
  hukuk: build([
    ["ihtarname", "İhtarname ve dava takibi", "Alacak veya uyuşmazlıkta ihtarname, icra ve dava adımları.", "Değerlendirme|Belgeler incelenir|7;İhtarname|Noterden gönderilir|5|M;Süre|Yanıt beklenir|15;Dava/icra|Avukata devir|30", "konu:Karşı taraf:text:!;tutar:Tutar (TL):number", "Uzlaşıldı;Dava açıldı;Vazgeçildi"],
    ["aydinlatma", "KVKK aydınlatma metni güncelleme", "Yeni veri işleme faaliyetinde aydınlatma metninin güncellenmesi.", "Tespit|Yeni faaliyet|5;Taslak|Metin güncellenir|7;Onay|Yönetim onayı|3|M;Yayım|Web ve formlara eklenir|5"],
    ["marka", "Marka tescili", "Marka araştırması ve TÜRKPATENT başvurusu.", "Araştırma|Benzer marka|7;Başvuru|Başvuru yapılır|5|M;İlan|İtiraz süresi|60;Tescil|Belge alınır|30", "konu:Marka:text:!;sinif:Sınıflar:text", "Tescil edildi;Reddedildi"],
    ["vekalet", "Vekâletname ve yetki belgesi", "İmza sirküleri ve vekâletnamelerin güncel tutulması.", "Talep|Kime, hangi yetki|3;Onay|Yönetim onayı|3|M;Noter|Düzenlenir|5;Arşiv|Bitiş tarihi kaydedilir|2", "konu:Kişi:text:!;bitis:Bitiş:date"],
    ["verbis", "VERBİS güncellemesi", "Veri envanterindeki değişikliğin VERBİS'e işlenmesi.", "Tespit|Değişiklik|5;Envanter|Envanter güncellenir|7;Kayıt|VERBİS'e işlenir|7|M"],
  ]),
  kalite: build([
    ["sikayet-kok", "Müşteri şikâyeti kök neden analizi", "Tekrarlayan şikâyetin kök nedeninin bulunması.", "Veri|Benzer şikâyetler|5;Analiz|5 neden|7|L|kok;Önlem|DÖF açılır|5", "konu:Konu:text:!;kok:Kök neden:textarea"],
    ["kalibrasyon", "Kalibrasyon takibi", "Ölçüm cihazlarının kalibrasyon zamanında yapılması.", "Hatırlatma|Süre dolmak üzere|7;Gönderim|Laboratuvara gönderilir|5;Sertifika|Sertifika eklenir|10|L", "konu:Cihaz:text:!;son-tarih:Son kalibrasyon:date"],
    ["tedarikci-denetim", "Tedarikçi denetimi", "Kritik tedarikçinin yerinde denetimi.", "Plan|Kapsam|10;Denetim|Yerinde|2;Rapor|Bulgular|5|L;Takip|Düzeltmeler|30", "konu:Tedarikçi:text:!;bulgular:Bulgular:textarea"],
    ["iso", "ISO belge yenileme", "Belgelendirme denetimi hazırlığı.", "Hazırlık|Doküman gözden geçirme|30;İç denetim|Ön denetim|10;Belgelendirme|Dış denetim|5|M;Kapanış|Bulgular kapatılır|30", "konu:Standart:text:!;tarih:Denetim tarihi:date", "Belge yenilendi;Bulgu kapatılacak"],
    ["ramak-kala", "Ramak kala bildirimi", "Kaza olmadan atlatılan tehlikeli durumun bildirimi.", "Bildirim|Ne oldu|1;İnceleme|Neden|5|L;Önlem|Önlem alınır|10", DEFAULT_FIELDS, "Önlem alındı", "self"],
  ]),
  arge: build([
    ["teknoloji", "Teknoloji araştırması", "Yeni bir teknolojinin işe uygunluğunun araştırılması.", "Soru|Neyi öğrenmek istiyoruz|5;Araştırma|Kaynak ve deneme|20;Rapor|Bulgular|7|L|sonuc", "konu:Teknoloji:text:!;sonuc:Sonuç:textarea", "Uygun;Uygun değil"],
    ["test-plani", "Prototip test planı", "Prototipin sahada denenmesi ve ölçülmesi.", "Plan|Test senaryoları|7;Saha|Müşteri sahasında deneme|30;Ölçüm|Sonuçlar|7|L|sonuc;Karar|Devam veya düzeltme|5|M", "konu:Prototip:text:!;sonuc:Ölçüm sonucu:textarea", "Başarılı;Düzeltme gerekli"],
    ["lansman", "Yeni hizmet lansmanı", "Ar-Ge'den çıkan hizmetin satışa sunulması.", "Paket|Fiyat ve kapsam|10|F;Eğitim|Satış ve saha eğitimi|10;Duyuru|Müşterilere duyuru|5;İlk satış|İlk müşteriler|30|M"],
    ["lisans-kontrol", "Açık kaynak lisans kontrolü", "Üründe kullanılan açık kaynak bileşenlerin lisans uygunluğu.", "Liste|Bileşenler listelenir|5;Kontrol|Lisans uyumu|5|I;Kayıt|Uyum kaydı|2"],
    ["universite", "Üniversite iş birliği", "Akademik danışmanlık veya ortak proje.", "Görüşme|Konu ve kişi|14;Protokol|İş birliği protokolü|14|M;Çalışma|Ortak çalışma|90;Rapor|Sonuç raporu|14"],
  ]),
};

/** Süreç ağı: "birim/süreç" → kapandığında açılacak süreçler (when = yalnız bu sonuçlarda). */
export const LINKS: Record<string, { to: string; when?: string[] }[]> = {
  "ik/ise-alim": [{ to: "ik/ise-giris", when: ["İşe alındı"] }],
  "ik/ise-giris": [{ to: "bt/yeni-calisan" }, { to: "ik/zimmet" }, { to: "ik/egitim" }],
  "ik/ayrilis": [{ to: "bt/hesap-kapatma" }],
  "ik/is-kazasi": [{ to: "kalite/dof" }],
  "ik/performans": [{ to: "ik/terfi", when: ["Beklentinin üstünde"] }, { to: "ik/egitim", when: ["Gelişim gerekli"] }],
  "ik/egitim": [{ to: "finans/odeme-talebi", when: ["Tamamlandı"] }],
  "satin-alma/talep": [{ to: "muhasebe/gelen-fatura", when: ["Teslim alındı"] }, { to: "muhasebe/demirbas", when: ["Teslim alındı"] }],
  "satin-alma/acil": [{ to: "muhasebe/gelen-fatura", when: ["Alındı"] }],
  "satin-alma/demirbas-talebi": [{ to: "satin-alma/talep", when: ["Teslim edildi"] }],
  "satin-alma/tedarikci": [{ to: "hukuk/sozlesme", when: ["Onaylandı"] }],
  "satin-alma/cerceve": [{ to: "hukuk/sozlesme" }],
  "satin-alma/tedarikci-puan": [{ to: "kalite/tedarikci-denetim", when: ["Uyarıldı"] }],
  "satis/teklif": [{ to: "satis/cari-acma", when: ["Kazanıldı"] }, { to: "hukuk/sozlesme", when: ["Kazanıldı"] }, { to: "operasyon/musteri-devreye", when: ["Kazanıldı"] }, { to: "satis/kayip-analiz", when: ["Kaybedildi"] }],
  "satis/ihale": [{ to: "finans/teminat", when: ["Kazanıldı"] }, { to: "proje/baslatma", when: ["Kazanıldı"] }],
  "satis/sozlesme-yenileme": [{ to: "satis/kayip-analiz", when: ["Kaybedildi"] }],
  "satis/bayi": [{ to: "hukuk/sozlesme" }],
  "destek/sikayet": [{ to: "kalite/sikayet-kok" }, { to: "destek/anket", when: ["Çözüldü"] }],
  "destek/iade-talebi": [{ to: "muhasebe/fatura-iptal", when: ["İade edildi"] }],
  "destek/garanti": [{ to: "satin-alma/iade", when: ["Garanti kapsamında"] }],
  "kalite/sikayet-kok": [{ to: "kalite/dof" }],
  "kalite/denetim": [{ to: "kalite/dof", when: ["Bulgular DÖF'e aktarıldı"] }],
  "kalite/tedarikci-denetim": [{ to: "satin-alma/tedarikci-puan" }],
  "kalite/ramak-kala": [{ to: "kalite/dof" }],
  "operasyon/aksaklik": [{ to: "kalite/dof", when: ["Kalıcı önlem bekliyor"] }],
  "operasyon/yeni-bolge": [{ to: "ik/ise-alim" }, { to: "satin-alma/talep" }],
  "operasyon/musteri-devreye": [{ to: "operasyon/periyodik-bakim" }],
  "operasyon/arac": [{ to: "finans/odeme-talebi" }],
  "bt/olay": [{ to: "yonetim/kriz", when: ["Kurula bildirildi"] }, { to: "hukuk/aydinlatma", when: ["Kurula bildirildi"] }],
  "bt/cihaz-ariza": [{ to: "satin-alma/demirbas-talebi", when: ["Değişim gerekli"] }],
  "bt/lisans": [{ to: "arge/lisans-kontrol" }],
  "finans/tahsilat": [{ to: "hukuk/ihtarname", when: ["Hukuka devredildi"] }],
  "finans/kredi": [{ to: "muhasebe/banka-mutabakat", when: ["Kullanıldı"] }],
  "muhasebe/ay-sonu": [{ to: "finans/nakit-tahmin" }, { to: "muhasebe/kdv" }],
  "muhasebe/gelen-fatura": [{ to: "finans/odeme-talebi", when: ["Onaylandı"] }],
  "yonetim/karar": [{ to: "proje/baslatma", when: ["Uygulandı"] }],
  "yonetim/yatirim": [{ to: "finans/kredi", when: ["Onaylandı"] }, { to: "satin-alma/talep", when: ["Onaylandı"] }],
  "yonetim/politika": [{ to: "hukuk/aydinlatma" }],
  "proje/baslatma": [{ to: "proje/kilometre" }],
  "proje/kilometre": [{ to: "proje/kapanis" }],
  "proje/eskalasyon": [{ to: "yonetim/karar" }],
  "arge/fikir": [{ to: "proje/baslatma", when: ["Projeye dönüştü"] }, { to: "arge/patent", when: ["Projeye dönüştü"] }],
  "arge/test-plani": [{ to: "arge/lansman", when: ["Başarılı"] }],
  "arge/lansman": [{ to: "satis/fiyat-listesi" }],
  "arge/destek": [{ to: "finans/butce-revizyonu", when: ["Desteklendi"] }],
  "hukuk/sozlesme": [{ to: "hukuk/vekalet", when: ["İmzalandı"] }],
};
