import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addAudit, createId, getDb } from "@/lib/db";
import { rejectCrossSiteMutation } from "@/lib/security";
import { requireOrganization } from "@/lib/tenancy";

const text = (value: unknown, max = 500) => String(value ?? "").trim().slice(0, max);
const frequencies = new Set(["day", "week", "month", "year", "usage"]);

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const { organization } = await requireOrganization(request, user);
    const result = await getDb().prepare(`SELECT mp.*, a.asset_code, a.name AS asset_name, a.location AS asset_location
      FROM maintenance_plans mp JOIN assets a ON a.id=mp.asset_id AND a.organization_id=mp.organization_id
      WHERE mp.organization_id=? ORDER BY CASE WHEN mp.status='active' THEN 0 ELSE 1 END,
      COALESCE(mp.next_due_date,'9999-12-31'), mp.created_at DESC`).bind(organization.id).all();
    return NextResponse.json({ maintenancePlans: result.results });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Bakım planları alınamadı." }, { status: 403 });
  }
}

export async function POST(request: Request) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const { organization } = await requireOrganization(request, user);
    const body = await request.json() as Record<string, unknown>;
    const assetId = text(body.assetId, 100), title = text(body.title, 240);
    if (!assetId || !title) return NextResponse.json({ error: "Varlık ve bakım başlığı gereklidir." }, { status: 400 });
    const asset = await getDb().prepare("SELECT id FROM assets WHERE id=? AND organization_id=?").bind(assetId, organization.id).first();
    if (!asset) return NextResponse.json({ error: "Seçilen varlık bu firmaya ait değil." }, { status: 404 });
    const frequencyType = frequencies.has(text(body.frequencyType, 20)) ? text(body.frequencyType, 20) : "month";
    const id = createId("maint");
    await getDb().prepare(`INSERT INTO maintenance_plans
      (id,organization_id,asset_id,title,frequency_type,frequency_value,next_due_date,assigned_to,checklist_text,status,created_by)
      VALUES (?,?,?,?,?,?,?,?,?,'active',?)`).bind(id, organization.id, assetId, title, frequencyType,
        Math.max(1, Math.floor(Number(body.frequencyValue || 1))), text(body.nextDueDate, 20) || null,
        text(body.assignedTo, 240) || null, text(body.checklistText, 3000) || null, user.id).run();
    await addAudit(user.id, "create", "maintenance_plan", id, `${title} bakım planı oluşturuldu.`, organization.id);
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Bakım planı oluşturulamadı." }, { status: 400 });
  }
}
