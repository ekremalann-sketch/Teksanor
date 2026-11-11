# Tasarım belgesi (11 Kasım 2026, derin araştırma)

## Bu belge nasıl okunur ve neye dayanır

**Kaynak ve öneri ayrımı.** Belgede iki tür bilgi var. **Kaynaklı bulgu**, yanında bağlantısı olan bilgidir. **Öneri** ise kaynaklardan çıkarılmış tasarım kararıdır: süre hedefleri, aşama listeleri, sektör şablonları, veri modelleri, ekran adları gibi. Tablolarda öneriler **[Öneri]** etiketiyle gösterildi. Bir bilgi kaynakla teyit edilemediyse **"doğrulanamadı"** yazıldı. Bunlar "yok" anlamına gelmez, "bakıldı, gösterilemedi" anlamına gelir.

**Erişim tarihi.** Bağlantılara 10 ve 11 Kasım 2026'da erişildi. İşaretsiz bağlantıların erişim tarihi **11.11.2026**. Yanında **(10.11)** yazanlar bir önceki araştırma turundan, **10.11.2026** tarihli. Mevzuat bağlantılarının çoğu ikincil kaynaktır: avukat yazıları, mali siteler, hastane prosedürleri. Resmî Gazete metni açılamadığı yerde bu belirtildi. **Uygulamadan önce mevzuat metni Resmî Gazete'den kontrol edilmeli.**

**Özellik tablolarındaki sütunlar.** **Öncelik:** 1 = satış için şart, 2 = kullanımı kolaylaştırır, 3 = sonra. **Zorluk:** kolay / orta / zor. **Tür:** "kod" geliştiricinin yazacağı iştir. "Tasarım" ekran, metin ve akış kararıdır. "Karar-sözleşme" ise avukat, mali müşavir, hastane ya da ödeme kuruluşu ile verilecek karar ya da imzalanacak sözleşmedir, kodla çözülmez. Gerçek hasta verisi, gerçek para akışı ya da klinik karar içeren her madde "karar-sözleşme" sayıldı.

**Ürünler ayrı tutuldu.** Üç ürün birbirinden bağımsız bölümlerde ele alındı. Bir ürün için önerilen özellik başka ürüne taşınmadı.


# ÜRÜN 3 — TEKSANOR: firmanın kendi işini tanımladığı kurumsal yönetim

## Bugün Teksanor iki ürünü birden taşıyor, ikisi de esnek değil

