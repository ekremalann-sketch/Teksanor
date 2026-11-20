# Teksanor kurumsal işleyişi

Kurumsal sitede hizmet, referans, servis talebi ve takip görünür. İşletme panelinde Bugün, İşler, Onaylar, Birimler ve Raporlar ana menüyü oluşturur. Teknisyen mobilde atanan iş, kontrol listesi, belge ve sonraki adımı görür. Müşteri kendi teklifi, onayı ve teslim evrakına erişir.

| Başlangıç | Süreç | Sonraki birim |
|---|---|---|
| Servis talebi | Keşif, teklif, müşteri kararı, planlama, saha, teslim | Finans veya garanti |
| Satış fırsatı | İhtiyaç, teklif, iç onay ve müşteri kararı | Proje veya servis |
| Satın alma | Talep, teklifler, bütçe onayı, sipariş, teslim | Stok ve finans |
| İK | Talep, belgeler, yönetici kararı | Vardiya veya BT |
| Finans | Ödeme isteği, belge kontrolü, yetkili karar | Mutabakat |
| Kalite veya hukuk | Olay, inceleme, karar, kanıt | Düzeltici faaliyet veya sözleşme |

Mevcut Birimler ekranı süreç ağını gösterir ve tanımlı sonuçlarda takip işlerinin başlatıldığını bildirir. Servis, satın alma ve finans modüllerinde bu davranışın kapsamı ayrı doğrulanır. Bağlı iş kaydı firma, kaynak iş, hedef birim ve atanmış sorumlu taşır. Onay hedef kuyruğuna geçirir, ret gerekçesiyle mevcut sorumluya döner. Sürüm ve tekil olay kimliği üzerinden aynı kararın ikinci iş üretmesi engellenir. İzlenebilirlik kaydı, durum güncellemesiyle birlikte yazılır. API karar cevabı ekranın kullanacağı kayıt kimliği ve aşamayı taşır.

Firma ayrımı her sorguya taşınır. Görüntüleme, düzenleme ve imza yetkileri ayrı tutulur. Finans ve satın almada tutara göre ikinci göz kontrolü uygulanır. Ekler depolama ve zararlı içerik kontrolü aktifken kabul edilir. Finans, müşteri ve sözleşme verilerinin dış hizmetlere aktarımı ayrıca yetkilendirilir.

Kabul testleri iki firmanın kayıt izolasyonu, bağlı işin oluşması, müşteri reddi, tutar değişince eski onayın geçersizliği, eşzamanlı karar, saha çevrimdışı taslak, ödeme kontrolü ve yedekten dönmeyi kapsar.

- [Dynamics 365 iş emri yaşam döngüsü](https://learn.microsoft.com/en-us/dynamics365/field-service/work-order-status-booking-status)
- [Odoo saha görev formları](https://www.odoo.com/documentation/20.0/applications/services/field_service/worksheet.html)
