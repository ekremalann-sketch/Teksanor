# Güvenlik Politikası

## Desteklenen sürüm

Güvenlik düzeltmeleri yalnızca `main` dalındaki güncel sürüm için değerlendirilir. Bu depo bir ürün prototipidir ve henüz genel kullanıma yönelik hizmet seviyesi taahhüdü vermez.

## Güvenlik açığı bildirme

Bir güvenlik açığı fark ederseniz ayrıntıları herkese açık issue, pull request veya tartışmada paylaşmayın. GitHub deposundaki **Security → Report a vulnerability** kanalını kullanın. Özel bildirim kanalı görünmüyorsa yalnızca açığın varlığını belirten, teknik ayrıntı ve veri içermeyen bir mesajla depo sahibine ulaşın.

Bildirimde mümkünse şunları belirtin:

- Etkilenen sayfa, API veya sürüm
- Güvenli biçimde yeniden üretme adımları
- Olası etki
- Önerilen düzeltme veya azaltma yöntemi

Parola, API anahtarı, erişim belirteci, gerçek müşteri verisi veya kişisel veri göndermeyin.

## Gizli bilgi yönetimi

- Secret değerleri kaynak koda, README'ye, issue'lara ve ekran görüntülerine eklenmez.
- Yerel `.env` dosyaları Git tarafından izlenmez.
- GitHub Actions yalnızca repository secret adlarına başvurur.
- Cloudflare erişim belirteçleri en az yetkiyle oluşturulmalı ve düzenli olarak yenilenmelidir.
- Şüpheli sızıntıda değer Git geçmişinden silinmeye çalışılmadan önce derhâl iptal edilip yenilenmelidir.

## Üretim öncesi güvenlik kapıları

Ticari veya gerçek müşteri kullanımından önce en az şu kontroller tamamlanmalıdır:

1. Kimlik doğrulama, oturum süresi, parola politikası ve hesap kilitleme testleri
2. Firma bazlı erişim ayrımının otomatik yetki testleri
3. Girdi doğrulama, dosya türü/boyutu kontrolü ve zararlı dosya taraması
4. CSRF, XSS, SSRF, rate limiting ve güvenlik başlıkları doğrulaması
5. D1 ve R2 yedekleme/geri yükleme tatbikatı
6. Denetim loglarının değiştirilemezliği ve saklama politikası
7. KVKK envanteri, aydınlatma metni, saklama ve silme süreci
8. Bağımlılık ve secret taramasının CI sürecine eklenmesi
9. Gözlemleme, hata alarmı ve olay müdahale planı
10. Bağımsız güvenlik incelemesi

## Kapsam notu

Canlı demo ortamı yalnızca sahte/demo veri için tasarlanmıştır. Gerçek finans, kimlik, çalışan veya müşteri verisi kullanılması desteklenmez.