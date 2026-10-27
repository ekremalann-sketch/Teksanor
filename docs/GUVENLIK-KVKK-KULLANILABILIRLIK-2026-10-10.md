# Güvenlik, KVKK ve kullanılabilirlik incelemesi — 10 Ekim 2026

## Sonuç ve doğrulama sınırı
İki ürünün rol/birim ve firma kontrolleri, kimliksiz sağlık girişleri, bağımsız onay, veri dışa aktarımı, güvenlik logları, menüler, kılavuzlar ve istemci veri yükleme yolları incelendi. Bu çalışma tam bir sızma testi, KVKK uygunluk görüşü veya ASVS sertifikasyonu değildir. Tarayıcı kontrol yeteneği bu oturumda mevcut olmadığı için gerçek cihazda tıklama, ekran okuyucu ve kare hızı ölçümü yapılmadı; sayısal performans artışı iddia edilmez.

## Kodda uygulanan düzeltmeler
| Alan | Bulgu | Uygulanan |
|---|---|---|
| Teksanor veri yükleme | Firma değişiminde eski yanıtın yeni ekrana gelme ihtimali | Önceki istekler iptal edilir; her yanıt yükleme nesliyle kontrol edilir. Eski yanıt bildirim, liste veya yönlendirme değiştiremez. |
| Teksanor açılış yükü | Çok sayıda listeye aynı anda istek | Liste istekleri aynı anda en fazla 4 olacak şekilde sınırlandı; firma değişimi iptali bekleyen istekleri de durdurur. Bildirim isteği ayrı yürür. Toplam liste sayısı henüz azaltılmadı. |
| İK ekranı | Aynı sayfada iki ayrı çalışma alanı | Tekrarlanan departman bileşeni kaldırıldı; normal İK bağlantısı tam birim ekranını açmaya devam eder. Eski kayıtlar silinmedi. |
| Menü ve kimlik | Yöneticiye tüm ekranlar, sabit YK avatarı | Yöneticiye iş odaklı ilk menü, diğer ekranlar isteğe bağlı; kişi etiketinden avatar. Menü gizleme bir güvenlik tedbiri olarak sayılmaz. |
| Güvenlik logu | Serbest hata ayrıntısında kişisel veri; IP için bilinen sabit salt | Telefon/e-posta/geçerli TCKN/IBAN/kart örüntüleri yazmadan önce maskelenir. IP korelasyonu için ayrı rastgele üretim sırrı; sır yoksa IP hash'i tutulmaz. Yetkili işlem aktörü ayrı alanda tutulur. |
| Dışa aktarım | Uzun görünür kayıt listesi parametre sınırına yaklaşabiliyor; eğitim dışa aktarılabiliyor | Birim kapsamı veritabanı alt sorgusuyla filtrelenir, eğitim kaynakları üretimden ayrılır. Serbest metinde maskeleme ve Excel formül enjeksiyonu koruması birlikte sürer. |
| Excel/CSV hatası | AUTOMATION/SHIFT Türkçe küçük harfe dönüşünce başlıkta ASCII dışı ı oluşuyor | Makine dosya adları ASCII küçük harf; Türkçe ekran metni korunur. |
| Kılavuz | Açıklama kalabalığı | Kısa kullanım kılavuzu kapalı ve yerinde; mevcut ekran adımlarını isteğe bağlı açar. |

## Korunan güvenlik sınırları

## Kalan önemli hususlar
- Maskeleme kural tabanlıdır; kişi adını veya her serbest metindeki sağlık bilgisini otomatik tespit etmez. Aktör e-postası yetkili denetim kayıtlarında bilinçli tutulur; bu kayıtlar da kişisel veri politikası gerektirir.
- Denetim hash zincirinde eşzamanlı yazımda dallanma ihtimali sürer. Değişmezlik veya sertifikalı log sistemi iddia edilmez.
- Merkezi SIEM, WAF politika incelemesi, üretim yedek geri dönüş tatbikatı ve bağımlılık zafiyet taraması bu turda tamamlanmadı. Güvenlik aracı kurulumu mevcut kontrollerin veya hukuki yükümlülüklerin yerine geçmez.
- İki üründeki tüm ekranlar tek tek gerçek tarayıcıda tıklanmış değildir. Üst şerit ve İK tekrarı düzeltildi; bütün ürünün hiçbir tekrar içermediği söylenemez.

## Kullanıcının kısa akışı
Teksanor: yönetim özeti → ilgili birim/servis → sorumlu ve hedef tarih → gerekli onay → sonuç ve bağlı süreçler. Kritik süreçler işaretli; süreç kapatma öncesi bağlı işler önizlenir.

## Dayanaklar
- KVKK veri güvenliği yükümlülükleri: https://www.kvkk.gov.tr/Icerik/2040/Veri-Guvenligine-Iliskin-Yukumlulukler
- Özel nitelikli veri için yeterli önlemler, 2018/10: https://www.kvkk.gov.tr/Icerik/4110/2018-10
- Özel nitelikli verinin işlenme şartları: https://www.kvkk.gov.tr/Icerik/2051/Ozel-Nitelikli-Kisisel-Veriler
- OWASP ASVS: https://owasp.org/projects/asvs
- OWASP Logging Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html
Bunlar incelemeye dayanak olarak kullanıldı; bu uygulamaların tüm ASVS gereksinimlerini geçtiği iddia edilmez.
