# Denetim kaydı ve veri değişikliği — 26 Ekim 2026

## Doğrulanan bulgu ve değişiklik

Öncelikli uçlarda veri değişikliği ve `addAudit` ayrı bekleniyordu. Denetim yazımı başarısız olduğunda veri değişikliği geri alınmıyordu. Bu PR 26 işlem yolunda değişikliği ve denetimi aynı D1 `batch` işlemi içinde yapar. Yalnız bu kapsam için atomiklik doğrulanmıştır; uygulamanın tüm uçlarının düzeltildiği iddia edilmez.

| API | İşlemler |
|---|---|
| asset-types | DELETE |
| projects | POST |
| employees, tasks, customers, procurement, risks | POST, PUT, DELETE |
| customers/[id]/interactions | POST |
| assets/[id] | PUT, DELETE |
| department-workflows | create, advance/onay/reddet için ortak güncelleme yolu |
| auth/mfa/setup | defer, recovery-codes, disable, enable |

`auditStatement` çalıştırılmamış, batch'e eklenebilir bir sorgu döndürür. Mevcut `addAudit` arayüzü korunur. Silme ve koşullu iş akışı güncellemesinde audit, aynı batch'te hemen önceki yazma gerçekten değişiklik yaptığında eklenir. Böylece olmayan/yabancı/sürümü değişmiş kayda sahte denetim oluşturulmaz. Yetki kontrolleri, firma filtreleri, başarılı yanıt biçimleri, 403/404/409 davranışları korunur.

MFA etkinleştirme/kapatmada yeni oturum artık hazırlanıp güvenlik değişikliği, eski oturumların silinmesi ve denetimle birlikte yazılır. Denetim veya yeni oturum yazımı başarısızsa eski güvenlik durumu ve eski oturumlar korunur. Varsayılan MFA modu değiştirilmez; zorunlu MFA eklenmez. Geçici kurulum anahtarını hazırlayan `start` işleminin mevcut davranışı değiştirilmemiştir.

## Kanıt

`tests/atomic-audit.test.mjs`: 28 davranış testi. Her değişiklik yolunda denetim INSERT'ini bilerek hata veren veritabanı tetikleyicisi kullanılır; önceki kayıt ve denetim durumu karşılaştırılır. MFA için güvenlik ayarı, oturumlar ve bekleyen doğrulama istekleri korunur. Varlık silmenin bağlı bakım kaydını da geri aldığı denetlenir. Firma dışı erişim, olmayan kayda 404, başarılı yanıtlar ve eşzamanlı iş akışında yalnız tek ilerleme/denetim kapsanır. Önceden atomik olan assets POST da gerileme testiyle kapsanır.

Tüm veri kurgusaldır. Canlı kayıt veya gerçek hasta/personel verisi testlerde kullanılmaz. Mevcut 235 teste 28 test eklenir: toplam 263.

## Gelen raporun diğer iddiaları

- Teksanor #25 ve Klinorbis #19 inceleme tarihinde açık ve birleştirilmemiştir. Bu PR bunları birleştirmez ve güvenlik politikalarını değiştirmez.
- “İki ana dalda otomatik taramalar hiç çalışmıyor” genellemesi doğru değildir. Teksanor ana dalında `repository-security.yml`, `security.yml` ve `codeql.yml` zaten vardır; push/main ve PR tetikleyicileri içerir. Klinorbis ana dalında `ci.yml` ve `automation-tick.yml` bulunur; #19'daki ayrı güvenlik iş akışları henüz ana dalda değildir.
- Dört gizli bilgi adayının yanlış alarm olduğu bu çalışma kapsamında bağımsız olarak doğrulanmadı. Yeni tam geçmiş gitleaks veya yeni npm audit taraması yapılmadı; gelen sayılar yeni tarama sonucu olarak sunulmaz. Özellikle gerçek bir anahtarı yalnız alarmı susturmak için istisnaya almak doğru olmaz.
- Bir görevin hesaptan silindiği, kimin sildiği ve 08:52/19:52 zamanlamasının kurulduğu bu çalışmada doğrulanmadı. Silinmiş görev kendi başına çalışıp silindiğini bildiremez; böyle bir garanti bağımsız bir takip gerektirir. Bu PR zamanlanmış görev oluşturmaz veya değiştirmez.

## Kapsam dışı kalan noktalar

`addAudit` başka rotalarda da vardır (örneğin bakım, saha ziyaretleri, otomasyonlar, ödemeler/giderler, kullanıcı/parola/giriş, bildirimler ve dosya yükleme). Yalnız fonksiyon adının bulunması bütün akışın aynı sorun veya aynı düzeltme olduğu anlamına gelmez. Özellikle R2, harici bildirim veya ağ çağrıları SQLite batch ile geri alınamaz; bu akışlar ayrıca değerlendirilmelidir. Bu PR'ın kapsamı yukarıdaki öncelikli listedir.

Ana dala birleştirme ve canlı yayın bu değişiklik için ayrıca kullanıcı onayı gerektirir; bu PR hazırlanırken yapılmaz.
