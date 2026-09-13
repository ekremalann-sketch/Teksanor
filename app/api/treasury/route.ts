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
    const rows = await getDb().prepare("SELECT * FROM treasury_accounts WHERE organization_id = ? ORDER BY created_at DESC")
      .bind(context.organization.id).all();
    return NextResponse.json({ accounts: rows.results });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Kasa hesapları alınamadı." }, { status: 403 });
  }
}

export async function POST(request: Request) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const context = await requireOrganization(request, user);
    const body = await request.json() as Record<string, unknown>;
    const accountName = text(body.accountName);
    if (!accountName) return NextResponse.json({ error: "Hesap adı gereklidir." }, { status: 400 });
    const balance = parseOptionalLocalizedNumber(body.balance, "Bakiye") ?? 0;
    const id = createId("acc");
    await getDb().prepare(`INSERT INTO treasury_accounts (id, organization_id, account_name, bank_name, currency, balance, account_type, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, context.organization.id, accountName, text(body.bankName) || null, text(body.currency, 8) || "TRY", balance, text(body.accountType) || "bank", user.id).run();
    await addAudit(user.id, "create", "treasury_account", id, `${accountName} hesabı eklendi.`, context.organization.id);
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Hesap eklenemedi." }, { status: 400 });
  }
}
