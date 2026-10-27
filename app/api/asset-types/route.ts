import { NextResponse } from "next/server";
import { errorStatus } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { addAudit, createId, getDb } from "@/lib/db";
import { rejectCrossSiteMutation } from "@/lib/security";
import { requireOrganization } from "@/lib/tenancy";

// Firma tanımlı ekipman türleri: firma neyi takip ediyorsa (klima, jeneratör, asansör, forklift…) kendisi ekler.
// Türe varsayılan bakım sıklığı ve kontrol listesi verilebilir; yeni varlık eklenirken bakım planı buna göre önerilir.
// Görüntüleme: varlık modülünü görebilen herkes. Ekleme/silme: varlık modülünde düzenleme yetkisi (tenancy).
const text = (value: unknown, max = 120) => String(value ?? "").trim().slice(0, max);
const FREQ = new Set(["day", "week", "month", "year"]);

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const { organization } = await requireOrganization(request, user);
    const result = await getDb().prepare(`SELECT t.*, (SELECT COUNT(*) FROM assets a WHERE a.organization_id = t.organization_id AND a.category = t.name) AS asset_count
      FROM asset_types t WHERE t.organization_id = ? ORDER BY t.name COLLATE NOCASE`).bind(organization.id).all();
    return NextResponse.json({ assetTypes: result.results });
  } catch (error) {
    return NextResponse.json({ error: "Ekipman türleri alınamadı." }, { status: errorStatus(error) });
  }
}

export async function POST(request: Request) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const { organization } = await requireOrganization(request, user);
    const body = await request.json() as Record<string, unknown>;
    const name = text(body.name, 60);
    if (name.length < 2) return NextResponse.json({ error: "Tür adını yazın (ör. Klima, Jeneratör, Asansör)." }, { status: 400 });
    const frequencyType = FREQ.has(text(body.frequencyType, 10)) ? text(body.frequencyType, 10) : null;
    if (body.frequencyType && !frequencyType) return NextResponse.json({ error: "Geçerli bir bakım sıklığı seçin." }, { status: 400 });
    const frequencyValue = frequencyType ? Number(body.frequencyValue ?? 1) : null;
    if (frequencyValue !== null && (!Number.isInteger(frequencyValue) || frequencyValue < 1 || frequencyValue > 999)) return NextResponse.json({ error: "Bakım sıklığı 1–999 arasında tam sayı olmalıdır." }, { status: 400 });
    const checklist = text(body.checklistText, 2000) || null;
    const exists = await getDb().prepare("SELECT id FROM asset_types WHERE organization_id = ? AND name = ? COLLATE NOCASE").bind(organization.id, name).first();
    if (exists) return NextResponse.json({ error: "Bu tür zaten var." }, { status: 409 });
    const id = createId("atype");
    const results = await getDb().batch([
      getDb().prepare(`INSERT INTO asset_types (id, organization_id, name, default_frequency_type, default_frequency_value, checklist_text, created_by)
        SELECT ?, ?, ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM asset_types WHERE organization_id=? AND name=? COLLATE NOCASE)`)
        .bind(id, organization.id, name, frequencyType, frequencyValue, checklist, user.id, organization.id, name),
      getDb().prepare(`INSERT INTO audit_logs (id,user_id,action,entity_type,entity_id,details,organization_id)
        SELECT ?,?,'create','asset_type',?,?,? WHERE EXISTS (SELECT 1 FROM asset_types WHERE id=? AND organization_id=?)`)
        .bind(createId("audit"), user.id, id, `${name} ekipman türü eklendi.`, organization.id, id, organization.id),
    ]);
    if (!(results[0] as { meta?: { changes?: number } }).meta?.changes) return NextResponse.json({ error: "Bu tür zaten var." }, { status: 409 });
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    return NextResponse.json({ error: "Ekipman türü eklenemedi." }, { status: errorStatus(error) });
  }
}

export async function DELETE(request: Request) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const { organization } = await requireOrganization(request, user);
    const id = text(new URL(request.url).searchParams.get("id"), 100);
    const row = await getDb().prepare("SELECT name FROM asset_types WHERE id = ? AND organization_id = ?").bind(id, organization.id).first<{ name: string }>();
    if (!row) return NextResponse.json({ error: "Tür bulunamadı." }, { status: 404 });
    // Varlıklar silinmez; kategori adı kayıtlarda kalır.
    await getDb().prepare("DELETE FROM asset_types WHERE id = ? AND organization_id = ?").bind(id, organization.id).run();
    await addAudit(user.id, "delete", "asset_type", id, `${row.name} ekipman türü kaldırıldı (varlıklar korunur).`, organization.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: "Tür kaldırılamadı." }, { status: errorStatus(error) });
  }
}
