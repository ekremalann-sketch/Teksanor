import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb, addAudit } from "@/lib/db";
import { requireOrganization } from "@/lib/tenancy";
import { rejectCrossSiteMutation } from "@/lib/security";

const TABLE = "employees";
const COLUMNS = ["full_name", "title", "department", "email", "phone", "start_date", "status", "employment_type", "notes"];

function clean(value: unknown, max = 1200) { return String(value ?? "").trim().slice(0, max); }

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const context = await requireOrganization(request, user);
    const { id } = await ctx.params;
    const row = await getDb().prepare(`SELECT * FROM ${TABLE} WHERE id = ? AND organization_id = ?`)
      .bind(id, context.organization.id).first();
    if (!row) return NextResponse.json({ error: "Kayıt bulunamadı." }, { status: 404 });
    return NextResponse.json({ record: row });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Kayıt alınamadı." }, { status: 403 });
  }
}

async function update(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const context = await requireOrganization(request, user);
    const { id } = await ctx.params;
    const existing = await getDb().prepare(`SELECT * FROM ${TABLE} WHERE id = ? AND organization_id = ?`)
      .bind(id, context.organization.id).first<Record<string, unknown>>();
    if (!existing) return NextResponse.json({ error: "Kayıt bulunamadı." }, { status: 404 });
    const body = await request.json() as Record<string, unknown>;
    const sets: string[] = [];
    const values: unknown[] = [];
    for (const col of COLUMNS) {
      if (body[col] !== undefined) {
        sets.push(`${col} = ?`);
        const raw = body[col];
        values.push(typeof raw === "number" || typeof raw === "boolean" ? Number(raw) : (clean(raw) || null));
      }
    }
    if (sets.length === 0) return NextResponse.json({ error: "Güncellenecek alan bulunamadı." }, { status: 400 });
    sets.push("updated_at = CURRENT_TIMESTAMP");
    values.push(id, context.organization.id);
    await getDb().prepare(`UPDATE ${TABLE} SET ${sets.join(", ")} WHERE id = ? AND organization_id = ?`).bind(...values).run();
    await addAudit(user.id, "update", "employee", id, "Çalışan güncellendi.", context.organization.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Kayıt güncellenemedi." }, { status: 400 });
  }
}

export const PATCH = update;
export const PUT = update;

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const context = await requireOrganization(request, user);
    const { id } = await ctx.params;
    await getDb().prepare(`DELETE FROM ${TABLE} WHERE id = ? AND organization_id = ?`).bind(id, context.organization.id).run();
    await addAudit(user.id, "delete", "employee", id, undefined, context.organization.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Kayıt silinemedi." }, { status: 400 });
  }
}
