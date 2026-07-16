# Teksanor Kurumsal Yönetim

Teksanor'un kurumsal tanıtım sitesi ile rol tabanlı finansal yönetim portalını aynı uygulamada birleştiren Vinext/Cloudflare projesi.

## Kapsam

- Kurumsal tanıtım ve çözüm alanları
- Tek giriş ekranı, yönetici ve kullanıcı rolleri
- Arka planda hazırlanan iki portal hesabı ve sade giriş ekranı
- Ödeme, borç ve gider takibi
- Alan Group nakit, döviz, elden ve ziynet borcu analizi
- TCMB günlük USD/EUR kuru ile otomatik TL karşılığı
- Excel içe aktarma, belge yükleme ve güvenli indirme
- Doğrudan kayıt ve işlem geçmişi
- D1 veri tabanı ve R2 dosya depolama

Bu panel iç yönetim ve karar desteği içindir; resmî muhasebe programı değildir.

## Komutlar

- `npm run dev`: geliştirme sunucusu
- `npm run build`: Cloudflare Worker çıktısı
- `npm run start`: derlenmiş Worker'ı yerelde çalıştırır
