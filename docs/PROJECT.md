# Teksanor Proje Dosyası

## Yönetici özeti

Teksanor, teknik servis, bakım ve mühendislik ekiplerinin iş emri, saha ziyareti, ekipman, periyodik bakım, belge ve operasyonel finans kayıtlarını tek çalışma alanında ilişkilendiren ürün prototipidir.

## İş problemi

Kayıtların Excel, mesajlaşma uygulamaları, e-posta ve fiziksel formlar arasında dağılması; işin durumunu, sorumlusunu, mali etkisini ve denetim geçmişini görmeyi zorlaştırır.

## Hedef kullanıcılar

- Teknik servis ve bakım yöneticileri
- Saha ekipleri ve mühendisler
- Operasyon ve finans sorumluları
- Küçük ve orta ölçekli mühendislik işletmeleri

## Temel iş akışı

Talep → iş emri → ekip/varlık ataması → saha kaydı → servis formu → tahsilat ve denetim geçmişi.

## Ürün kapsamı

| Alan | Mevcut durum | Pilot kanıtı |
|---|---|---|
| İş emri ve saha | Çalışan prototip | Bir işin uçtan uca kapanması |
| Varlık ve bakım | Çalışan prototip | Bakım geçmişi ve sonraki tarihin oluşması |
| Rol ve firma ayrımı | Uygulandı; müşteri ortamında doğrulanmalı | Yetkisiz çapraz erişimin engellenmesi |
| Finansal görünüm | Operasyonel takip | Resmî muhasebe olmadığı açıkça korunur |
| Belge yönetimi | Altyapı mevcut | Hedef ortamın depolama ve tarama politikası |
| CI/CD ve güvenlik taraması | Aktif | Test, derleme, secret ve CodeQL sonuçları |

## Başarı ölçütleri

- Açık işlerin ve sorumluların tek ekrandan görülebilmesi
- Geciken bakım ve saha işlerinin ölçülebilmesi
- Servis kaydına ulaşma süresinin azalması
- Yetkisiz firma/rol erişiminin otomatik testlerle engellenmesi
- Pilot kapsamındaki kritik akışların kabul testinden geçmesi

## Ticari aşamalar

1. **Keşif:** İş akışı, kullanıcılar, veri kaynakları ve riskler belirlenir.
2. **Kontrollü pilot:** Tek ekip veya tek iş akışı, sınırlı veriyle 6–12 hafta denenir.
3. **Kabul:** Ölçütler, güvenlik ve kullanıcı geri bildirimi birlikte değerlendirilir.
4. **Kurulum:** Başarılı pilot için entegrasyon, destek ve veri sorumluluğu sözleşmeyle tanımlanır.
5. **Ölçekleme:** Yeni ekip, firma ve modüller ölçülerek eklenir.

## Dürüst sınır

Bu dosya proje sunumudur; canlı müşteri kabul belgesi değildir. Genel SaaS satışı için yol haritasındaki üretim kapıları tamamlanmalıdır.
