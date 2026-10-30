# Servis planlaması düzeltmesi — 31 Ekim 2026

Kaynak: main `386d3f7395e68afafff0d86b7b80a67431d90190`. Ön koşul: yönetici açık bir servis işini başka tarih/sorumluya planlar.

`app/api/service/jobs/route.ts` içindeki schedule kolunda müşteri onaylarını iptal eden SQL beş parametre beklerken yalnız iki parametre alıyordu. Bu hata #41 değişikliğinde gözden kaçtı. Önceki SQLite tabanlı testlerde eksik değerler NULL sayılabildiğinden yalnız normal yanıtı veya genel geri alma davranışını test etmek yeterli olmadı.

Eksik yeni sürüm ve sorumlu parametreleri tamamlandı. Ayrıca iptal sorgusu, kendinden önceki iş emri güncellemesinin gerçekten gerçekleşmesi koşuluna bağlandı (`changes()>0`). Böylece eşzamanlı başka bir işlem sürümü artırmışsa bu başarısız planlama isteği bağlantıları iptal edemez. Veri, denetim kaydı ve bağlantı iptali mevcut tek batch içinde kalır. Yetkiler, onay kuralları ve yanıt biçimi değişmez; migrasyon yoktur.

Kalıcı regresyon testleri:

- Eksik bağlanan SQL parametrelerini sessizce NULL kabul etmeyen isteğe bağlı sıkı test sürücüsü.
- Tarih/sorumlu değişir, bekleyen bağlantı iptal edilir ve eski bağlantı 410 döner.
- Denetim hatasında tarih, sorumlu, sürüm ve bağlantı birlikte geri alınır.
- Sürüm yarışı kaybedilince 409 döner; tarih ve bağlantı değişmez.

Düzeltme öncesinde yeni testlerin normal planlama ve sürüm yarışı senaryoları başarısız oldu. Düzeltmeden sonra 4/4 geçti. Tam paket 321/321; TypeScript ve build:pages başarılı, lint 0 hata (önceden mevcut 91 renk uyarısı). Gerçek üretim verisiyle test veya tarama yapılmadı; sıkı test sürücüsü bir canlı D1 testi değildir.

Bu PR auth/recovery, auth/register ve agents/chat denetim bütünlüğü bulgularını kapatmaz. Bunlar ayrı değerlendirme/düzeltme gerektirir. Geri alma: bu PR'ın değişikliği geri alınır; veri veya şema geçişi gerekmez. Ana dal/yayın onayı bu yeni PR için ayrıca alınmalıdır.
