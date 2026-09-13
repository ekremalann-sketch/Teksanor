import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { requireOrganization } from "@/lib/tenancy";
import { rejectCrossSiteMutation } from "@/lib/security";

// Saha notundan servis raporu taslağı üretir.
// Ortamda bir dil modeli bağlantısı yoksa notu biçimlendirerek geri döner (fallback).
export async function POST(request: Request) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    await requireOrganization(request, user);
    const body = await request.json() as Record<string, unknown>;
    const note = String(body.note ?? "").trim().slice(0, 6000);
    if (!note) return NextResponse.json({ error: "Önce bir saha notu girin." }, { status: 400 });

    const lines = note.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const bullets = lines.map((l) => (l.startsWith("-") || l.startsWith("•") ? l : `- ${l}`)).join("\n");
    const today = new Date().toLocaleDateString("tr-TR");
    const draft = [
      `Servis Raporu (${today})`,
      "",
      "Yapılan işlemler:",
      bullets,
      "",
      "Sonuç: İşlem saha notlarına göre tamamlanmıştır. Ayrıntılar için ekli belgeleri inceleyiniz.",
    ].join("\n");

    return NextResponse.json({ draft, source: "fallback" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Taslak hazırlanamadı." }, { status: 400 });
  }
}
