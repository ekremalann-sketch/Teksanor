# Teksanor operasyon ve güvenlik prosedürü

## Günlük işletim

- D1 için günlük değişiklik hacmi ve hata oranı izlenir.
- R2 dosya sayısı, toplam boyut ve başarısız yüklemeler izlenir.
- Kritik finans işlemleri `audit_logs` üzerinden firma, kullanıcı, işlem ve zaman bilgisiyle takip edilir.
- Firma ayrımı testleri ve finans hesaplama testleri her yayın öncesinde çalıştırılır.

## D1 yedekleme ve geri yükleme

1. Cloudflare D1 Time Travel saklama süresi ve hesabın desteklediği geri dönüş noktaları aylık kontrol edilir.
2. Haftada bir şifreli SQL dışa aktarımı alınır; üretim hesabından ayrı ve erişimi sınırlı bir depoda saklanır.
3. Yedekler 30 günlük döngüyle tutulur. Ay sonu yedeği 12 ay saklanır.
4. Geri yükleme önce yeni bir test D1 veritabanına yapılır. Satır sayıları ve firma ayrımı doğrulanmadan üretim bağlantısı değiştirilmez.
5. Üretim geri dönüşünde işlem saati, neden, uygulayan kişi ve doğrulama sonucu olay kaydına yazılır.

## R2 yedekleme ve geri yükleme

1. R2 nesne sürümleme veya ayrı bir yedek bucket politikası etkinleştirilir.
2. Silme yetkisi günlük uygulama anahtarından ayrılır; toplu silme yalnızca ayrı yönetici anahtarıyla yapılır.
3. D1 `attachments.object_key` kayıtlarıyla R2 nesneleri haftalık olarak karşılaştırılır.
4. Geri yüklenen dosyanın boyutu, içerik türü ve güvenlik imzası yeniden doğrulanır.

## Kimlik güvenliği için tamamlanması gereken dış servisler

- E-posta doğrulama ve parola kurtarma için alan adı doğrulanmış bir e-posta sağlayıcısı gerekir.
- Yönetici 2FA için TOTP sırları uygulama kodunda veya D1 içinde düz metin tutulmamalı; ayrı anahtar yönetimiyle şifrelenmelidir.
- Kurtarma kodları tek kullanımlık ve hashlenmiş tutulmalıdır.
- E-posta ve 2FA kurulmadan arayüzde bu özellikler etkinmiş gibi gösterilmemelidir.

## Dosya güvenliği

Mevcut uygulama boyut, izin verilen tür, uzantı, dosya imzası ve temel aktif içerik kontrolü yapar. Bu kontrol bir antivirüs motoru değildir. Kurumsal kullanımda yüklemeler önce karantina alanına alınmalı ve ClamAV veya yönetilen bir zararlı yazılım tarama servisi temiz sonucu vermeden kullanıcılara açılmamalıdır.
