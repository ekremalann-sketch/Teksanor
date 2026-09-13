import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { requireOrganization } from "@/lib/tenancy";
import { rejectCrossSiteMutation } from "@/lib/security";

function text(value: unknown, max = 4000) { return String(value ?? "").trim().slice(0, max); }

export async function POST(request: Request) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const context = await requireOrganization(request, user);
    const body = await request.json() as Record<string, unknown>;
    const prompt = text(body.message);
    if (!prompt) return NextResponse.json({ error: "Mesaj gereklidir." }, { status: 400 });
    // İnsan onayı zorunlu: ajan yalnızca taslak üretir, otomatik aksiyon almaz.
    return NextResponse.json({
      reply: `“${prompt.slice(0, 80)}” için taslak hazırlandı. Yapay zekâ bağlantısı bu ortamda etkin değil; içerik sorumlu kişinin onayına sunulmalıdır.`,
      source: "fallback",
      organization: context.organization.id,
      requiresApproval: true,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "İstek işlenemedi." }, { status: 400 });
  }
}
