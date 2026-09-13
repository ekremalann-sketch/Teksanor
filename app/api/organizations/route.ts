import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb, createId, addAudit } from "@/lib/db";
import { rejectCrossSiteMutation } from "@/lib/security";

function text(value: unknown, max = 200) { return String(value ?? "").trim().slice(0, max); }
function slugify(value: string) {
  return value.toLocaleLowerCase("tr-TR").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60) || "firma";
}

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  const rows = await getDb().prepare(
    `SELECT o.id, o.name, o.sector, m.role
     FROM organization_members m JOIN organizations o ON o.id = m.organization_id
     WHERE m.user_id = ? ORDER BY o.name`).bind(user.id).all();
  return NextResponse.json({ organizations: rows.results });
}

export async function POST(request: Request) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const name = text(body.name);
    if (!name) return NextResponse.json({ error: "Firma adı gereklidir." }, { status: 400 });
    const orgId = createId("org");
    await getDb().prepare("INSERT INTO organizations (id, name, slug, sector) VALUES (?, ?, ?, ?)")
      .bind(orgId, name, `${slugify(name)}-${orgId.slice(-4)}`, text(body.sector) || "Genel").run();
    await getDb().prepare("INSERT INTO organization_members (id, organization_id, user_id, role) VALUES (?, ?, ?, ?)")
      .bind(createId("mem"), orgId, user.id, "owner").run();
    await addAudit(user.id, "create", "organization", orgId, `${name} çalışma alanı oluşturuldu.`, orgId);
    return NextResponse.json({ ok: true, id: orgId });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Çalışma alanı oluşturulamadı." }, { status: 400 });
  }
}
