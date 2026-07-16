import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addAudit, DEFAULT_ORGANIZATION_ID, getDb } from "@/lib/db";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Platform yetkilisi gerekli." }, { status: 403 });
  const { id } = await context.params;
  if (id === DEFAULT_ORGANIZATION_ID) return NextResponse.json({ error: "Ana çalışma alanı devre dışı bırakılamaz." }, { status: 400 });
  const body = (await request.json()) as { active?: boolean };
  if (typeof body.active !== "boolean") return NextResponse.json({ error: "Aktiflik durumu gereklidir." }, { status: 400 });
  const organization = await getDb().prepare("SELECT id, name FROM organizations WHERE id = ?").bind(id).first<{ id: string; name: string }>();
  if (!organization) return NextResponse.json({ error: "Çalışma alanı bulunamadı." }, { status: 404 });
  await getDb().prepare("UPDATE organizations SET active = ? WHERE id = ?").bind(body.active ? 1 : 0, id).run();
  await addAudit(user.id, body.active ? "activate" : "deactivate", "organization", id, `${organization.name} çalışma alanı ${body.active ? "etkinleştirildi" : "devre dışı bırakıldı"}.`, id);
  return NextResponse.json({ ok: true, active: body.active });
}
