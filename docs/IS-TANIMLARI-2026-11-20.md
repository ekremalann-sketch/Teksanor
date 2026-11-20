# Firma iş tanımları — 20 Kasım 2026

Teksanor artık sabit bir şablon değil: her firma kendi birimlerini ve iş türlerini tanımlar, sistem bu tanıma göre çalışır.

## Ekranlar

- **/birimler/is-tanimlari** (firma sahibi / yöneticisi düzenler; üst yönetim ve birim yöneticisi görüntüler)
  - Yeni birim: ad, kısa ad, görev, birimi yöneten roller.
  - Yeni süreç türü: bilgi alanları (metin, sayı, tarih, seçim), sıralı aşamalar, aşama başına onaylayan roller, hedef gün, çıkış için zorunlu bilgiler.
  - **Reddedilirse:** "Reddedildi" sonucuyla kapat ya da düzeltme için önceki bir aşamaya geri gönder.
  - **Kapanınca:** belirli bir sonuçta (Reddedildi dahil) başka birimde kendiliğinden açılacak süreçler.
  - Hazır süreç türleri salt okunur; "Kopyala ve uyarla" ile firmaya göre değiştirilir. Firma süreç türü yeni kayıtlara kapatılabilir; eski kayıtlar okunmaya devam eder.
- **/birimler**: "Onayınızı bekleyen işler" listesi. İş, onay aşamasına gelince o aşamanın rolüne (finans, İK, bilgi işlem, üst yönetim) birimin üyesi olmasa da düşer; karar (Onayla / Reddet) buradan verilir.
- Süreç panelinde onay aşamasında **Reddet** düğmesi (gerekçe zorunlu).

## Kurallar (sunucuda)

- Tanımı yalnız firma sahibi / yöneticisi değiştirir; her değişiklik denetim izine yazılır, sürüm kontrolü vardır.
- Açık süreçlerin bulunduğu aşama silinemez; süreç kaydı olan birim silinemez.
- Birim dışından onay yalnız işlevsel rollere açıktır; "Birim yöneticisi" ve "Çalışan" yalnız kendi biriminde karar verir.
- Talep eden kendi talebini onaylayamaz / reddedemez. Ret gerekçesi zorunludur.
- Retle kapanan süreçte yalnız açıkça "Reddedildi" sonucuna bağlanmış takip süreçleri açılır.
- Firma tanımları başka firmaya görünmez; HTML etiketleri temizlenir; başka kökenden istek reddedilir.

## Kaldırılanlar

- "Örnek işletme" (kurgusal tanıtım firması) özelliği: sayfa, API, veri dosyası ve testi.
- Birim ekranındaki "[Örnek] süreçleri ekle" işlemi.
- Ana sayfadaki "kurgusal örnek" ve "pilot döneminde ücretsiz" ifadeleri.

## Canlıya almadan önce

- `drizzle/0002_firma_is_tanimlari.sql` üretim D1'e uygulanmalı (`wrangler d1 migrations apply teksanor-db --remote`). Migrasyon uygulanmadan kod çalışır; yalnız hazır katalog kullanılır.

## Doğrulama

`tests/org-workflows.test.mjs` (8 senaryo). Tüm test paketi: 414/414. TypeScript ve Pages derlemesi başarılı.
