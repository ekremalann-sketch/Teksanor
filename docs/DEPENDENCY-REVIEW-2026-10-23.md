# Bağımlılık yükseltmesi — 23 Ekim 2026

Bu PR ayrı bağımlılık güncellemesidir. #25 güvenlik kurulumunu veya ayrı Cloudflare Pages yapılandırma düzeltmesini içermez.

- @cloudflare/vite-plugin 1.54.4 → 1.65.0.
- wrangler 4.129.0 → 4.152.0; vite 8.1.5 → 8.3.5.
- Dar overrides: exceljs → uuid 11.1.1; satori → fflate 0.7.5; @esbuild-kit/core-utils → esbuild 0.28.2.
- Uyumlu alt paket yamaları kilit dosyasında güncellendi. drizzle-kit 0.31.10, exceljs 4.4.0 ve vinext 1.1.0 korundu; audit'in önerdiği eski sürümlere dönülmedi.

## Doğrulama

`npm test`: 223/223; `npm run typecheck`: başarılı; `npm run build:pages`: başarılı; `npm run lint`: başarılı. Bu projede lint komutu `tsc --noEmit` çalıştırır, ayrı ESLint kural taraması değildir.

`node scripts/check-dependency-overrides.mjs`: gerçek XLSX yaz/oku (değer ve formül sonucu), gzip roundtrip, Satori SVG üretimi ve TypeScript Drizzle şemasından geçici SQL migration üretimi başarılı. Gerçek veritabanı kullanılmadı.

Kalan tam audit: braces ≤3.0.3 kaynaklı GHSA-vfj7-8cjw-p6xm; registry'de güvenli braces sürümü bulunamadı. Aynı alt paketin zincirdeki üst paketleri ayrı audit satırlarıdır. Üretim bağımlılığı taraması ayrıca kontrol edildi. Tam audit'in temiz olduğu veya bütün güvenlik CI kontrollerinin geçtiği iddia edilmez. Üst paketin/alt paketin güvenli sürümü çıktığında yeniden yükseltme gerekir.

Pages'teki son paketleme hatası yalnız paket yükseltmesiyle kapatılmış sayılmaz: ayrı Pages düzeltme PR'ı da gereklidir. Ana dala birleştirme veya canlı yayın yapılmadı.

Kaynak sürümler: https://registry.npmjs.org/@cloudflare%2fvite-plugin/latest — https://registry.npmjs.org/wrangler/latest — https://registry.npmjs.org/vite/latest
