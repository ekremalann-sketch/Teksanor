# Teksanor v42 paket birleştirmesi

v42 ZIP paketi GitHub main ile karşılaştırıldı. Giriş zaman aşımı, yönetim merkezi, kullanıcı erişimleri, İşlerim, firma seçimi, oturum ve veri yönetimi değişiklikleri aktarıldı.

Paketin sağlık yanıtındaki gerileme alınmadı: yayın commit kimliği, depolama yeteneği ve bağımlılık hatası korunur. MFA varsayılanı optional; firma gözünden görünüm de bu modda kurulum zorlamaz. Salt okunur erişim ve firma yetkileri korunur.

Windows testlerinde Python yolu yapılandırılabilir hale getirildi ve SQLite yedek doğrulayıcısının dosya bağlantısı kapatıldı. Pages paketleyicisi Node yerleşik modüllerini harici tutar. Vinext 1.1.0 ve source-map-js 1.2.2 ile derleme doğrulandı. Vinext ve Cloudflare derleme aracı geliştirme bağımlılıklarıdır; dağıtılan Worker çalışma zamanında npm yüklemesi kullanmaz.

223/223 test, TypeScript kontrolü ve Cloudflare Pages derlemesi geçti. Üretim bağımlılıklarında yüksek dereceli açık kalmadı; ExcelJS'nin geçişli uuid bağımlılığında iki orta dereceli denetim bulgusu var. Derleme araçlarının geçişli bağımlılıkları ayrıca bakım gerektiriyor. Güvenlik iş akışları kapatılmadı.

Gerçek kullanıcı oturumu, üretim veritabanı ve dış entegrasyonlar yerel testlerde kullanılmadı. Rakip raporunun bütün orta vadeli önerileri tamamlanmış sayılmaz.
