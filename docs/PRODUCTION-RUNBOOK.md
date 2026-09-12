# Teksanor üretim işletim rehberi

## Yönetici hesabını kurtarma

1. Cloudflare Pages üretim ortamında yalnızca kurtarılacak hesaba ait
   `ADMIN1_PASSWORD` veya `ADMIN2_PASSWORD` secret değerini yeni ve benzersiz bir
   parolayla değiştirin.
2. Yeniden dağıtım tamamlandıktan sonra ilgili kullanıcı adı ve yeni parolayla
   giriş yapın. İlk başarılı giriş parolayı D1 üzerinde yeniden hash'ler, eski
   oturumları ve bekleyen MFA giriş denemelerini kapatır, işlemi denetim kaydına
   yazar.
3. Hesap ayarlarından gerçek e-posta adresini doğrulayın ve MFA'yı etkinleştirin.
4. Parolayı GitHub, kaynak kodu, issue, log veya belgeye yazmayın.

## Üretim bağımlılıkları

- D1 binding adı: `DB`
- İsteğe bağlı R2 binding adı: `UPLOADS`. Mevcut demo R2 olmadan çalışır;
  dosya yükleme kapalıdır. Billing/subscription etkinleştirilmez.
- Uygulama kökü: `APP_ORIGIN=https://teksanor.pages.dev`
- E-posta: `RESEND_API_KEY` ve doğrulanmış `MAIL_FROM`
- MFA: en az 32 baytlık `MFA_ENCRYPTION_KEY`
- Zorunlu dosya taraması kullanılacaksa `FILE_SCAN_REQUIRED=true`, HTTPS
  `FILE_SCAN_URL` ve `FILE_SCAN_TOKEN`

`/api/health` yanıtı `ok:true` vermeden üretim hazır kabul edilmez. Yanıttaki
`version`, GitHub `main` commit SHA'sıyla aynı olmalıdır.
`capabilities.storage=disabled` temel demoyu arızalı yapmaz; dosya işlemleri
hazır kabul edilmez. Bağlanmış fakat erişilemeyen bucket yine 503 üretir.

## Yedek ve geri dönüş

- D1 dışa aktarımı ve R2 nesne kopyası aynı tarih/sürüm etiketiyle saklanır.
- Yedekler uygulamanın herkese açık depolama alanında tutulmaz.
- Her ay izole bir D1/R2 ortamına geri yükleme yapılır.
- `PRAGMA integrity_check`, yabancı anahtar kontrolü, kullanıcı girişi, belge
  indirme ve servis kaydı açma test edilmeden tatbikat başarılı sayılmaz.
- Tatbikat tarihi, süre, sorumlu ve sonuç denetim kaydında tutulur.

## Yayın kabulü

GitHub Actions sırasıyla test, tip kontrolü, yüksek önem seviyesinde bağımlılık
denetimi, derleme ve dağıtım yapar. Yayından sonra üretim dalının `main` olduğu,
sağlık yanıtının doğru commit'i gösterdiği ve genel sayfaların açıldığı doğrulanır.
Başarısız yayın eski çalışan sürümün ayrıca incelenmesini gerektirir; aynı arıza
için zamanlanmış e-posta döngüsü açılmaz.
