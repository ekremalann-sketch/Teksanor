# Tasarım denetimi uygulaması — 26 Ekim 2026

Bu dal main 4715c7d üzerinden açıldı; denetim atomikliği PR #30'dan ayrıdır. Ana dala birleştirme veya canlı yayın yapılmadı.

## Uygulananlar

- K1: içgörü kartı iki sütuna, mobilde tek sütuna düzeltildi. Başlık 1440 pikselde tek, 375 pikselde iki satır olarak ölçüldü.
- K2: ana sayfadan PublicMarket kullanımı kaldırıldı. PublicMarket bileşeni, kur hesapları, API'ler ve Finans ekranı korunur.
- K3: hedeflenen içgörü etiketleri 12 piksel; açık zeminde koyu altın, koyu zeminde açık altın. Alt bilgi dış bağlantısı alt çizgili; yeni ana sayfa hedefleri en az 44/48 piksel yüksekliğinde.
- K4: ana sayfa beş içerik bölümü + alt bilgiye indirildi: giriş, üç fayda, örnek servis zinciri, çalışma alanları ve pilot. Büyük içgörü bölümü silinmeden /icerikler sayfasına taşındı; mevcut dört yazı adresi korunur. Yapay zekâ asistanına ve yazılara alt menüden erişilir. Yeni liste sayfasının kanonik adresi ve sitemap kaydı eklendi.
- K5: renk, 7 basamaklı yazı ölçeği ve boşluklar için tokens.css eklendi. Yeni tasarım dosyaları Stylelint color-no-hex uyarısıyla denetlenir; eski CSS'in tamamı bir anda taşınmadı. lint ve ci bu renk denetimini çalıştırır.
- Giriş ve pilot bağlantılarının metinleri sadeleştirildi. Yeni sade menü yapısı değişmedi; yalnız “Diğer modüller” ve “Nakit ve borçlar” metinleri güncellendi.

## Ölçüm ve doğrulama

Yerel derleme, aynı Windows tarayıcısı, 900 piksel viewport yüksekliği:

| Genişlik | Önce | Sonra |
|---|---:|---:|
| 1440 px | 8981 px | 2195 px |
| 375 px | 14663 px | yaklaşık 3350 px |

Yatay sayfa taşması yok. Windows kaydırma çubuğu kullanılabilir içerik genişliğini 15 piksel azaltır; denetim scrollWidth <= innerWidth üzerinden yapıldı. Bunlar canlı performans veya kullanıcı pilotu ölçümleri değildir.

npm test: 235/235; tsc --noEmit, lint, lint:styles ve build:pages başarılı. Bu dal main test tabanını kullanır; #30'daki 28 denetim testi ayrı PR'dadır.

Yerel axe-core 4.14.0 ile ana sayfa ve İçgörüler 375/1440 genişliklerde WCAG 2 A/AA, 2.1 AA ve 2.2 AA etiketleriyle tarandı. Taranan kurallarda ihlal bulunmadı; bazı görsel/gradyan alanları araç tarafından elle incelemeye bırakıldı. Ekran görüntüleri ayrıca incelendi. Lighthouse puanı, ekran okuyucuyla gerçek kullanıcı testi veya tam erişilebilirlik uygunluğu iddia edilmez.

## Korunanlar ve sınırlar

API, firma ayrımı, kimlik doğrulama, MFA politikası, denetim kaydı, veri tabanı ve finans hesapları değişmedi. Banka borcu/asgari ödeme kartları FinancialOverview içinde yalnız active=financial durumunda gösterilir; saha ana ekranında oldukları varsayımıyla silinmedi. Kamuya açık site metinleri, mevzuat veya klinik uygunluk belgesi değildir. Eski PR/dal kapatılmadı; güvenlik PR #25 birleştirilmedi.

PR ekran kanıtları docs/design-review/ altında bulunur; yalnız yerel kurgusal önizlemedir.
