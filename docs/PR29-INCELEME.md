# PR #29 inceleme düzeltmeleri

Firma tanımlı ekipman türleri ve sade menü korundu. Varlık oluşturma, seçilirse bakım planı ve denetim kaydı tek D1 işlemiyle yazılır; herhangi biri başarısızsa tümü geri alınır. Bakım sıklığı 1–999 arasında tam sayı olmalıdır. Tanımsız türden otomatik bakım oluşturulmaz. Aynı türün eşzamanlı başvurusu tek kayıt üretir; denetim hatasında tür de geri alınır.

Canlı Sites sürümündeki `requestSafeInitializer` düzeltmesi bu dala taşındı: iptal edilmiş bir isteğin bekleyen başlangıç işlemi sonraki girişleri kilitlemez. Ekipman türü tablosu ayrı eklemeli kurulur; mevcut v5 veritabanında eski veri kopyalama/kurulum adımları yeniden çalıştırılmaz. Zorunlu MFA eklenmedi.

Doğrulama: `npm test` 235/235; `node node_modules/typescript/bin/tsc --noEmit`, `npm run lint`, `npm run build:pages` başarılı. Sentetik hesapla 390 piksel tarayıcı ekranında tür ekleme → varlık ve bakım oluşturma → Bakım planları ekranında kaydı görme denendi. Gerçek kullanıcı testi veya üretim dağıtımı yapılmadı.

Son mimari metindeki paralel rol ve kategori tabloları eklenmedi; mevcut oturum, firma üyeliği ve modül yetkileri kullanılıyor. Bu PR, tıbbi işlev veya dış entegrasyon eklemez.