Önceki inceleme (10.11) Teksanor'un satılabilir çekirdeğinin dört ekran olduğunu tespit etti: servis masası, planlama panosu, form şablonları ve müşteri onayı. Bu çekirdeğin etrafında başka şeyler var. Panelde **20'den fazla modül sekmesi**, "Diğer modüller" altında 11 başlık, **"13 birimde 100 hazır süreç"** ve hane bütçesinden kalma kavramlar duruyor: Ata altın, Cumhuriyet altını, Ziynet, KMH borcu, Elden alınan borç, Asgari ödeme. Dal adları da bu kavramların bir hane bütçesi projesinden geldiğini gösteriyor (`codex/household-finance-20260911`). Firma sahibi girişte servis masasını değil, 8 bloklu bir paneli görüyor. Teklif ve tahsilat adımlarında düğme yok. Teknisyen fotoğraf ekleyemiyor (kaynak kod: `components/Dashboard.tsx`, `app/servis/page.tsx`; [GitHub (10.11)](https://github.com/ekremalann-sketch/Teksanor/pulls)). Bekleyen PR'larda teklif kalemleri (#49), parça ve depo hareketi (#52), tahsilat, iade ve iptal (#53) var.

Hedef bundan farklı: ürün firmaya hazır bir iş kalıbı dayatmamalı, firma kendi işini tanımlamalı. Bugünkü yapı iki açıdan bu hedefin tersine çalışıyor. Teknik servis akışı koda gömülü, yani firma değiştiremiyor. "100 hazır süreç" ise küçük firmaya **dolu bir tuval** veriyor. Bu belgedeki tasarım ikisini birden çözmeye çalışıyor. Teknik servis, sistemin içindeki şablonlardan **yalnız biri** olur. Firma kurulumda yalnız kendi sektörünün 1–2 akışını görür.

## Beş yapı taşı yeter: iş türü, aşama, alan, onay, kural

İncelenen bütün esnek iş araçları aynı yapı taşlarını kullanıyor. Aralarındaki fark, bu taşların kullanıcıya ne kadar açık gösterildiği.

- **monday.com:** Her otomasyon bir tetikleyici, bir koşul ve bir ya da daha fazla eylemden oluşuyor ve cümle gibi okunuyor. Sayfadaki örnek: "When a status changes to something, delete the item" ([monday destek](https://support.monday.com/hc/en-us/articles/360012254440)).
- **Odoo Studio:** Onay bir düğmeye bağlanıyor. Onaylayan kişi tek tek kullanıcı ya da bir grup olabiliyor. Onay çok adımlı olabiliyor. "Dışlayıcı onay" açılırsa aynı kişi aynı kayıtta iki adımı onaylayamıyor ([Odoo 19, Approval rules](https://www.odoo.com/documentation/19.0/applications/studio/approval_rules.html)).
- **Kissflow:** Akış formdan sonra kuruluyor. Her adım bir insan görevi. Her alan her adımda **düzenlenebilir, salt okunur ya da gizli** yapılabiliyor. Paralel dallar hepsi bitmeden ilerlemiyor ([Kissflow topluluk](https://community.kissflow.com/t/m1yzjcn/creating-a-process-workflow)).
- **Airtable:** Bütün veri tabanının üstüne kişi ya da ekip başına filtrelenmiş "arayüz" sayfaları kuruluyor. Kullanıcı tabloların tamamını görmeden çalışıyor ([Airtable Interface Designer](https://support.airtable.com/docs/interface-designer-overview)).
- **ClickUp:** Kayıttan sonra art arda açılan pencerelerle çalışma alanı kurduruyor. Şablonlar kullanım amacına göre aranabiliyor ([ClickUp yardım](https://help.clickup.com/hc/en-us/articles/9563779819031-Set-up-your-team-s-Workspace)).

Esnekliğin bedeli de belgelenmiş. ClickUp G2'de 15.496 yorumla 4,6/5 alıyor, ama en sık şikâyet **"dik öğrenme eğrisi"** ve sık yapılan işlerin zor bulunması ([G2 ClickUp](https://g2.com/products/clickup)). Nielsen Norman Group'un "aşamalı açma" ilkesi tam bu soruna cevap veriyor. (Aşamalı açma: ilk ekranda yalnız ana seçenekleri gösterip ikincilleri bir adım geriye bırakmak.) Bu yaklaşım uygulamaları "öğrenmesi kolay ve hataya daha az açık" yapıyor ([NN/g](https://www.nngroup.com/videos/progressive-disclosure/)). Zoho Creator ve Pipefy'ın düzenleyici ekranları bu araştırmada açılamadı, **doğrulanamadı**.

**Teksanor için tasarım [Öneri].** Beş kavram kullanılır, başka yapı taşı eklenmez. Her birinin kullanıcıya görünen adı sade Türkçe olur:

1. **İş türü:** "Ne tür işler yapıyorsunuz?" Örnek: arıza, bakım, kurulum, keşif.
2. **Aşamalar:** İşin geçtiği adımlar. Her aşamanın bir adı, bir rengi ve "bu aşamadaki işi kim yürütür" bilgisi olur.
3. **Alanlar:** İşte tutulacak bilgiler: metin, sayı, tarih, seçim, fotoğraf, imza, kontrol listesi. Her aşama için üç ayar vardır: **bu aşamada zorunlu**, **salt okunur** ya da **gizli**. Bu Kissflow'un modeli.
4. **Onay:** Bir aşamadan çıkmak için "kimin onayı gerekir" ayarı. Onaylayan bir rol ya da bir kişi olur. "Onaylayan, işi açan kişi olamaz" seçeneği bulunur. Bu Odoo'nun dışlayıcı onayının sade hali.
5. **Kurallar:** Cümle biçimindedir: "**Durum** ___ olunca ___ kişisine ___ gönder" ya da "___ gün geçince ___ yap". Başlangıçta yalnız 3 tetikleyici (aşama değişti, tarih geldi, alan doldu) ve 4 eylem (bildirim gönder, görev aç, alan doldur, müşteriye WhatsApp bağlantısı hazırla) olur.

**Sınırlar [Öneri].** Bir firmada en fazla 5 iş türü, iş türü başına en fazla 10 aşama, 20 alan ve 10 kural olur. Bu sayılar doğrulanmış bir sektör standardı değil, sadelik için önerilen yumuşak sınırlar. Sınıra yaklaşınca sistem "Bunu bir kontrol listesi maddesi yapmak ister misiniz?" diye önerir.

**Süren işler ne olacak?** Akış değişince yarıdaki işlerin durumu en kolay gözden kaçan konu. **Jira**'da bir aşama silinip akış kaydedilirken, silinen her aşama için kullanıcıya "yeni aşama" seçtiriliyor. Bu taşıma sırasında akış kuralları ve otomatik eylemler **çalışmıyor** ([Atlassian](https://support.atlassian.com/jira-software-cloud/docs/move-issues-to-new-statuses-while-updating-your-workflow/)). monday'de pano çoğaltılınca entegrasyon içeren otomasyonlar kopyalanmıyor, elle yeniden kurulmaları gerekiyor ([monday destek](https://support.monday.com/hc/en-us/articles/360012254440)). Teksanor için kurallar [Öneri]:

- İçinde iş olan aşama doğrudan silinmez. Sistem "Bu aşamada 7 iş var. Hangi aşamaya taşınsın?" diye sorar.
- Taşıma, işin geçmişine "akış değişikliği" olarak yazılır. Taşıma sırasında kurallar çalışmaz, müşteriye mesaj gitmez.
- Her iş, açıldığı andaki akış sürümünü saklar.
- Yeni zorunlu alan yalnız yeni işlerde ya da bir sonraki aşama geçişinde zorunlu olur. Eski işleri kilitlemez.
- "Kaydet"ten önce bir özet gösterilir: "Bu değişiklik 12 açık işi etkiler."

## Hazır şablonlar: altı sektör, her biri en fazla 8 aşama

Şablon galerilerinin varlığı doğrulandı. ClickUp şablonları kullanım amacına göre aranabiliyor ([ClickUp](https://help.clickup.com/hc/en-us/articles/9563779819031-Set-up-your-team-s-Workspace)). Pipefy'ın ücretsiz planında "tak-çalıştır süreç şablonları" var ([Capterra Pipefy](https://www.capterra.com/p/144848/Pipefy/pricing/)). ServiceM8'de tekrarlayan iş her zaman bir iş şablonuna dayanıyor. Şablon açıklamayı, kontrol listesini ve malzemeyi önceden dolduruyor. Formlar tamamlanınca PDF olarak işe ekleniyor ([ServiceM8 sözlük](https://support.servicem8.com/help-center/glossary)). Türk ürünlerinde ise teknik serviste cihaz kabulü, seri no, garanti, "parça bekliyor" ve "teslime hazır" bildirimi standart. Periyodik bakımda bakımdan 10 gün önce hatırlatma var ([Kursoft (10.11)](https://www.kursoft.com.tr/teknik-servis-programi/), [Evobulut (10.11)](https://www.evobulut.com/servis-takip-programi)). İnşaatta yıllara yaygın işlerin hakedişlerinden vergi kesiliyor. Cumhurbaşkanı Kararı 9707'ye göre oran "diğer işler" için **%5** ([Alomaliye özelge, 14.01.2026](https://www.alomaliye.com/2026/01/14/2863-sayili-kanun-kapsamindaki-restorasyon-isinde-hakedislerden-stopaj-yapilir-mi-ozelge/?noamp=mobile)). Bu kaynak kurumlar vergisi mükellefleri için. Gelir vergisi mükelleflerindeki oran **doğrulanamadı**.

Güvenlik, temizlik ve danışmanlık için sektör yazılımlarının gerçek aşama listeleri bu araştırmada okunamadı. **Aşağıdaki tablonun aşamaları, rolleri ve onayları öneridir.** Kaynaklı tek kısımlar yukarıda anlatıldı.

| Şablon | İş türleri | Aşamalar [Öneri] | Kontrol listesi / belge | Onay | Roller | Kendiliğinden açılan modüller |
|---|---|---|---|---|---|---|

Metraj, inşaatta yapılan işin miktarının ölçülmesidir. Hakediş, bu ölçüme göre yükleniciye ödenecek tutarın hesaplandığı belgedir. Hakedişteki teminat kesintisi, fiyat farkı ve KDV tevkifatı **doğrulanamadı**, bu yüzden "kesintiler" alanı firma tarafından elle tanımlanır. Özel Güvenlik Kanunu'nun vardiya ve kayıt yükümlülükleri **doğrulanamadı**. Güvenlik şablonu bu yüzden "yasal uyum sağlar" diye pazarlanmamalı.

**Şablon kullanıcıya nasıl görünür [Öneri].** Şablondan başlayan firma şunları değiştirebilir: aşama adı, aşama ekleme ya da kaldırma, alan ekleme, kontrol listesi maddeleri ve onay gerekip gerekmediği. Şablon "kilitli" değildir. Ama değiştirilen şablonun yanında "orijinale dön" düğmesi bulunur. Güvenlik ve temizlik şablonlarında ana kayıt "iş" değil **"sözleşme + vardiya"** olur. Bu yüzden veri modeli, ziyareti bir işe bağlarken vardiyayı bir sözleşmeye ya da yere bağlayabilmeli.

## Modüller: dokuz çekirdek her firmada açık, gerisi şablonla gelir

Türk ön muhasebe ürünleri çekirdeği **cari + fatura/e-Belge + tahsilat + kasa/banka + stok + teklif + rapor** olarak satıyor. Paraşüt'ün ana planı yıllık ödemede **ayda 752 ₺ + KDV** ve cari, teklif, stok, raporlama ve e-Belge'yi içeriyor. Bu planda ayrı bir personel ya da maaş modülü yok, çalışan ödemeleri gider olarak işleniyor ([Paraşüt fiyatlar](https://www.parasut.com/on-muhasebe-fiyatlari), [Paraşüt özellikleri](https://www.parasut.com/blog/ticari-program-parasutun-ozellikleri)). Paraşüt'ün sayfasında yıllık plandaki tasarruf 8.376 ₺ yazıyor. Oysa 11.280 − 9.024 = 2.256 ₺ ediyor. Sayfadaki rakam hatalı görünüyor. Logo İşbaşı faturayı WhatsApp ile gönderme, tahsilat, çek ve gider takibi ve KDV raporu sunuyor. Paket ve fiyat bilgisi sayfada yok, **doğrulanamadı** ([Logo İşbaşı](https://www.logo.com.tr/product/logo-isbasi)). Logo Tiger, Mikro Run/Fly, BizimHesap ve KolayBi'nin paketleri **doğrulanamadı**.

Saha servis ürünleri çekirdeği **talep → teklif → iş → ziyaret → fatura** zinciri olarak kuruyor. Jobber'da her adım bir öncekinden "dönüştürme" ile açılıyor. Bir işin bir ya da birden çok ziyareti olabiliyor ([Jobber sözlük](https://help.getjobber.com/en/articles/jobber-glossary/)). ServiceM8 ek özellikleri **eklenti** olarak, Ayarlar menüsünden açtırıyor ([ServiceM8 sözlük](https://support.servicem8.com/help-center/glossary)). Türk teknik servis ürünlerinde üç paketleme modeli görülüyor. LinexServ **599 ₺/ay**'a her şeyi dahil ediyor ([LinexSoft (10.11)](https://linexsoft.com/online-teknik-servis-programi.html)). Servis Pozitif kullanıcı sayısına göre kademelendiriyor: MINI (1–2), PRO (3–7), PRO-MAX (8–15). TL fiyatı **doğrulanamadı** ([Servis Pozitif (10.11)](https://www.servispozitif.com/)). Paraşüt ise kademeyi veri hacmine bağlıyor (XL planı).

**Önerilen modül haritası [Öneri, yukarıdaki paketlerden çıkarım]:**

| Modül | Her firmada | Hangi şablonla açılır | Neden |
|---|---|---|---|
| Müşteri / cari (borç-alacak, ekstre) | **Açık** | — | Bütün rakiplerin ortak çekirdeği |
| Talep | **Açık** | — | Talep → teklif → iş zinciri |
| Teklif | **Açık** | — | Paraşüt, Jobber, Servis Pozitif |
| İş / proje (aşamalı) | **Açık** | — | Ürünün kalbi |
| Görev ve ziyaret (takvim, dispeç) | **Açık** | — | Jobber, ServiceM8 |
| Tahsilat ve kasa/banka | **Açık** | — | Ön muhasebe beklentisi |
| Belgeler (fotoğraf, imza, form, PDF) | **Açık** | — | ServiceM8 form → PDF |
| Raporlar ve "Bugün" ekranı | **Açık** | — | Jobber yönetici ekranı |
| Kullanıcı ve rol | **Açık** | — | — |
| Stok ve malzeme | Kapalı | Teknik servis, periyodik bakım, inşaat | Parça kullanımı |
| Satın alma | Kapalı | İnşaat, periyodik bakım | Tedarik |
| Ekipman ve sözleşme (tekrarlayan ziyaret) | Kapalı | Periyodik bakım, temizlik, güvenlik | Housecall Pro'da yalnız üst planda ([Housecall Pro (10.11)](https://housecallpro.com/pricing/)) |
| Hakediş | Kapalı | İnşaat | Stopaj ve kesinti |
| Vardiya ve nokta kontrolü | Kapalı | Güvenlik, temizlik | Ana kayıt vardiya |
| Saat kaydı | Kapalı | Danışmanlık | Jobber puantajı, ServiceM8 giriş/çıkış |
| Personel ve izin | Kapalı | Güvenlik, temizlik, 10 kişiden büyük ekipler | Ön muhasebe ürünleri bunu çekirdek saymıyor |

**Kod silinmeden gizlenecek ya da ürüne ait olmayan bölümler:** Birimler (13 birim, 100 süreç), Ajanlar, Riskler, Ar-Ge, Hazine ve İK'nın bordroya benzeyen kısımları gizlenir. Hane bütçesi kavramları (Ata altın, Cumhuriyet altını, Ziynet, KMH, Elden borç, Asgari ödeme) ve kayıttaki "Bireysel hesap" seçeneği **bu üründen tamamen ayrılır**. Bunlar firma yönetimi değil, kişisel bütçe kavramları.

## Sadelik: üç soruluk kurulum, görünmeyen modüller, rol başına bir ana ekran

Bugünkü başlangıç listesi 4 adım: firma bilgisi, ekip ekleme, saha formu şablonu seçme ve ilk servis işini açma. Liste dolu bir sayfanın ortasında kalıyor (önceki inceleme, 10.11). ClickUp'ın kurulum pencereleri doğrulandı, ama soru sayısı ve cevaba göre neyin değiştiği **doğrulanamadı**. monday, Odoo ve Pipefy'ın sihirbazları da **doğrulanamadı**.

**Kurulum sihirbazı [Öneri, en fazla 3 soru]:**

1. "Ne iş yapıyorsunuz?" Seçenekler: teknik servis / periyodik bakım / inşaat-taahhüt / temizlik / güvenlik / danışmanlık / diğer.
2. "Kaç kişisiniz, sahada çalışan var mı?"
3. "Müşteriden onay ve imza alıyor musunuz?"

Cevaba göre şunlar olur: şablon kurulur, ilgili modüller açılır, gerisi menüde **hiç görünmez**, rol ekranları hazırlanır ve **şablonla açılmış örnek bir iş** gösterilir. Sihirbazın sonunda boş bir ekran olmaz. "Diğer" seçeneğini seçen firmaya boş tuval verilmez. En yakın şablon önerilir ve "kendi aşamalarınızı yazın" ekranı açılır. Kapalı modüller "Ayarlar > Modüller" altından tek tıkla açılır. Bu ServiceM8'in eklenti mantığına en yakın model.

**Rol başına ana ekran.** Jobber'da yönetici ana ekranında üç şey görüyor: günlük beklenen gelir, öncelik sıralı **"Yapılacaklar"** listesi ve haftalık "İşletme sağlığı". Yapılacaklar listesinde yeni talepler, değişiklik istenen teklifler, işe çevrilecek onaylı teklifler, faturalanacak işler ve vadesi geçmiş faturalar var. Acil olan en üste çıkıyor. Yönetici olmayan kullanıcı yalnız günün haritasını ve sıradaki işini görüyor ([Jobber Home](https://help.getjobber.com/en/articles/home-in-the-jobber-app/)). ServiceM8'in dispeç panosunda hedef "planlanmamış iş listesini boş tutmak". (Dispeç: işin bir personele ve saate atanması.) Ana eylem işi personelin üzerine sürükleyip bırakmak ([ServiceM8 dispeç panosu](https://support.servicem8.com/help-center/desktop/basics/dispatch-board-overview.md)). Sabah ya da haftalık özet e-postası gönderen bir rakip **doğrulanamadı**. Bu, Teksanor için bir fark yaratma adayı olmaya devam ediyor.

| Rol | Ana ekranda ne görür [Öneri] | Göremez |
|---|---|---|
| Saha | Yalnız kendi bugünkü işleri ve tek düğme: Yola çık → Başla → Tamamla | Para bilgisi, diğer personelin işleri |
| Muhasebe | Faturaya hazır işler, tahsilat bekleyen ve vadesi geçmiş cari, kasa/banka, entegratöre aktarılmayı bekleyen fatura taslakları | Akış ayarları |

Bugün altı ayrı uyarı yüzeyi var: Dikkat şeridi, Servis akışları, Bugün, Bugünün aksiyonları, İşlerim, Bildirimler. Bunlar tek bir **"Bugün yapılacaklar"** listesinde birleşir. Bu listenin her satırı, bir akış geçişinin bekleyen halinden otomatik üretilir. Örnek: "Müşteri onayı" aşamasında 2 günden fazla bekleyen iş. Böylece firma kendi aşamalarını tanımladığında, yapılacaklar listesi de kendiliğinden o aşamalara göre şekillenir.

## Türkiye'ye özgü kurallar: fatura kesme, ama cariyi doğru tut

**e-Fatura.** 2025 brüt satış hasılatı 3 milyon TL ve üzerinde olan mükellefler 1 Temmuz 2026'dan itibaren e-Fatura'ya geçmek zorunda ([Paraşüt (10.11)](https://www.parasut.com/blog/e-fatura-gecis-zorunlulugu-sartlari)). Teksanor fatura kesmez. İş kapanınca satır kalemlerini **fatura taslağı** olarak firmanın ön muhasebe programına ya da entegratörüne aktarır, fatura numarası geri yazılır. (Özel entegratör: GİB'den izin almış, e-Faturayı firma adına GİB'e ileten şirket.)

**Cari hesap.** Cari hesap, bir müşteri ya da tedarikçiyle yapılan bütün borç ve alacak hareketlerinin tutulduğu hesap. Cari ekstre bir dönemdeki hareketleri ve bakiyeyi listeler. Hareketler vadeye göre düzenlenir ([Paraşüt cari hesap](https://www.parasut.com/blog/cari-hesap-takibi-nasil-yapilir)). Teksanor'da biten iş bir **borç** hareketi, tahsilat bir **alacak** hareketi üretir. Tahsilatta kasa ya da banka hesabı seçilir.

**Yıllık izin (İş Kanunu md. 53, 56, 59).** İkincil kaynağa göre izin süreleri şöyle: 1–5 yıl çalışana 14 gün, 5–15 yıl çalışana 20 gün, 15 yıl ve üzerine 26 gün. 18 yaş altı ve 50 yaş üstü işçilere 20 günden az izin verilemiyor. İzin bölünebiliyor, ama bir bölümü 10 günden az olamıyor. İzne denk gelen hafta tatili ve genel tatiller izinden sayılmıyor. İşveren her işçi için imzalı izin kayıt belgesi tutmak zorunda ([Alomaliye izin rehberi, 14.07.2026](https://www.alomaliye.com/2026/07/14/ozel-sektorde-yillik-ucretli-izin-rehberi/amp/)). Kanun metni mevzuat.gov.tr'den açılmadı, bu yüzden kontrol edilmeli. İzin modülü bu kuralları hesaplar ve izin kayıt belgesinin PDF'ini üretir. Bordro yapmaz.

**İletişim.** Durum bildirimi ve tahsilat hatırlatması gibi işlem mesajları İYS onayından muaf. Kampanya mesajları onay istiyor. (İYS: ticari mesaj izinlerinin kaydedildiği merkezi sistem.) Bakım hatırlatmasının hangi gruba girdiği gri alan ([Paraşüt İYS (10.11)](https://www.parasut.com/blog/ileti-yonetim-sistemi-hakkinda-bilmeniz-gerekenler)). Türk rakipler WhatsApp'ı öne çıkarıyor. En düşük riskli ilk adım, mesajı hazırlayıp **"WhatsApp'ta aç" bağlantısıyla** kullanıcının kendi telefonundan göndermesi. WhatsApp Business API maliyeti ve onay süreci **doğrulanamadı**.


## Rakipler: esnek araçlar zor, saha araçları katı, Türk ürünleri sektöre kilitli

| Ürün | Ne iyi yapıyor (kaynaklı) | Teksanor'un alacağı ders [Öneri] | Fiyat (kaynaklı) |
|---|---|---|---|
| monday.com | Cümle biçimli otomasyon, otomasyon şablonu ([destek](https://support.monday.com/hc/en-us/articles/360012254440)) | Kural ekranı cümle gibi okunsun | Koltuk başı aylık 9 / 12 / 19 USD, **en az 3 koltuk**, koltuklar paketle satılıyor. Standard planda ayda 250 otomasyon eylemi. ([blog, 2.3.2025 güncellemesi](https://monday.com/blog/product/how-much-does-monday.com-cost/), [destek](https://support.monday.com/hc/en-us/articles/4405633151634)) |
| Airtable | Rol ya da ekip başına filtrelenmiş arayüz sayfaları ([destek](https://support.airtable.com/docs/interface-designer-overview)) | Rol başına ana ekran | **Doğrulanamadı** |
| Zoho Creator | — (düzenleyici **doğrulanamadı**) | — | Kullanıcı başı aylık 8 / 20 / 25 USD, güncelliği belirsiz ([G2](https://www.g2.com/products/zoho-creator/pricing)) |
| Odoo (Studio) | Düğmeye bağlı, çok adımlı, dışlayıcı onay ([doküman](https://www.odoo.com/documentation/19.0/applications/studio/approval_rules.html)) | "Onaylayan, işi açan olamaz" ayarı | Fiyat sayfası açılmadı, **doğrulanamadı** |
| Kissflow | Aşama başına alan yetkisi (düzenlenebilir / salt okunur / gizli) ([topluluk](https://community.kissflow.com/t/m1yzjcn/creating-a-process-workflow)) | Aşama başına zorunlu alan | **Doğrulanamadı** |
| Pipefy | Ücretsiz planda tak-çalıştır şablonlar | Şablonla başlat | Ücretsiz / 33 / 65 USD kullanıcı başı aylık ([Capterra](https://www.capterra.com/p/144848/Pipefy/pricing/)) |
| ClickUp | Kurulum pencereleri, kullanım amacına göre şablon. Şikâyet: dik öğrenme eğrisi ([G2](https://g2.com/products/clickup)) | Her şeyi özelleştirilebilir yapma | **Doğrulanamadı** |
| ServiceM8 | Tek iş kartı, renkli 4 durum, bekleme kuyruğu, dispeç panosu, "yoldayım" SMS'i, eklentiler ([sözlük](https://support.servicem8.com/help-center/glossary), [Track My Arrival](https://support.servicem8.com/help-center/servicem8-add-ons/servicem8-add-ons/what-is-track-my-arrival.md)) | "Parça bekliyor" kuyruğu, modül açma ekranı | İş sayısına göre: ücretsiz (30 iş) … 349 USD ([ServiceM8 (10.11)](https://www.servicem8.com/pricing)) |
| Housecall Pro | Temel planda otomatik fatura hatırlatması. Tekrarlayan servis ve rota yalnız en üst planda. | Tekrarlayan işi temel pakette ver | 59–329 USD ([Housecall Pro (10.11)](https://housecallpro.com/pricing/)). Ekranları **doğrulanamadı**. |
| Logo İşbaşı | Faturayı WhatsApp ile gönderme, KDV raporu ([Logo](https://www.logo.com.tr/product/logo-isbasi)) | Entegrasyon hedefi, rakip değil | **Doğrulanamadı** |
| Mikro | — | — | **Doğrulanamadı** (sayfa açılmadı) |
| Paraşüt | Cari, e-Belge, vade hatırlatması, API | Fatura taslağını buraya aktar | 752 ₺/ay (yıllık ödeme) + KDV ([Paraşüt](https://www.parasut.com/on-muhasebe-fiyatlari)) |
| Servis Pozitif | İnternetsiz teknisyen uygulaması, otomatik WhatsApp, periyodik bakım, Logo/Mikro entegrasyonu | Türk servis firmasının beklentisi | Kullanıcı sayısına göre paket, TL **doğrulanamadı** ([Servis Pozitif (10.11)](https://www.servispozitif.com/)) |
| LinexServ | Her şey dahil tek fiyat, sahada tahsilat, gün sonu kasa | Açık ve tek fiyat | **599 ₺/ay** ([LinexSoft (10.11)](https://linexsoft.com/online-teknik-servis-programi.html)) |

**Sonuç [Öneri].** Esnek araçlar (monday, ClickUp, Airtable) her sektöre uyuyor, ama küçük Türk firması için zor. Fiyatları dolar bazlı ve koltuk başı, monday'de en az 3 koltuk var. Saha araçları (Jobber, ServiceM8) kolay, ama tek bir iş kalıbına bağlı. Türk servis ürünleri ucuz ve yerel, ama teknik servise kilitli. Teksanor'un yeri ortada: **"10 dakikada kurulur, kendi aşamalarınızı yazarsınız, gerisini sistem yapar."** Bu bir satış cümlesi önerisi, kanıtlanmış bir sonuç değil.

## A) Teksanor uçtan uca akış şeması

Teksanor'da iki akış var. Birincisi **firmanın sistemi kurması ve işini tanımlaması**. İkincisi **tanımlanan akışta tek bir işin yürümesi**. İkinci akış koda gömülü değil. Aşamaların adları firmanın tanımından gelir. Tabloda örnek olarak teknik servis şablonunun adları kullanıldı. İki tablonun tamamı **[Öneri]**. Kaynaklı kalıplar (dönüştürme, bekleme kuyruğu, giriş-çıkış) yukarıdaki bölümlerde belirtildi.

**A1 — Kurulum ve akış tanımlama**

| # | Adım | Rol | Ekran | Durum | Bildirim |
|---|---|---|---|---|---|
| 6 | Müşteri listesini Excel'den yükleme (isteğe bağlı) | Ofis | Müşteriler → içe aktar | — | Hatalı satır raporu |
| 7 | Örnek iş: şablonla açılmış, silinebilir | Sistem | Bugün | Örnek iş | "İlk gerçek işinizi açın" ipucu |

**A2 — Bir işin akışı (teknik servis şablonu örneğiyle)**

| # | Aşama (firmanın verdiği ad) | Kim başlatır / yürütür | Ekran | Ana düğme | Bu aşamada zorunlu alanlar (örnek) | Bildirim (kurallarla) |
|---|---|---|---|---|---|---|
| 2 | Teklif | Ofis | Teklif | "Gönder" (WhatsApp'ta aç bağlantısı) | Satır kalemleri, KDV oranı | Müşteriye onay bağlantısı |
| 4 | Planlandı | Ofis | Dispeç panosu | Sürükle-bırak ile ata | Tarih, saat, atanan kişi | Teknisyenin telefonuna iş |
| 5 | Parça bekliyor (bekleme kuyruğu) | Teknisyen ya da ofis | İş kartı | "Kuyruğa al (bitiş tarihiyle)" | Beklenen parça, tarih | Kuyruk süresi dolunca planlanmamış listeye geri döner (ServiceM8 kalıbı) |
| 6 | Sahada | Teknisyen | Telefon – bugünkü işlerim | "Yola çık" → "Başla" | Giriş saati | Müşteriye "yoldayım" bağlantısı (isteğe bağlı) |
| 7 | Yapıldı | Teknisyen | Telefon – iş kartı | "Tamamla" | Kontrol listesi, fotoğraf, müşteri imzası, kullanılan parça | Ofise "faturaya hazır". Servis fişi PDF'i işe eklenir. |
| 8 | Tahsil | Muhasebe ya da teknisyen | Tahsilat | "Tahsil et" | Tutar, kasa ya da banka | Cari hareket oluşur. Vade geçince hatırlatma. |
| 9 | Kapandı | Sistem | — | — | Fatura taslağı aktarıldı (fatura no geri yazıldı) | Haftalık özette sayılır |

**Her geçişte (motorun kuralları):** Zorunlu alanlar dolmadan sonraki aşamanın düğmesi pasif kalır ve neyin eksik olduğu yazılır. Onay gereken aşamada düğme "Onaya gönder" olur. Onaylayan kişiye bir görev açılır. Her geçiş "aşama geçmişi"ne kim ve ne zaman bilgisiyle yazılır. Bir aşamada hedef süreden uzun bekleyen iş "Bugün yapılacaklar" listesine düşer.

## B) Teksanor ekran listesi

Menü 5 ana maddeye iner: **Bugün, İşler, Takvim, Müşteriler, Para**. Ayarlar ayrı durur. Diğer ekranlar ancak ilgili modül açıksa görünür. Tablonun tamamı **[Öneri]**.

| # | Ekran | Amacı | Kim görür | Tek ana düğme | Boş durumda ne gösterir |
|---|---|---|---|---|---|
| 7 | Müşteri onay sayfası (dış) | Teklifi ya da işi onaylama, imza | Müşteri (bağlantıyla) | "Onayla" | — |
| 9 | Telefonda "Bugünkü işlerim" | Sahadaki personelin günü | Saha | "Yola çık" → "Başla" → "Tamamla" | "Bugün size atanmış iş yok." |
| 16 | Stok (modül açıksa) | Ürünler, depo hareketi, işe bağlı kullanım | Ofis | "Ürün ekle" | "Stok kaydı yok." |
| 17 | Sözleşmeler ve tekrarlayan ziyaretler (modül açıksa) | Bakım, temizlik ve güvenlik sözleşmeleri | Ofis | "Sözleşme ekle" | "Sözleşme yok." |
| 19 | Vardiya (modül açıksa) | Vardiya planı, devir, nokta okutma kayıtları | Vardiya amiri | "Plan oluştur" | "Vardiya planı yok." |

## C) Teksanor veri modeli (sade dille) [Öneri]

- **Akış tanımı** (sürümlü). İçinde şunlar bulunur:
  - **İş türü:** Örnek: arıza, bakım.
  - **Aşamalar:** Ad, renk, sorumlu rol, hedef süre.
  - **Alan tanımları:** Tür ve her aşamada zorunlu / salt okunur / gizli ayarı.
  - **Onay kuralları:** Hangi aşamadan çıkışta, kim onaylar, açan kişi onaylayabilir mi.
  - **Kurallar:** Tetikleyici, koşul, eylem.
  - Her yayında yeni bir **sürüm numarası** alır.
- **Müşteri / cari:** Kişi ya da firma, vergi no, iletişim bilgisi, İYS izni. Müşterinin **adresleri** ve isteğe bağlı **ekipmanları** olur (cihaz, asansör, klima).
- **Talep:** Teklife ya da işe dönüşür.
- **Teklif:** Satır kalemleri bulunur: ürün ya da hizmet, miktar, birim fiyat, KDV oranı.
- **İş:** İş türü, açıldığı akış sürümü, şu anki aşama ve alan değerleri tutulur. Bir işin bir ya da daha çok **ziyareti / görevi** olur. Ziyarette tarih, atanan kişi, giriş-çıkış saatleri tutulur. İşe bağlı **belgeler** bulunur: fotoğraf, imza, form cevapları, PDF.
- **Aşama geçmişi** ve **onay kaydı:** Her geçiş ve onay kim ve ne zaman bilgisiyle tutulur. "Bugün yapılacaklar" listesi bu kayıtlardan üretilir. Akış değişikliğiyle taşınan işler de buraya yazılır.
- **Malzeme hareketi:** Stoktan düşer ve işe bağlanır. **Ürün/stok** ve **satın alma** ile ilişkilidir.
- **Fatura taslağı:** Entegratöre ya da ön muhasebe programına gider, fatura numarası geri yazılır. **Cari hareket:** Borç ya da alacak ve vade tutulur. **Tahsilat:** Kasa ya da banka hesabı ile tutar.
- **İsteğe bağlı kayıtlar:**
  - **Sözleşme:** Bakım, temizlik ya da güvenlik sözleşmesi. Otomatik ziyaret ya da vardiya üretir.
  - **Vardiya:** Sözleşmeye ya da yere bağlıdır, işe değil.
  - **Hakediş:** Proje, dönem, metraj, kesintiler.
  - **Saat kaydı.**
  - **Personel/izin:** İşe giriş tarihi ve doğum tarihinden hak edilen gün hesaplanır. Kullanılan gün ve özlük belgeleri tutulur. Özlük belgelerine ayrı yetki gerekir.
- **Denetim kaydı:** Kim, neyi, ne zaman değiştirdi.

## D) Teksanor özellik tablosu

| # | Özellik | Neden gerekli | Hangi rakipte var | Öncelik | Zorluk | Tür | Bitti sayılma ölçütü |
|---|---|---|---|---|---|---|---|
| T1 | Hane bütçesi kavramlarını ve "Bireysel hesap" seçeneğini üründen ayırmak | Firma ürününde kişisel bütçe güven kırıyor | — | 1 | kolay | kod | Hiçbir ekranda altın, ziynet, KMH ya da asgari ödeme geçmiyor ✅ #63 |
| T2 ✅ #64 | Kullanılmayan modülleri gizlemek, menüyü 5 maddeye indirmek | Bugün 20'den fazla sekme var | ServiceM8 (eklenti açma) | 1 | orta | kod + tasarım | Yeni firma yalnız şablonunun modüllerini görüyor |
| T3 | Üç soruluk kurulum sihirbazı + örnek iş | Boş ve dolu tuval sorunlarının çözümü | ClickUp (kurulum pencereleri) | 1 | orta | kod + tasarım | Kayıttan ilk işe 10 dakikanın altında ulaşılıyor (5 kişilik testte) |
| T4 | Akış motoru: iş türü, aşama, alan, aşama başına zorunlu alan | "Kendi işini tanımla" hedefinin kendisi | Kissflow, Odoo, monday | 1 | zor | kod | Teknik servis akışı koddan çıkıp tanım verisine taşındı, testler geçiyor |
| T6 | Teknik servis ve periyodik bakım şablonları | İlk satış sektörü | Servis Pozitif, Kursoft, ServiceM8 | 1 | orta | tasarım + kod | İki şablon sihirbazdan kuruluyor |
| T8 | Dönüştürme düğmeleri: talep → teklif → iş, tamamla → tahsil et | Bugün teklif ve tahsilat adımında düğme yok | Jobber | 1 | orta | kod (PR #49 ve #53 gözden geçirilir) | Hiçbir adımda açılır listeden aşama seçmek gerekmiyor |
| T9 | Fotoğraf yükleme (güvenli tarama ile) | Saha kanıtı. Bugün kapalı. | ServiceM8, Servis Pozitif | 1 | orta | kod (tarama servisi: **karar-sözleşme** olabilir) | Teknisyen telefondan fotoğraf ekleyebiliyor |
| T11 | Tahsilatın cari hareket üretmesi, kasa/banka seçimi | Para tarafının tutarlılığı | Paraşüt, LinexServ | 1 | orta | kod | Cari ekstresi işle ve tahsilatla tutuyor |
| T12 | Onay adımı (rol ya da kişi, açan kişi onaylayamaz seçeneği) | Teklif ve ek parça onayı | Odoo, Kissflow | 2 | orta | kod | Onaysız iş sonraki aşamaya geçemiyor |
| T13 | Cümle biçimli kurallar (3 tetikleyici, 4 eylem) | Hatırlatma ve otomatik görev | monday | 2 | orta | kod + tasarım | "Müşteri onayı 2 gün bekleyince ofise bildir" kuralı kurulup çalışıyor |
| T14 | Aşama silmede taşıma sorusu, akış sürümü, "12 işi etkiler" önizlemesi | Yarıdaki işler bozulmasın | Jira | 2 | orta | kod | Silinen aşamadaki işler seçilen aşamaya geçiyor, geçmişe yazılıyor |
| T15 | Bekleme kuyruğu (parça ya da müşteri cevabı, bitiş tarihli) | Türk servisinde en sık durum | ServiceM8 | 2 | kolay | kod | Süre dolunca iş planlanmamış listeye dönüyor |
| T16 | Dispeç panosu: sürükle-bırak, telefonda kullanılabilir | Planlama | ServiceM8, Jobber | 2 | orta | kod | 375 piksel ekranda yatay kaydırma gerekmiyor |
| T17 | "WhatsApp'ta aç" bağlantısıyla mesaj (teklif, onay, yoldayım) | Türk müşterinin kanalı | Servis Pozitif, LinexServ, Logo İşbaşı | 2 | kolay | kod | Mesaj hazır metinle WhatsApp'ta açılıyor |
| T18 | Fatura taslağını Paraşüt'e (API) ya da dosya olarak aktarma | e-Fatura zorunluluğu, fatura kesmeden | Servis Pozitif (Logo/Mikro), Paraşüt API | 2 | orta | kod + **karar-sözleşme** (API kullanım koşulları) | Taslak Paraşüt'te görünüyor, fatura no geri yazılıyor |
| T20 | Temizlik, güvenlik, inşaat ve danışmanlık şablonları | Hedef: "her sektör" | — (aşamalar **doğrulanamadı**) | 3 | orta | tasarım | Her biri sihirbazdan kuruluyor, en fazla 8 aşama |
| T21 | Sözleşme ve tekrarlayan ziyaret ya da vardiya üretimi | Bakım, temizlik, güvenlik | ServiceM8, Jobber, Kursoft | 2 | orta | kod | 3 aylık bakım sözleşmesi ziyaretleri otomatik açıyor |
| T22 | Stok ve işe bağlı parça kullanımı | Teknik servis ve bakım | Servis Pozitif, Paraşüt | 2 | orta | kod (PR #52 gözden geçirilir) | Tamamlanan iş stoktan düşüyor |
| T23 | Hakediş (dönem, metraj, kesintiler) | İnşaat şablonu | — (**doğrulanamadı**) | 3 | zor | kod + **karar-sözleşme** (stopaj ve teminat: mali müşavir) | Kesinti oranları firma tarafından giriliyor, %5 yalnız varsayılan |
| T24 | Saat kaydı ve onayı | Danışmanlık | Jobber (puantaj), ServiceM8 (giriş/çıkış) | 3 | kolay | kod | Onaylanan saatler teklif fiyatıyla çarpılıp taslağa gidiyor |
| T25 | Personel ve izin (md. 53/56/59 hesapları, izin kayıt belgesi PDF'i) | Personel yoğun sektörler | Paraşüt'te yok | 3 | orta | kod + **karar-sözleşme** (kurallar mevzuat metniyle teyit) | 6 yıllık, 52 yaşındaki işçiye 20 gün hesaplanıyor |
| T26 | Müşteri portalı (teklif, iş, ödeme görüntüleme) | Güven | Jobber (client hub), Servis Pozitif (TalepGo) | 3 | orta | kod (online ödeme: **karar-sözleşme**) | Müşteri giriş yapmadan işinin durumunu görüyor |

## E) Teksanor'da yapılmayacaklar

- **e-Fatura ya da e-Arşiv kesmek, özel entegratör olmak.** Neden: GİB izni ve mali sorumluluk gerekir. Paraşüt ya da Logo'ya taslak aktarılır (mevzuat ve ücretli servis).
- **Genel muhasebe, bordro ve SGK bildirimi.** Neden: ön muhasebe ve bordro ürünlerinin işi. İzin modülü yalnız gün hesabı yapar (kapsam).
- **Boş bir "her şeyi kendin kur" tuvali vermek, sınırsız alan ve aşama.** Neden: ClickUp'ın en sık şikâyeti öğrenme zorluğu. Teksanor'un satış avantajı sadelik (tasarım).
- **"13 birimde 100 süreç" gibi dolu bir tuvali herkese açmak.** Neden: küçük firmayı boğar. Yalnız seçilen sektörün 1–2 akışı kurulur (tasarım).
- **Hane bütçesi özelliklerini firma ürününde tutmak.** Neden: ürünün ne olduğunu bulanıklaştırır (tasarım).
- **WhatsApp Business API ve toplu SMS'i ilk sürüme koymak.** Neden: ücret, onay süreci ve İYS yükü var. İlk adım "WhatsApp'ta aç" bağlantısı (ücretli servis ve mevzuat).
- **Pazarlama mesajı göndermek.** Neden: İYS onayı gerekir. Yalnız işlem ve bilgilendirme mesajı gönderilir (mevzuat).
- **Online kart tahsilatı (müşteri portalında ödeme).** Neden: ödeme kuruluşu sözleşmesi gerekir. Önce manuel tahsilat kaydı (sözleşme gerektirir).
- **Güvenlik şablonunu "Özel Güvenlik Kanunu'na uygun" diye pazarlamak.** Neden: kanunun kayıt yükümlülükleri doğrulanamadı (mevzuat).
- **Hakedişte stopaj ve teminat oranlarını sabit kod olarak koymak.** Neden: oranlar mükellef türüne ve işe göre değişiyor. Firma girer, mali müşavir onaylar (sözleşme gerektirir).

## F) Teksanor ilk 4 hafta uygulama sırası

**Ön koşul:** T28 (avukat görüşü) başlatılır. Açık PR'lar #49 (teklif kalemleri), #52 (parça ve depo) ve #53 (tahsilat) gözden geçirilir. Birleştirilecek olanlar akış motoruna taşınacak şekilde not edilir.

- **Hafta 1 — Temizlik ve sadelik.** Şu işler yapılır: T1 (hane bütçesini ayır), T2 ✅ #64 (modülleri gizle, menüyü 5 maddeye indir, Birimler ve 100 süreci gizle), T7'nin ilk adımı (6 uyarı yüzeyini tek "Bugün" listesinde birleştir) ✅ #65, T10 (onay bildirimi). **Haftanın sonunda:** Yeni bir teknik servis firması girişte yalnız Bugün, İşler, Takvim, Müşteriler ve Para menülerini görmeli.
- **Hafta 2 — Akış motoru.** Şu işler yapılır: T4 (iş türü, aşama, alan, aşama başına zorunlu alan; teknik servis akışı koddan tanım verisine taşınır), T8 (dönüştürme düğmeleri, PR #49 ve #53 bu modele bağlanır), T9 (fotoğraf yükleme). **Haftanın sonunda:** Teknik servis işi kod değişmeden, yalnız tanım verisiyle baştan sona yürüyebilmeli. Bugünkü testler geçmeli.
- **Hafta 3 — Firmanın kendi akışı.** Şu işler yapılır: T5 (akış düzenleyici), T14 (aşama silmede taşıma, sürüm, etki önizlemesi), T12 (onay adımı), T3 (üç soruluk sihirbaz ve örnek iş). **Haftanın sonunda:** Bir test kullanıcısı sihirbazdan teknik servisi seçip "Parça bekliyor" aşamasını kaldırabilmeli ve içindeki işleri taşıyabilmeli. Bunu yardım almadan yapabilmeli.
- **Hafta 4 — İkinci şablon ve para.** Şu işler yapılır: T6 (periyodik bakım şablonu), T21 (tekrarlayan ziyaret), T11 (tahsilat → cari hareket), T13 (üç hazır kural), T17 (WhatsApp'ta aç). **Haftanın sonunda:** Aynı motor iki farklı sektör akışını çalıştırmalı. Bu, "kendi işini tanımlayan" iddiasının ilk kanıtı olur. Bir ücretsiz pilot firmaya gösterilebilir.

## G) Teksanor'da vermen gereken kararlar ve önerim

- **İlk sektör ne olacak?** Önerim: teknik servis ve periyodik bakım (kombi, klima, asansör). Şablon kanıtı en güçlü sektörler bunlar. Türk rakipler de burada fiyat yayımlıyor (LinexServ 599 ₺/ay).
- **Esneklik ne kadar olacak?** Önerim: 5 yapı taşı ve yumuşak sınırlar (5 iş türü, 10 aşama, 20 alan, 10 kural). Formül alanı, paralel dal ve koşullu atlama ilk sürümde olmaz.
- **Hane bütçesi özellikleri ne olacak?** Önerim: ayrı bir depoya ya da dala taşınsın. Teksanor'dan tamamen çıksın.
- **"13 birim, 100 süreç" ne olacak?** Önerim: silinmesin, şablon kütüphanesine "ileri düzey" olarak taşınsın. Sihirbazda gösterilmesin.
- **Fatura nasıl kesilecek?** Önerim: Teksanor fatura kesmesin. İlk entegrasyon Paraşüt API'si olsun, diğerlerine dosya ile aktarım yapılsın.
- **Sabah özeti olacak mı?** Önerim: evet, 2. öncelikte. Rakiplerde belgelenmemiş ve yapması kolay.

