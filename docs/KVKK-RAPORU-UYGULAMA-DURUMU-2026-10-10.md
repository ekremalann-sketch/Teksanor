# KVKK raporu uygulama durumu — 10 Ekim 2026

Yeni rapor eski kaynak sürümlerini inceliyordu. Bu tablo güncel kaynakta gerçekten tamamlanan, önceki yayında olan ve açık kalan işleri ayırır. Raporun 40 maddesinin tamamı bitmiş değildir.

## Önceki uyarlamada tamamlanan temel değişiklikler

- Yönetici MFA, kısa oturum, IP değişimine dayanıklı hesap deneme sınırı ve kullanıcı erişim ekranı.
- Tarama yoksa yükleme yok; PDF indirme; genel API hatalarında iç ayrıntı yok.
- Saatlik kapsamlı okuma kaydı; AI aktarım öncesi maskeleme ve bilgilendirme; kayıt aydınlatma sürümü.
- Büyük Excel/CSV düğmeleri yerine varsayılan kapalı küçük İşlemler menüsü. Ödeme ekranındaki tekrarlanan indirme/yeni kayıt düğmeleri kaldırıldı.

## Ekranlar arası oturum ve dönüş

Teksanor giriş sayfası artık mevcut oturumu kontrol eder. Geçerli oturum varsa yeniden parola formuna ihtiyaç olmadan çalışma alanına döner. Parola/MFA gerektiğinde dönüş adresi ekran, firma ve filtreyi korur; harici adres ve giriş döngüleri reddedilir. Firma seçimi birim/servis ekranından panele taşınır. Aynı oturumla panel → servis → birimler → panel API zinciri davranış testinde doğrulanır. Gerçek tarayıcıdaki bildirilen olay bu ortamda yeniden üretilemedi; bu nedenle tüm olası oturum kaybı nedenleri giderildi denmez.


## 40 maddelik durum matrisi

| # | Durum | Uygulama ve sınır |
|---|---|---|
| 2 | Uygulandı | Önizleme sahibi kestirmesi kaldırıldı; doğrulanmış platform sahibine personel kaydı ve ilk erişim güvenlik kaydı. Pasif kayıt yeniden açılmaz. |
| 5 | Uygulandı | TK firma sahibi, firma yöneticisi ve platform yöneticisi için MFA kurulmadan firma verisi açılmaz; kurulum ekranı erişilebilir. Üretim şifreleme anahtarı yapılandırılmış. |
| 6 | Uygulandı | TK tarama bağlantısı yokken yükleme durur; PDF zorunlu indirilir. Gerçek tarama servisi bağlı değildir. |
| 7 | Uygulandı | TK genel istisna mesajları API yanıtından çıkarıldı; tipli finans/doğrulama hataları kullanıcıya anlaşılır kalır. |
| 8 | Uygulandı | TK health yalnız kullanılabilirlik döndürür; sürüm/bağımlılık ayrıntısı gizli. Hazırlık API yöneticiye özel; açık sayfa iç risk listesini göstermez. |
| 9 | Uygulandı/kısmi | MFA ve saklama açıklamaları gerçek duruma göre düzeltildi. Otomatik imha veya tam KVKK uyumu iddia edilmez. |
| 12 | Kısmi | TK sunucuda 30 dakika istek hareketsizliği ve 12 saat mutlak oturum; tarayıcıda 30 dakika kullanıcı hareketsizliği. Hesap limiti IP değişimiyle aşılamaz. Rol düzenleme modülü yok. |
| 13 | Uygulandı | TK /kullanicilar ve PATCH /api/users/[id]. Firma üyeliği kapatma/açma; açık oturumları iptal etme; kendi hesabı ve son yönetici koruması; denetim kaydı. |
| 14 | Kısmi | TK harici AI öncesi telefon/e-posta/11 haneli kimlik/IBAN maskesi; eski geçmiş de aktarım öncesi maskelenir; bilgilendirme doğrulaması gerekli. Son 90 gün görünür. Otomatik imha ve ad/serbest sağlık metni tespiti yok. |
| 15 | Kısmi | İki üründe /gizlilik /aydinlatma /cerezler. TK kayıt formunda aydınlatma sürümü ve zaman kaydı. Kurum kimliği, hukuki sebep/alıcı/başvuru kanalı içeren nihai metin ve hukuki kontrol gerekli. |
| 17 | Bekliyor | Rıza kaydı sürüm/kaynak/geri çekilme genişletmesi tamamlanmadı. |
| 19 | Bekliyor | Veri işleme sözleşmesi ve olay müdahale planının kuruma özel hukuk incelemesi gerekli. |
| 21 | Kısmi | TK aktif ekran kaynak yüklemesi korunur; servis belgeleri sunucuda seçilen işe göre süzülür. Akış özeti toplamları sunucuda hesaplanır. Tüm eski listelere sayfalama henüz uygulanmadı. |
| 23 | Kısmi | TK Departmanlar ve Ar-Ge yinelenen menü girişleri kaldırıldı; tek Birimler ve süreçler bağlantısı korunur. Tüm eski genel bakış kartları ve boş ekran tekrarları henüz görsel taramadan geçmedi. |
| 24 | Uygulandı | TK Çalışan kayıtları menüsü artık İK süreçlerine zorla yönlendirmez; ayrı çalışan listesi açılır. |
| 26 | Kısmi | TK dikkat bağlantıları görev gecikmesi, kritik risk ve servis onay filtresini taşır. Genel geri al ve tüm bildirim derin bağlantıları hâlâ tamamlanmadı. |
| 27 | Kısmi | İki üründe ortak Field, alanın adını taşıyan Türkçe doğrulama mesajı ve ipucu desteği kullanır; yeni veri yönetimi formları yıldız/required/aria-required ile kuruldu. Eski formların tümü taşınmadı. |
| 28 | Önceden uygulandı | Kısa kullanım kılavuzları varsayılan kapalı. |
| 30 | Kısmi | İki üründe saklama politikası, süre, dayanak referansı, hukuki bekletme ve farklı yetkilinin onayı kaydedilir. Otomatik imha/anonimleştirme ve imha tutanağı henüz çalışmaz; hiçbir gerçek kayıt silinmedi. |
| 31 | Kısmi | İki üründe ilgili kişi başvurusu kaydı, teslim tarihinden 30 gün hedefi, kimlik kontrolü referansı, bağımsız gerekçeli karar ve yazılı yanıt belge referansı uygulandı. Kişiye mesaj gönderimi, kişi bazlı tam veri dışa aktarımı ve onaylı anonimleştirme henüz yok. |
| 32 | Bekliyor | MFA anahtarı şifrelemesi mevcut; müşteri/çalışan/transkript alanlarına sürümlü şifreleme ve eski veriyi taşıma tamamlanmadı. |
| 33 | Kısmi | İki kaynakta AES-256-GCM yedek dosyası şifreleme/açma aracı eklendi. Sentetik SQL geri yükleme ve bozuk dosyayı reddetme testleri geçti. Üretim dışa aktarım zamanlayıcısı, anahtar yedeği ve üretim geri dönüş tatbikatı tamamlanmadı. |
| 37 | Kısmi | TK servis fotoğrafları tarayıcıda yeni JPEG olarak kodlanır, uzun kenar en fazla 1600 piksel; eski EXIF/GPS metadata taşınmaz. Kamera capture seçeneği korunur. Çevrimdışı kuyruk ve mağaza dağıtımı hâlâ yok. |
| 38 | Önceden/kısmi | Hakkımızda ilkeleri gerçek özelliklere göre güncellendi; gizlilik sayfaları eklendi. Bu durum matrisi kanıt kayıtlarının başlangıcıdır; kurum imzalı iddia envanteri yok. |
| 39 | Harici süreç | KTS kapsamı, kurum sözleşmesi ve Türkiye barındırma doğrulaması kodla tamamlanmış sayılmaz. |
| 40 | Harici süreç | Bağımsız sızma testi veya ISO sertifikasyonu yapılmadı. |

