# Teksanor pilot hazırlık teslimi — 6 Eylül 2026

## Kapsam ve kaynak durumu

GitHub main ile Sites kaynağı farklıydı. GitHub'da bulunmayan iş emri, görev,
ziyaret, müşteri, İK, risk, satın alma, bildirim, MFA ve test dosyaları Sites
kaynağından geri kazanıldı. GitHub portföy belgeleri korundu. Bu paket bir
üretime hazır SaaS sertifikası değildir.

## Uygulananlar

- Şirket kapsamı sonrasında API yoluna ve HTTP işlemine göre modül yetkisi.
- Asistan geçmişinde şirket + kullanıcı + güncel yetki kapsamı ayrımı.
- Asistanın yalnızca izinli kaynakları sorgulaması; başarısız sorguda sıfır üretmemesi.
- Finans özetinin ve genel denetim geçmişinin kısıtlı personele döndürülmemesi.
- Şirket değişiminde tarayıcıdaki önceki şirket listelerinin temizlenmesi.
- İsteğe bağlı MFA'nın geri kazanılması; parola ile kurulum, şifreli geçici anahtar,
  süre sonu, deneme sınırı, tek kullanımlık challenge ve TOTP tekrar kullanım kontrolü.
- E-posta doğrulama ve parola yenileme bağlantıları. Tek kullanımlık, amaç ve adres
  bağlı tokenlar; yenilemede eski oturumların iptali. MFA parola yenilemeyle kapanmaz.
- Servis masası: talep, teklif, müşteri onayı, saha raporu, iş onayı, tahsilat.
- Müşteri onay linkleri: 7 gün, hash olarak saklama, firma/kayıt/sürüm/amaç kapsamı,
  tekrar kullanım ve eski belge kontrolü. Müşteri maliyetleri göremez.
- Kuruş cinsinden teklif, işçilik, parça, ulaşım, tahsilat ve brüt fark hesabı.
- Sorumluya atanmış servis listesi; fotoğraf/belge bağlantısı ve ekipman QR etiketi.
- Sesle yazma (destekleyen tarayıcıda), kullanıcı tarafından kaydedilen rapor taslağı.
- Açık kullanıcı işlemiyle cihazda not taslağı saklama/açma/silme. Bu özellik tam
  çevrimdışı uygulama veya otomatik çatışma çözümü değildir.
- Yazdırma ekranından PDF olarak kaydedilen müşteri servis formu. Mali fatura değildir.
- Geciken/yaklaşan servis ve bakım için kişiye özel, yinelenmeyen uygulama içi bildirimler.
- Gerçek D1 tablo ve R2 erişim kontrolü; build commit bilgisini veren /api/health.
- Boş test paketinin başarı sayılmasını engelleyen test komutu; SQLite üzerinde
  gerçek route işlevlerini çalıştıran entegrasyon testleri; TypeScript kontrolü.
- D1 salt okunur dışa aktarma ve yalnızca yerel geçici veritabanına geri yükleme araçları.

## Etkinleştirme gerektiren bağlantılar

Bu incelemede Sites üzerinde ADMIN1_PASSWORD, ADMIN2_PASSWORD ve
MFA_ENCRYPTION_KEY tanımlı bulundu. Değerler açığa çıkarılmadı ve değiştirilmedi.
Cloudflare Pages çalışma ortamı ayrı kontrol edilmelidir.

| Bağlantı | Gerekli yapılandırma | Eksikken davranış |
|---|---|---|
| E-posta | RESEND_API_KEY, MAIL_FROM (doğrulanmış alan), APP_ORIGIN | Açıkça hizmet hazır değil yanıtı |
| Yapay zekâ | OPENAI_API_KEY; isteğe bağlı OPENAI_MODEL | Açıkça etiketlenmiş kayıt özeti / mevcut not |
| Harici zararlı dosya tarama | FILE_SCAN_URL, FILE_SCAN_TOKEN, FILE_SCAN_REQUIRED=true | Zorunlu modda yükleme durur |
| Zamanlanmış bildirim | Uygulama ve GitHub'da eşleşen APP_CRON_TOKEN (en az 32 karakter) | Bildirimler kullanıcı paneli açtığında oluşur |

API anahtarları koda, belgeye veya GitHub issue'larına yazılmamalı. Harici tarama
adaptörü POST ikili içerik -> {"clean":true} sözleşmesini kullanır; entegrasyonun
kuruluşun seçtiği tarayıcı servisinde uygulanması gerekir. İmza/tür denetimi
antivirüs değildir. Dosya tarama servisi seçimi veri işleme onayı gerektirir.

## Pilot başlamadan tamamlanması gereken operasyonel işler

1. Demo ile müşterinin D1/R2 ortamını ayır; boş müşteri alanında kabul testini çalıştır.
2. Gerçek D1 dışa aktarımını ve R2 nesneleri+metadata yedeğini güvenli depoya al.
3. İzole ortamda geri yüklemeyi dene; kayıt sayısı, örnek dosya hash'leri ve süreyi kaydet.
4. Yönetici MFA kurulumunu ve kurtarma sorumlusunu kullanıcıyla tamamla.
5. E-posta alanını doğrula; mail teslim ve hesap kurtarma testini gerçek test posta kutusunda yap.
6. Bir pilot işletme seç; servis süresi, eksik kayıt, geciken iş ve kullanıcı kabulünü ölç.
7. Veri sorumlusu/işleyen, saklama süresi, destek ve kabul kapsamını işletmeyle kesinleştir.
8. Cloudflare Pages ve Sites için aynı onaylı kaynak sürümünü yayınla; /api/health
   sürüm değerini yayınlanan commit ile karşılaştır.

## Henüz uygulanmış sayılmayanlar

WhatsApp Business bağlantısı, e-fatura, abonelik/tahsilat sağlayıcısı, tam çevrimdışı
senkronizasyon, bağımsız penetrasyon testi, yük testi ve ticari sözleşme onayı.
Bunlar bu kod değişikliğinin çalıştığı doğrulanmış özellikleri olarak sunulmaz.
Kurumsal faturalama entegrasyonu olmadan hizmet ücreti takibi manuel kayıt düzeyindedir.

## Bağımlılık taraması

Uyumlu güvenlik güncellemeleri uygulandı. İlk taramadaki yüksek önem dereceli
bulgular giderildi. ExcelJS'nin uuid bağımlılığı için orta önem dereceli uyarı
kaldı; otomatik öneri ExcelJS'yi kırıcı biçimde eski sürüme düşürdüğünden
zorla uygulanmadı. İlgili paketler için yeniden tarama ve Excel içe aktarma
uyumluluğu kontrolü sürdürülmelidir; “sıfır güvenlik açığı” iddiası yoktur.
