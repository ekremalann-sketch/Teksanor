import { getMemberAccess } from "@/lib/access";
import { createDueNotifications } from "@/lib/reminders";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addAudit, createId, getDb } from "@/lib/db";
import { requireOrganization } from "@/lib/tenancy";
import { rejectCrossSiteMutation } from "@/lib/security";

function text(value: unknown, max = 300) { return String(value ?? "").trim().slice(0, max); }
const TYPE = ["info", "warning", "error", "success"];

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const context = await requireOrganization(request, user);
    const access = await getMemberAccess(user, context.organization);
    await createDueNotifications(context.organization.id,user.id,access);
    const result = await getDb().prepare(
      `SELECT * FROM notifications WHERE organization_id = ? AND is_read = 0 AND user_id = ?
       ORDER BY created_at DESC LIMIT 50`)
      .bind(context.organization.id, user.id).all();
    return NextResponse.json({ notifications: result.results });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Bildirimler alınamadı." }, { status: 403 });
  }
}

export async function POST(request: Request) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const context = await requireOrganization(request, user);
    const body = await request.json() as Record<string, unknown>;
    const title = text(body.title);
    if (!title) return NextResponse.json({ error: "Bildirim başlığı gereklidir." }, { status: 400 });
    const type = TYPE.includes(text(body.type)) ? text(body.type) : "info";
    const id = createId("notif");
    if(!body.userId || !await getDb().prepare("SELECT user_id FROM organization_members WHERE organization_id=? AND user_id=? AND active=1").bind(context.organization.id,text(body.userId)).first()) return NextResponse.json({error:"Geçerli bir alıcı seçin."},{status:400});
    await getDb().prepare(`INSERT INTO notifications
      (id, organization_id, user_id, title, body, type, entity_type, entity_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, context.organization.id, body.userId ? text(body.userId) : null, title, text(body.body, 800) || null, type,
        text(body.entityType, 60) || null, text(body.entityId, 80) || null).run();
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Bildirim oluşturulamadı." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const context = await requireOrganization(request, user);
    await getDb().prepare(
      "UPDATE notifications SET is_read = 1 WHERE organization_id = ? AND user_id = ?")
      .bind(context.organization.id, user.id).run();
    await addAudit(user.id, "update", "notification", null, "Bildirimler okundu olarak işaretlendi.", context.organization.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Bildirimler güncellenemedi." }, { status: 400 });
  }
}
