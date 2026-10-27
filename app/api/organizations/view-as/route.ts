import { NextResponse } from "next/server";
import { viewAsRequiresMfa } from "@/lib/mfa";
import { getCurrentUser } from "@/lib/auth";
import { addAudit, getDb } from "@/lib/db";
import { rejectCrossSiteMutation } from "@/lib/security";
import { VIEW_AS_COOKIE } from "@/lib/tenancy";

// "Firma gözünden gör": platform yöneticisi bir firmanın panelini yalnız okuma amacıyla, açıkça başlatarak açar.
// Başlatma bilinçli bir işlemdir (POST), 60 dakika sonra kendiliğinden biter ve denetim kaydına yazılır.
// Firma listesi ve kayıtları bu çerez olmadan platform yöneticisine de kapalıdır (kiracı ayrımı korunur).
export async function POST(request: Request) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Platform yöneticisi gerekli." }, { status: 403 });
  // Başka firmanın verisini görmek güçlü kimlik doğrulama ister (MFA_MODE=off dışında); erteleme yetmez.
  if (viewAsRequiresMfa(user)) return NextResponse.json({ error: "Firma gözünden görünüm için önce Hesap güvenliği ekranından iki aşamalı doğrulamayı etkinleştirin." }, { status: 403 });

  const body = await request.json().catch(() => ({})) as { organizationId?: string; reason?: string };
  const reason = String(body.reason ?? "").trim().slice(0, 200);
  if (reason.length < 5) return NextResponse.json({ error: "Kısa bir gerekçe yazın (ör. destek talebi numarası)." }, { status: 400 });
  const organization = await getDb().prepare("SELECT id, name FROM organizations WHERE id = ? AND active = 1").bind(String(body.organizationId ?? "")).first<{ id: string; name: string }>();
  if (!organization) return NextResponse.json({ error: "Firma bulunamadı." }, { status: 404 });
  await addAudit(user.id, "platform_view_as_start", "organization", organization.id, `${organization.name} firma gözünden (salt okunur) açıldı. Gerekçe: ${reason}`, organization.id);
  const response = NextResponse.json({ ok: true, organization });
  response.headers.set("Set-Cookie", `${VIEW_AS_COOKIE}=${encodeURIComponent(organization.id)}; Path=/; Max-Age=3600; HttpOnly; Secure; SameSite=Strict`);
  return response;
}

export async function DELETE(request: Request) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  const response = NextResponse.json({ ok: true });
  response.headers.set("Set-Cookie", `${VIEW_AS_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`);
  return response;
}
