import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb, addAudit } from "@/lib/db";
import { requireOrganization, canManageOrganization } from "@/lib/tenancy";
import { rejectCrossSiteMutation } from "@/lib/security";

function text(value: unknown, max = 200) { return String(value ?? "").trim().slice(0, max); }

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const { id } = await ctx.params;
    const context = await requireOrganization(new Request(request.url, { headers: { ...Object.fromEntries(request.headers), "x-organization-id": id } }), user);
    const org = await getDb().prepare("SELECT id, name, slug, sector FROM organizations WHERE id = ?").bind(context.organization.id).first();
    return NextResponse.json({ organization: org, role: context.role });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Çalışma alanı alınamadı." }, { status: 403 });
  }
}

export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const { id } = await ctx.params;
    const context = await requireOrganization(new Request(request.url, { headers: { ...Object.fromEntries(request.headers), "x-organization-id": id } }), user);
    if (!canManageOrganization(user, context.organization)) return NextResponse.json({ error: "Bu işlem için yetkiniz yok." }, { status: 403 });
    const body = await request.json() as Record<string, unknown>;
    await getDb().prepare("UPDATE organizations SET name = ?, sector = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .bind(text(body.name) || context.organization.name, text(body.sector) || context.organization.sector, context.organization.id).run();
    await addAudit(user.id, "update", "organization", context.organization.id, "Çalışma alanı güncellendi.", context.organization.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Çalışma alanı güncellenemedi." }, { status: 400 });
  }
}
