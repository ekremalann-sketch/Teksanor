// Ekran içi yardım: her ekranın üstündeki "Bu ekranda ne yapılır?" kutusu ve kullanım kılavuzunun kaynağı.
// Metinler görev odaklıdır: ne işe yarar → kim kullanır → adım adım → ipucu. Düğme adları ekrandakiyle aynıdır.
export type ScreenHelp = { purpose: string; who: string; steps: string[]; tip?: string };

export const SCREEN_HELP: Record<string, ScreenHelp> = {
  overview: {
    purpose: "Şirketin bugünkü durumu: bugünün servis işleri, geciken görevler, bekleyen satın almalar, son faaliyetler.",
    who: "Firma sahibi, yöneticiler",
    steps: [
      "\"Bugün\" kartında geciken ve bugünkü servis işlerini görün; bir işe tıklayınca Servis masası o işle açılır.",
      "\"Bugünün aksiyonları\" kutularına tıklayın; her biri ilgili ekrana götürür.",
      "\"Son faaliyetler\" satırına tıklayınca kaydın bulunduğu ekran açılır.",
    ],
    tip: "Sağ üstteki zil önemli bildirimleri gösterir; dışarı dokununca veya Esc ile kapanır.",
  },
  departments: {
    purpose: "13 birimin görev alanları ve birim sayfalarına giriş.",
    who: "Yöneticiler",
    steps: ["Bir birimin kartında \"Birim sayfasını aç\"a basın.", "Tüm birimleri tek ekranda görmek için \"Birimler kontrol merkezi\"ni açın."],
  },
  birimler: {
    purpose: "13 birimde 100 hazır süreç (işe alım, izin, satın alma, ödeme, DÖF…). Bir süreç bitince bağlı birimde yenisi kendiliğinden açılır.",
    who: "Birim sorumluları; çalışanlar yalnız kendi taleplerini görür",
    steps: [
      "Üstteki sayı kutularına tıklayarak yalnız onay bekleyen, geciken veya beklemedeki birimleri süzün.",
      "Bir birime tıklayın; ekran o birimin tam ekran çalışma alanına döner.",
      "\"Yeni süreç başlat\" ile süreç türünü seçip zorunlu alanları doldurun.",
      "Bir karta tıklayınca sağda süreç paneli açılır: \"ilerlet\", \"Geri gönder\", \"Beklet\", \"İptal et\".",
      "Son aşamada sonucu seçin; bağlı süreçler (ör. işe giriş, BT kurulumu) kendiliğinden açılır ve aday adı gibi bilgiler taşınır.",
    ],
    tip: "Kendi talebinizi onaylayamazsınız. \"Süreç ağını göster\" bağlantıları, \"Performans raporu\" hangi aşamanın işi beklettiğini gösterir.",
  },
  servis: {
    purpose: "Saha servisini baştan sona yönetir: talep → teklif → müşteri onayı → saha kaydı → servis formu → tahsilat.",
    who: "Operasyon müdürü, teknisyenler (yalnız kendi işleri)",
    steps: [
      "\"Yeni servis talebi\" ile müşteri, adres ve iş başlığını girin; \"Talebi aç\".",
      "Teklif tutarlarını girin; \"Müşteri onay bağlantısı\"nı WhatsApp veya e-posta ile gönderin.",
      "Müşteri onaylayınca işi planlama panosunda teknisyene ve güne atayın.",
      "Teknisyen sahada \"Yapılan işlem\"i yazar, fotoğraf ekler, müşteriye imzalatır; bağlantı zayıfsa \"Cihazda taslak sakla\".",
      "\"Servis formu / PDF\" ile raporu alın; tahsilatı kaydedince iş \"Tahsil edildi\" olur.",
    ],
    tip: "Soldaki filtreler: Açık işler, Bugün, Geciken, Tümü.",
  },
  projects: { purpose: "Projeler: sorumlu, bütçe, tarih ve ilerleme.", who: "Yöneticiler", steps: ["\"Yeni proje\" ile kaydı açın.", "Kartta sorumluyu, bütçeyi, tarihleri ve ilerlemeyi izleyin.", "\"Excel'e indir\" ile listeyi alın."] },
  tasks: { purpose: "Birim görevleri: sorumlu, öncelik, son tarih.", who: "Herkes", steps: ["\"Yeni görev\" ile görevi açın.", "Filtrelerle açık, süren veya tamamlanan görevleri görün.", "Durumu değiştirerek görevi ilerletin; \"Excel'e indir\" ile listeyi alın."] },
  "work-orders": { purpose: "Bakım ve onarım iş emirleri. Servis masası, müşteri onayı ve saha formu için ayrı servis kayıtlarını yönetir.", who: "Operasyon", steps: ["\"Yeni iş emri\" ile kaydı açın.", "Ayrıntılı müşteri onayı ve saha formu için Servis masasını kullanın."] },
  assets: { purpose: "Cihaz ve ekipman envanteri: kod, konum, sorumlu, garanti.", who: "Operasyon, bakım", steps: ["\"Yeni varlık\" ile ekipmanı ekleyin.", "Servis masasında ekipmanın QR etiketini indirip cihaza yapıştırın."] },
  maintenance: { purpose: "Periyodik bakım planları; tamamlanan bakımdan sonra yeni tarih kendiliğinden hesaplanır.", who: "Bakım sorumlusu", steps: ["\"Yeni bakım planı\" ile ekipmanı ve sıklığı seçin.", "Bakım yapılınca planda tamamlandı olarak işaretleyin; sonraki tarih kendiliğinden hesaplanır."] },
  "field-visits": { purpose: "Kontrol, kurulum ve bakım ziyaretleri ile bulgular.", who: "Teknisyenler", steps: ["\"Yeni ziyaret\" ile ziyareti kaydedin.", "Bulguları ve sonucu yazın."] },
  procurement: { purpose: "Satın alma talebinden teslime kadar.", who: "Satın alma, yöneticiler", steps: ["\"Yeni talep\" ile ürün, miktar ve tedarikçiyi yazın.", "Onay ve sipariş durumunu güncelleyin."], tip: "Üç teklif kuralı ve onay zinciri Birimler → Satın alma sürecinde işler." },
  crm: { purpose: "Müşteriler ve görüşme geçmişi.", who: "Satış, destek", steps: ["\"Yeni müşteri\" ile kaydı açın.", "Müşteri kartında \"Görüşme ekle\" ile görüşme geçmişini tutun."] },
  hr: { purpose: "Çalışan kayıtları.", who: "İnsan kaynakları", steps: ["\"Yeni çalışan\" ile kaydı açın.", "İşe alım, izin ve ayrılış süreçleri Birimler → İnsan Kaynakları'nda yürür."] },
  risks: { purpose: "Risk kayıtları: olasılık, etki, önlem planı.", who: "Kalite, yönetim", steps: ["\"Yeni risk\" ile kaydı açın.", "Önlem planını ve gözden geçirme tarihini girin."] },
  automations: { purpose: "Uygulama içi otomasyon kuralları (ör. geciken iş için bildirim).", who: "Yöneticiler", steps: ["\"Yeni kural\" ile tetikleyici ve eylemi seçin.", "Kuralı gerektiğinde \"Duraklat\" ile durdurabilirsiniz."] },
  payments: { purpose: "Kart, kredi ve borç kayıtları; Excel benzeri tabloda düzenleme.", who: "Finans", steps: ["Hücreyi değiştirip satır sonundaki \"Kaydet\"e basın.", "\"Excel'den içe al\" ile toplu kayıt yükleyin; \"Excel'e indir\" ile seçili listeyi dışa alın."] },
  expenses: { purpose: "Dönemsel giderler.", who: "Finans", steps: ["\"Yeni kayıt\" ile gideri girin.", "\"Excel'e indir\" ile listeyi alın."] },
  financial: { purpose: "Borç, ödeme ve dönem özeti.", who: "Firma sahibi, finans", steps: ["Dönemler arası değişimi kartlardan izleyin.", "Ayrıntı için Ödemeler ekranına geçin."] },
  users: { purpose: "Kullanıcılar ve yetkiler.", who: "Firma yöneticisi", steps: ["Kullanıcı ekleyin; rol, hangi ekranları göreceğini belirler.", "Teknisyenler yalnız kendine atanan işleri görür."] },
  "ornek-isletme": {
    purpose: "Tanıtım için sentetik bir firma (15 çalışan, servis işleri, 28 birim süreci) kurar.",
    who: "Yalnız platform yöneticisi",
    steps: [
      "Firma adını yazın, her rol için kullanıcı adı ve parola belirleyin (firma sahibi zorunlu).",
      "\"Örnek işletmeyi oluştur\"a basın; kurulum dört bölümde ilerler; her bölüm kendi içinde birlikte kaydedilir.",
      "Yarım kalırsa \"Oluşturulan örnek işletmeler\" listesinden \"Kuruluma devam et\".",
    ],
    tip: "Parolalar bir daha gösterilmez; ilgili kişilere güvenli bir kanaldan iletin.",
  },
};
