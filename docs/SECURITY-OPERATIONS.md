# Teksanor güvenlik ve işletim standardı

Bu belge, Teksanor’un üretim ortamında uygulanacak teknik sınırları ve düzenli işletim adımlarını tanımlar.

## Uygulanan kontroller

- Parolalar PBKDF2-SHA256, kullanıcıya özel salt ve zaman sabitli karşılaştırmayla doğrulanır.
- Yönetici hesaplarında Authenticator uyumlu TOTP iki aşamalı doğrulama zorunludur.
- TOTP sırları D1 içinde AES-256-GCM ile şifreli saklanır; şifreleme anahtarı uygulama kodundan ayrı, gizli ortam değişkenindedir.
- Oturum çerezi `HttpOnly`, `Secure` ve `SameSite=Lax` özelliklerini taşır.
- Değişiklik yapan API isteklerinde kaynak doğrulaması uygulanır.
- Her iş kaydı `organization_id` ile çalışma alanına bağlanır; rol profili hem görüntüleme hem düzenleme yetkisini sınırlar.
- Dosyalar firma kimliğiyle başlayan ayrı R2 yollarına yazılır.
- Yüklenen dosyalarda boyut, uzantı, MIME, dosya imzası ve aktif içerik politikası kontrol edilir.
- Önemli işlemler firma bağlamlı denetim günlüğüne kaydedilir.
- CSP, HSTS, çerçeveleme, MIME ve referrer güvenlik başlıkları uygulanır.

## Dosya güvenliği sınırı

Mevcut denetim, dosya türü sahteciliğini ve açık aktif içerik örneklerini engeller; tam antivirüs motoru değildir. Kurumsal canlı kullanım öncesinde dosya yükleme akışı bir zararlı içerik tarama servisine bağlanacak, dosya tarama tamamlanana kadar karantinada tutulacaktır. Tarama servisi bağlanmadan yükleme özelliği yalnızca kontrollü pilot kapsamındaki güvenilir kullanıcılarla kullanılacaktır.

## D1 ve R2 yedekleme / geri dönüş provası

1. D1 veritabanı için düzenli dışa aktarma veya platformun zaman yolculuğu imkânı doğrulanır.
2. R2 nesne listesi ve nesne sürümü/saklama politikası kayıt altına alınır.
3. Her ay izole bir test ortamına D1 geri yüklemesi yapılır.
4. Aynı firma için örnek bir belge R2’den geri getirilir ve veritabanındaki ek kaydıyla eşleştiği doğrulanır.
5. Başlama zamanı, bitiş zamanı, kayıt sayısı, başarısız nesneler ve alınan aksiyon denetim kaydına yazılır.
6. Geri dönüş provası başarısızsa yeni müşteri geçişi durdurulur; sorun giderilmeden tatbikat başarılı sayılmaz.

## Olay müdahalesi

1. Şüpheli oturum ve anahtar erişimi kapatılır.
2. Etkilenen firma, kullanıcı, zaman aralığı ve veri türü belirlenir.
3. Denetim kayıtları değiştirilmeden saklanır.
4. Gerekli anahtarlar ve oturumlar yenilenir.
5. Veri ihlali niteliği varsa hukuki bildirim takvimi başlatılır.
6. Düzeltme sonrasında tenant izolasyonu, yetki ve geri dönüş testleri yeniden çalıştırılır.

## Üretime geçiş kapısı

Aşağıdaki maddeler tamamlanmadan ürün genel kullanıma açılmaz:

- doğrulanmış alan adına bağlı e-posta doğrulama ve parola kurtarma taşıyıcısı;
- zararlı dosya taraması ve karantina;
- başarılı D1/R2 geri dönüş provası;
- tenant, rol, finans ve dosya akışları için otomatik uçtan uca test;
- KVKK aydınlatma, veri işleme eki, saklama-imha ve olay müdahale metinleri;
- abonelik, yenileme, iptal ve faturalama akışı.
