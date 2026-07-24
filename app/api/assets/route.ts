import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addAudit, createId, getDb } from "@/lib/db";
import { rejectCrossSiteMutation } from "@/lib/security";
import { requireOrganization } from "@/lib/tenancy";

const text = (value: unknown, max = 240) => String(value ?? "").trim().slice(0, max);
const statuses = new Set(["active", "maintenance", "inactive", "retired"]);

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const { organization } = await requireOrganization(request, user);
    const result = await getDb().prepare(`SELECT a.*,
      COUNT(mp.id) AS maintenance_count,
      MIN(CASE WHEN mp.status = 'active' THEN mp.next_due_date END) AS next_maintenance_date
      FROM assets a LEFT JOIN maintenance_plans mp ON mp.asset_id = a.id AND mp.organization_id = a.organization_id
      WHERE a.organization_id = ? GROUP BY a.id ORDER BY a.name COLLATE NOCASE`)
      .bind(organization.id).all();
    return NextResponse.json({ assets: result.results });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Varlıklar alınamadı." }, { status: 403 });
  }
}

export async function POST(request: Request) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const { organization } = await requireOrganization(request, user);
    const body = await request.json() as Record<string, unknown>;
    const name = text(body.name);
    if (!name) return NextResponse.json({ error: "Varlık adı gereklidir." }, { status: 400 });
    const count = await getDb().prepare("SELECT COUNT(*) AS c FROM assets WHERE organization_id = ?").bind(organization.id).first<{ c: number }>();
    const assetCode = text(body.assetCode, 40) || `VRL-${String((count?.c ?? 0) + 1).padStart(4, "0")}`;
    const status = statuses.has(text(body.status)) ? text(body.status) : "active";
    const id = createId("asset");
    await getDb().prepare(`INSERT INTO assets
      (id, organization_id, asset_code, name, category, brand, model, serial_number, location, status,
       responsible_name, purchase_date, warranty_end, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, organization.id, assetCode, name, text(body.category) || "Ekipman", text(body.brand) || null,
        text(body.model) || null, text(body.serialNumber) || null, text(body.location) || null, status,
        text(body.responsibleName) || null, text(body.purchaseDate, 20) || null, text(body.warrantyEnd, 20) || null,
        text(body.notes, 1500) || null, user.id).run();
    await addAudit(user.id, "create", "asset", id, `${assetCode} varlığı oluşturuldu.`, organization.id);
    return NextResponse.json({ ok: true, id, assetCode });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Varlık oluşturulamadı.";
    return NextResponse.json({ error: message.includes("UNIQUE") ? "Bu varlık kodu zaten kullanılıyor." : message }, { status: 400 });
  }
}
