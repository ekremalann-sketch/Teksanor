// Teksanor'a özel güvenlik: siteler-arası (cross-site) mutasyonları reddeder.
// KLINORBIS ve Teksanor tamamen ayrı sistemlerdir; birinin isteği diğerinde
// mutasyon tetikleyemez.
import { NextResponse } from "next/server";

const FOREIGN_MARKERS = ["x-klinorbis-request", "x-klinorbis-site", "x-site-klinorbis"];

export function rejectCrossSiteMutation(request: Request): NextResponse | null {
  // Başka bir sistemin (ör. KLINORBIS) kimlik başlığı varsa reddet.
  for (const marker of FOREIGN_MARKERS) {
    if (request.headers.get(marker)) {
      return NextResponse.json({ error: "Siteler arası işlem engellendi." }, { status: 403 });
    }
  }
  const declaredSite = request.headers.get("x-site");
  if (declaredSite && declaredSite.toLowerCase() !== "teksanor") {
    return NextResponse.json({ error: "Bu işlem yalnızca Teksanor üzerinden yapılabilir." }, { status: 403 });
  }

  // Aynı köken (same-origin) doğrulaması — CSRF koruması.
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      const requestOrigin = new URL(request.url).origin;
      if (origin !== requestOrigin) {
        return NextResponse.json({ error: "Farklı kökenden gelen işlem engellendi." }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: "Geçersiz istek kaynağı." }, { status: 403 });
    }
  }
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    return NextResponse.json({ error: "Siteler arası işlem engellendi." }, { status: 403 });
  }
  return null;
}
