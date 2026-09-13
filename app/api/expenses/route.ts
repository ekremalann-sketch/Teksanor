import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb, createId, addAudit } from "@/lib/db";
import { requireOrganization } from "@/lib/tenancy";
import { rejectCrossSiteMutation } from "@/lib/security";
import { parseOptionalLocalizedNumber } from "@/lib/finance";

function text(value: unknown, max = 200) { return String(value ?? "").trim().slice(0, max); }

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const context = await requireOrganization(request, user);
    const rows = await getDb().prepare("SELECT * FROM expenses WHERE organization_id = ? ORDER BY expense_date DESC, created_at DESC")
      .bind(context.organization.id).all();
    return NextResponse.json({ expenses: rows.results });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Giderler alınamadı." }, { status: 403 });
  }
}

export async function POST(request: Request) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const context = await requireOrganization(request, user);
    const body = await request.json() as Record<string, unknown>;
    const category = text(body.category);
    if (!category) return NextResponse.json({ error: "Gider kategorisi gereklidir." }, { status: 400 });
    const amount = parseOptionalLocalizedNumber(body.amount, "Tutar") ?? 0;
    const id = createId("exp");
    await getDb().prepare(`INSERT INTO expenses (id, organization_id, category, description, amount, currency, expense_date, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, context.organization.id, category, text(body.description, 600) || null, amount, text(body.currency, 8) || "TRY",
        text(body.expenseDate, 20) || new Date().toISOString().slice(0, 10), text(body.status) || "pending", user.id).run();
    await addAudit(user.id, "create", "expense", id, `${category} gideri eklendi.`, context.organization.id);
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gider eklenemedi." }, { status: 400 });
  }
}
