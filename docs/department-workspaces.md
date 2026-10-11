# Birim çalışma alanları — 5 Ekim 2026

Departmanlar ve Ar-Ge menüleri ayrı çalışma alanlarını açar. İnsan kaynakları ekranında birim işleri ve mevcut personel listesi birlikte bulunur. 13 birim için süreç şablonları, sorumlu, termin, aşama, onay sorumlusu ve kalıcı işlem geçmişi eklendi.

İK: işe giriş, izin, vardiya, eğitim, ayrılış. Ar-Ge: fikir/değerlendirme/bütçe/deney/sonuç onayı ve deney süreci. Diğer birimler: yönetim, finans, muhasebe koordinasyonu, mühendislik, saha, satın alma, satış, destek, bilgi teknolojileri, hukuk ve kalite.

Kayıtlar mevcut D1 tasks tablosunda UNIT-WORKFLOW önekiyle saklanır. Genel görev uçları bunları göstermez veya değiştirmez. Birim API'si ilgili modülün sunucu yetkisini uygular. Onay yalnız atanmış firma sahibi/yöneticisi tarafından verilir; eski sürümle işlem reddedilir. İade ilk aşamaya döner; açıklama zorunludur.

Bu iş akışları ödeme, bordro, dış sipariş veya kullanıcı hesabı açma işlemini otomatik yapmaz. Bunların uygulaması ilgili mevcut modülde ayrıca teyit edilir. Dosya yükleme durumu değişmedi. Süreç başlıklarına hassas özlük bilgisi yazılmamalıdır.

Doğrulama: mevcut 152 test geçti; eklenen iki davranış testi de geçti. TypeScript ve üretim derlemesi başarılı. Üretim npm audit kontrolü 6 yüksek, 5 orta uyarı bildiriyor (bir kısmı aynı alt bağımlılıktan taşınıyor); bu nedenle yeni sürüm canlıya alınmadı. Bu kaydedilmiş geliştirme kaynağı GitHub main veya mevcut canlı sürüm diye sunulmamalıdır.
