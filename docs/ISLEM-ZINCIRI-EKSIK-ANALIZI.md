# Teksanor — işlem zinciri ve eksik analizi

9 Kasım 2026 · Kaynak: canlı Sites sürümü. Üç ürünlük ortak analizin yalnız Teksanor bölümü.

**Okuma kılavuzu.** Mevcut = kod veya davranış testi var. Kısmi = temel adım var, zincir tamamlanmıyor. Eksik = incelenen ilgili akışta gerekli işlem bulunamadı. Kapalı = kod veya altyapı temeli var, canlı yapılandırma kullanıma açmıyor. Doğrulanmadı = kuruma veya oturuma bağlı çalışma kontrol edilmedi. P0 pilotun önünü açar, P1 günlük kullanımı tamamlar, P2 ölçek ve entegrasyon işidir. Eski yayın testleri yeniden çalıştırılmadı.

Mevcut servis davranış testleri yönetici atamasını, teklif onayını, yalnız atanmış teknisyenin işlem yapmasını, sürüm çakışmasını, müşteri onay kilidini ve tam tahsilatla kapanışı kapsıyor. Bunun üzerine aşağıdaki kayıt ve karar adımları gerekli.

| Öncelik ve işlem | Durum ve kanıt | Tamamlanma ölçütü |
|---|---|---|
| P0 · Talep kabulü | Kısmi. Yönetici servis işi açabiliyor. Servis API’sinde müşteri başvurusundan iş emrine ayrı kabul kuyruğu görünmüyor. | Talep alındı → bilgi istendi / reddedildi / kabul edildi. Kabul tek bir iş emri üretir ve talep numarası korunur. |
| P0 · Teklif kalemleri ve revizyon | Kısmi. `service_jobs.quote_cents` toplam tutarı tutuyor, onay aşamayı değiştiriyor. | Miktar, birim fiyat ve işçilik satırları, teklif sürümü, ret/revizyon nedeni. Onaylanan sürüm tekrar açıldığında aynı kalemleri gösterir. |
| P0 · Bir işte birden fazla ziyaret | Kısmi. Planlama tarihi ve sorumlu var. İncelenen servis şemasında ziyaret başına zaman, sonuç ve teknisyen zinciri görünmüyor. | İlk ziyaret parça bekliyor olarak kapanır. İkinci ziyaret ayrı tarih ve sorumluyla aynı dosyada açılır. |
| P0 · Parça ve depo hareketi | Kısmi. Parça maliyeti toplam alan olarak tutuluyor. İncelenen servis işleminde rezervasyon, tüketim ve iade hareketleri yok. | Parça ayrılır, kullanılan miktar düşer, fazlası iade edilir. Aynı gönderim iki stok hareketi üretmez. |
| P0 · Tahsilat hareketleri | Kısmi. Ödenen ve kalan toplam ile aşama kontrolü var. Servis dosyasında ayrı tahsilat olayları bu incelemede doğrulanmadı. | 1.000 TL işe 400 ve 600 TL iki ayrı hareket kaydedilir. İptal/iade gerekçesi ve önceki hareket korunur. |
| P0 · Canlı rol kabulü | Doğrulanmadı. API rol testleri var. Canlı yönetici/teknisyen/müşteri zinciri tamamlanmadı. | Üç rol kendi adımını tamamlar. Başka firmanın kaydı, iç maliyet veya düzenleme yetkisi istemci ve sunucuda sızmaz. |
| P1 · Kanıt ve ekler | Kapalı. Canlı sağlık yanıtı depolamayı mevcut, dosya yüklemeyi kapalı gösterdi. API güvenli tarama yapılandırmasını da arıyor. | Temiz dosya yüklenir, zararlı veya taranamayan dosya karantinaya düşer, sadece yetkili kişi indirir. |
| P1 · Çevrimdışı saha kaydı | Kısmi. Cihazda not taslağı var. İşlem kuyruğu ve bağlantı gelince senkron yok. | Bağlantısız kaydın beklediği görülür, yeniden bağlantıda bir kez işlenir. Sunucu değişmişse taslak korunup çakışma gösterilir. |
| P1 · Servis geri dönüşü | Kısmi. Tekrar açma, yeni forma önceki bilgileri taşıyor. Şemada kalıcı önceki iş bağı bu taramada bulunmadı. | Tekrar arızası önceki iş, ekipman ve varsa garantiyle bağlantılı açılır. Önceki onaylı dosya değişmez. |
| P1 · Sevk ve istisna | Kısmi. Temel servis aşamaları var. Yolculuk, varış, müşteri yok ve tekrar planlama ayrı ziyaret olayları olarak görünmüyor. | Atama kabulü, yol, varış ve ziyaret sonucu zamanlanır. İptal veya gecikme sorumlunun kuyruğuna düşer. |
| P2 · Bakım sözleşmesi ve fatura | Kısmi. Bakım planı ve UBL taslağı var. Sözleşmeden tekrarlı iş, ziyaret ve muhasebe mutabakatı zinciri doğrulanmadı. | Bakım vadesi tek iş üretir. Ücret kapsamı işte görünür. Entegrasyon açıldığında gönderim, ret ve tekrar deneme kaydı tutulur. |

**İnceleme dayanakları:** `lib/service.ts`, `app/api/service/jobs/route.ts`, `app/servis/page.tsx`, `tests/workflow-e2e.test.mjs`, `tests/field-extras.test.mjs`, `app/api/health/route.ts`. Canlı sağlık uç noktası eski kaynak kimliğini döndürüyor. Derlemede Git HEAD kullanıldığı ve Sites kaynak commit’i sonradan oluştuğu için bu alan tek başına eski kodun çalıştığını kanıtlamaz. Paket kimliği ile çalışma zamanı kimliğini eşleştirmek izlenebilirlik işi olarak açılmalı.

## Uygulama sırası

**Teksanor:** aynı işte iki ziyaret, parça hareketi, sürümlü teklif ve iki tahsilat. Yönetici, teknisyen ve müşteri aynı iş numarası üzerinden kendi adımını tamamlar.

## 9 Kasım yayın durumu

| Ürün | Sites sürümü | Kaynak | Test | Canlı doğrulama |
|---|---:|---|---:|---|
| Teksanor | 56 | `f13f7e6` | 332/332 | `/giris` HTTP 200, CSP mevcut. |

| İş | Durum |
|---|---|
| Teksanor tekrar servis kaydı | Önceki işe kalıcı bağlantı, firma denetimi ve çift gönderim koruması uygulandı. |
| Teksanor tahsilat geçmişi | Yeni değişiklikler önceki ve sonraki tutar, kayıt sürümü, zaman ve aktörle birlikte saklanıyor. Yönetici geçmişi servis dosyasından görüyor. Bu kayıt, bağımsız ödeme, iade ve muhasebe mutabakatı zincirinin ilk adımı. |
| Teksanor çoklu ziyaret | Servis dosyasından ayrı tarih ve teknisyenle ziyaret planlanabiliyor. Parça bekleme veya müşteri bulunamaması kaydedilip aynı işte sonraki ziyaret açılabiliyor. Açık ziyaret varken iş kapatılamıyor. Rota, stok ve satın alma bağlantıları ayrı iş. |

## Karşılaştırma kaynakları

- [Dynamics 365 iş emri mimarisi](https://learn.microsoft.com/en-us/dynamics365/field-service/field-service-architecture) ve [bakım sözleşmeleri](https://learn.microsoft.com/en-us/dynamics365/field-service/agreements-overview)
- [MaintainX iş emirleri](https://help.getmaintainx.com/about-work-orders)
