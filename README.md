<div align="center">
  <img src="public/assets/teksanor-logo.png" alt="Teksanor" width="260" />

  # Teksanor Kurumsal Operasyon Platformu

  Teknik servis, bakım ve mühendislik ekipleri için kurumsal web sitesi ile rol tabanlı operasyon portalını aynı uygulamada birleştiren uçtan uca ürün prototipi.

  [Canlı demoyu aç](https://teksanor.pages.dev/) · [Özellikleri incele](#öne-çıkan-yetenekler) · [Yol haritası](docs/ROADMAP.md) · [Portföy özeti](docs/PORTFOLIO.md)

  ![Cloudflare Pages](https://img.shields.io/badge/Cloudflare-Pages-F38020?logo=cloudflare&logoColor=white)
  ![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=111827)
  ![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
  ![Durum](https://img.shields.io/badge/durum-aktif%20prototip-16a34a)
</div>

> **Portföy ve ürün prototipi:** Bu depo gerçek bir işletme problemini çözmek amacıyla geliştirilmiş çalışan bir demonstrasyondur. Canlı ortamda yalnızca demo/test verileri kullanılmalıdır. Teksanor resmî muhasebe, bankacılık veya ERP ürünü değildir.

![Teksanor saha operasyonları](public/assets/teksanor-field-operations.svg)

## Yeni servis masası

`/servis` ekranında talep → teklif → müşteri onayı → saha notu/fotoğraf →
servis formu → tahsilat takibi birleştirilir. Onay bağlantıları süreli ve sürüme
bağlıdır. QR etiketi ekipmanın yetkili servis geçmişini açar. PDF çıktısı
servis formunun yazdırma ekranından alınır. E-posta, yapay zekâ ve harici dosya
tarama bağlantıları için [pilot teslim belgesini](docs/PILOT-DELIVERY.md) okuyun.

## Problem ve çözüm

Teknik servis ve mühendislik işletmelerinde iş emirleri, saha ziyaretleri, bakım planları, projeler, belgeler ve finansal kayıtlar çoğu zaman farklı tablolarda tutulur. Bu da güncel bilgiye ulaşmayı, yetki kontrolünü ve yönetim kararlarını zorlaştırır.

Teksanor bu dağınık akışı tek çalışma alanında toplar. Her firma kendi verisini görür; ekip görevlerini takip eder; yönetici operasyon ve finansal görünümü merkezi olarak izler.

## Öne çıkan yetenekler

- Kurumsal tanıtım sitesi, çözüm sayfaları ve içerik alanları
- Tek giriş ekranı ve rol bazlı yetkilendirme
- Firma/organizasyon bazlı veri ayrımı
- Proje, departman, çalışan ve iş takibi
- İş emri, saha ziyareti, ekipman ve periyodik bakım yönetimi
- Ödeme, borç, gider, nakit, döviz ve ziynet takibi
- TCMB günlük kurları ve referans altın fiyatıyla TL karşılığı
- Excel içe aktarma, belge yükleme ve kontrollü indirme
- İşlem geçmişi ve denetim kayıtları
- Cloudflare D1 veri tabanı ve R2 dosya depolama desteği
- GitHub Actions üzerinden test, derleme ve Cloudflare Pages dağıtımı

## Teknik mimari

| Katman | Teknoloji / yaklaşım |
|---|---|
| Arayüz | React 19, TypeScript, Vinext, Tailwind CSS |
| Sunucu | Vinext Worker, Cloudflare çalışma zamanı |
| Veri | Cloudflare D1 / SQLite uyumlu sorgular |
| Dosyalar | Cloudflare R2 |
| Entegrasyon | TCMB döviz verisi, altın referans servisi |
| Dağıtım | GitHub Actions, Wrangler, Cloudflare Pages |
| Kalite | Node test runner, otomatik üretim derlemesi |

## Çalıştırma

### Gereksinimler

- Node.js 22
- npm 11
- Cloudflare hesabı ve yerel geliştirme için Wrangler

### Kurulum

```bash
git clone https://github.com/ekremalann-sketch/Teksanor.git
cd Teksanor
npm ci
npm run dev
```

Uygulama geliştirme sunucusunun terminalde gösterdiği yerel adreste açılır.

### Kontroller

```bash
npm test
npm run build
npm run build:pages
```

- `npm test`: otomatik kontrolleri çalıştırır.
- `npm run build`: Worker üretim çıktısını hazırlar.
- `npm run build:pages`: Cloudflare Pages için `dist/pages` çıktısını üretir.
- `npm run start`: derlenmiş Worker'ı Wrangler ile yerelde çalıştırır.

## Ortam ve Cloudflare yapılandırması

Uygulama koduna gerçek kimlik bilgisi yazılmaz. Yerel değişken adları için [`.env.example`](.env.example) dosyasını kullanın; gerçek değerleri yalnızca yerel `.env` dosyasında veya Cloudflare/GitHub secret yönetiminde tanımlayın.

Üretim dağıtımı için gereken GitHub Actions secret adları:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

D1 ve R2 binding'leri hedef Cloudflare projesinde tanımlanmalıdır. Gizli değerleri issue, commit, ekran görüntüsü veya loglarda paylaşmayın.

## Demo güvenliği

- Canlı demoya gerçek müşteri, personel, finans veya kimlik verisi girmeyin.
- Demo hesaplarının parolalarını README veya kaynak kodda yayınlamayın.
- Üretim kullanımı öncesinde erişim politikaları, yedekleme, gözlemleme, KVKK süreci ve felaket kurtarma planı ayrıca doğrulanmalıdır.
- Güvenlik bildirimi için [`SECURITY.md`](SECURITY.md) dosyasını inceleyin.

## Proje durumu

Teksanor çalışan bir **ürün prototipidir**; ticari üretim sistemi olarak sunulmadan önce yol haritasındaki kritik güvenlik ve işletim maddeleri tamamlanmalıdır. Mevcut ve planlanan kapsam [`docs/ROADMAP.md`](docs/ROADMAP.md) içinde açıkça ayrılmıştır.

## Portföyde neyi gösteriyor?

Bu proje; ihtiyaç analizi, kurumsal arayüz tasarımı, rol ve firma bazlı veri modeli, API geliştirme, üçüncü taraf veri entegrasyonu, test, CI/CD ve Cloudflare dağıtımını tek üründe birleştirebilme yetkinliğini gösterir. Daha kısa ve işe alım odaklı anlatım için [`docs/PORTFOLIO.md`](docs/PORTFOLIO.md) dosyasını kullanabilirsiniz.

## Katkı ve kullanım hakkı

Katkı süreci [`CONTRIBUTING.md`](CONTRIBUTING.md) dosyasında açıklanmıştır. Kaynak kodu herkese açık olarak incelenebilir; ancak kopyalama, yeniden dağıtma, ticari kullanım veya türev ürün oluşturma izni verilmemiştir. Ayrıntılar için [`LICENSE`](LICENSE) dosyasına bakın.

---

**Teksanor** — Sahadaki işi merkezdeki karara bağlayan mühendislik ve operasyon platformu.
