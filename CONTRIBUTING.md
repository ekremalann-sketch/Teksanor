# Katkı Rehberi

Teksanor kontrollü geliştirilen, kaynak kodu portföy incelemesine açık bir projedir. Bir değişiklik önermeden önce mevcut issue ve pull request'leri kontrol edin.

## Geliştirme akışı

1. Küçük ve tek amaçlı bir branch oluşturun.
2. Değişikliği TypeScript kurallarına ve mevcut tasarım diline uygun hazırlayın.
3. Gerçek kişi, müşteri, şirket veya finans verisi eklemeyin.
4. Aşağıdaki kontrolleri çalıştırın:

```bash
npm ci
npm test
npm run build
npm run build:pages
```

5. Pull request açıklamasında problemi, çözümü, test sonucunu ve kullanıcıya etkisini yazın.

## Pull request kontrol listesi

- [ ] Değişiklik tek bir problemi çözüyor.
- [ ] Testler ve üretim derlemesi başarıyla tamamlandı.
- [ ] Yeni ortam değişkenleri yalnızca adlarıyla belgelendi; değerler paylaşılmadı.
- [ ] Yetki veya veri kapsamı değiştiyse firma/rol ayrımı test edildi.
- [ ] Arayüz değişikliği masaüstü ve mobil görünümde kontrol edildi.
- [ ] Erişilebilirlik etiketleri ve klavye kullanımı gözden geçirildi.
- [ ] README veya yol haritası gerekiyorsa güncellendi.

## Kod ve veri güvenliği

- `.env`, token, parola, kimlik bilgisi ve üretim verisi commit edilmez.
- Loglara oturum, parola veya kişisel veri yazılmaz.
- Dış servis cevapları doğrulanmadan güvenilir kabul edilmez.
- Dosya yükleme değişiklikleri tür, boyut, yetki ve indirme kontrolleriyle birlikte ele alınır.

## Lisans

Katkı göndererek, katkının proje sahibi tarafından Teksanor'un mevcut lisans modeli kapsamında kullanılmasına izin vermiş olursunuz. Depodaki kodun ticari kullanımı ayrıca yazılı izin gerektirir.