## Güvenlik ve doğrulama sınırları

Alan adı izni platform kimliğinin kriptografik kanıtı değildir. Sites kimlik başlıklarını platform dispatch üretir; Worker alternatif adresleri reddeder. Kontrol düzlemi dağıtım ayarları bağımsız incelenmedi.

Okuma kayıtları içerik/transkript taşımaz. Saatlik kayıt, her satırın her görüntülenmesini ayrı ayrı kanıtlama garantisi değildir. Yeni kayıtların zincir başlığı ve HMAC koruması eklenmiştir; tarihsel kayıtların tamamı için bağımsız bütünlük denetimi yapılmış değildir.

Üretim verisinden satır silinmedi. Otomatik imha, alan şifreleme ve yedek taşıma, doğrulanmış saklama politikası ve geri yükleme planı olmadan eklenmedi. Maskeleme anonimleştirme değildir. Genel hukuk sayfaları sözleşme veya tam aydınlatma metni yerine geçmez.

Gerçek tarayıcı kontrolü bu ortamda desteklenmediği için ekran görüntüsü, mobil tıklama taraması ve FPS/kasma ölçümü yapılmadı. Sunucu davranış testleri, TypeScript kontrolü ve üretim derlemesi kullanılır.

## Kaynaklar

- KVKK 2018/10: https://www.kvkk.gov.tr/Icerik/4110/2018-10
- İlgili kişi başvuru yanıtı: https://www.kvkk.gov.tr/Icerik/2046/Ilgili-Kisiler-Tarafindan-Yapilan-Basvurularin-Cevaplanmasi-Yukumlulugu
- OWASP ASVS: https://owasp.org/www-project-application-security-verification-standard/

## Yayın ve kaynak

Değişiklikler Sites kaynak deposunda tutulur. GitHub main dalının bu turda değiştirildiği iddia edilmez. Kaynak ZIP içinde üretim parolası veya gizli anahtar bulunmaz.

## Ek uyarlama — 10 Ekim 2026




Kaynak rapor eski commitleri analiz ediyordu; başlangıç bulguları güncel kod için yeniden doğrulandı. Hukuki süre ve yanıt usulü birincil KVKK kaynaklarından kontrol edildi; report içindeki bütün dış pazar/tarih iddiaları doğrulanmış sayılmaz.

Birincil kaynaklar:
- https://www.kvkk.gov.tr/Icerik/2046/Ilgili-Kisiler-Tarafindan-Yapilan-Basvurularin-Cevaplanmasi-Yukumlulugu
- https://www.kvkk.gov.tr/Icerik/9024/ilgili-kisilerin-basvurularina-verilecek-cevabin-bildirim-usulune-iliskin-kamuoyu-duyurusu
- https://www.kvkk.gov.tr/Icerik/5441/KISISEL-VERILERIN-SILINMESI-YOK-EDILMESI-VEYA-ANONIM-HALE-GETIRILMESI-HAKKINDA-YONETMELIK
