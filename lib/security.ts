import { NextResponse } from "next/server";

/**
 * Browser kaynaklı değiştirme isteklerinde farklı bir siteden gönderilen
 * çağrıları reddeder. Otomasyon/yerel test istemcilerinde Origin başlığı
 * bulunmayabileceği için yalnızca açık bir uyuşmazlık olduğunda engeller.
 */
export function rejectCrossSiteMutation(request: Request) {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") {
    return NextResponse.json({ error: "Güvenlik doğrulaması başarısız oldu." }, { status: 403 });
  }

  const origin = request.headers.get("origin");
  if (!origin) return null;
  try {
    if (new URL(origin).origin !== new URL(request.url).origin) {
      return NextResponse.json({ error: "İstek kaynağı doğrulanamadı." }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "İstek kaynağı geçersiz." }, { status: 403 });
  }
  return null;
}
