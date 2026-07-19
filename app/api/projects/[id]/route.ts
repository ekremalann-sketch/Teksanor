import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addAudit, getDb } from "@/lib/db";
import { canManageOrganization, requireOrganization } from "@/lib/tenancy";

const STATUSES = ["planned", "active", "on_hold", "completed", "canceled"] as const;

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  let context;
  try { context = await requireOrganization(request, user); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Çalışma alanına erişim reddedildi." }, { status: 403 }); }
  const body = (await request.json()) as { status?: string; progress?: number };
  const updates: string[] = [];
  const values: unknown[] = [];
  if (body.status && STATUSES.includes(body.status as typeof STATUSES[number])) { updates.push("status = ?"); values.push(body.status); }
  if (body.progress !== undefined) { updates.push("progress = ?"); values.push(Math.min(100, Math.max(0, Number(body.progress)))); }
  if (!updates.length) return NextResponse.json({ error: "Güncellenecek alan bulunamadı." }, { status: 400 });
  updates.push("updated_at = CURRENT_TIMESTAMP");
  await getDb().prepare(`UPDATE projects SET ${updates.join(", ")} WHERE id = ? AND organization_id = ?`)
    .bind(...values, id, context.organization.id).run();
  await addAudit(user.id, "update", "project", id, "Proje güncellendi.", context.organization.id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  let context;
  try { context = await requireOrganization(request, user); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Çalışma alanına erişim reddedildi." }, { status: 403 }); }
  if (!canManageOrganization(user, context.organization)) return NextResponse.json({ error: "Bu işlem için yönetici yetkisi gereklidir." }, { status: 403 });
  await getDb().prepare("DELETE FROM projects WHERE id = ? AND organization_id = ?").bind(id, context.organization.id).run();
  await addAudit(user.id, "delete", "project", id, "Proje silindi.", context.organization.id);
  return NextResponse.json({ ok: true });
}
