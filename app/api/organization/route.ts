import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addAudit, getDb } from "@/lib/db";
import { canManageOrganization, requireOrganization } from "@/lib/tenancy";

const fields = [
  "legalName", "taxOffice", "taxNumber", "mersisNumber", "tradeRegistryNumber", "sector",
  "phone", "email", "website", "address", "about",
] as const;

function clean(value: unknown, limit: number) {
  return String(value ?? "").trim().slice(0, limit) || null;
}

export async function POST(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  let context;
  try { context = await requireOrganization(request, user); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Çalışma alanına erişim reddedildi." }, { status: 403 }); }
  if (!canManageOrganization(user, context.organization)) return NextResponse.json({ error: "Firma bilgilerini yalnızca firma yetkilisi değiştirebilir." }, { status: 403 });

  const body = (await request.json()) as Record<string, unknown>;
  const values = fields.map((field) => clean(body[field], field === "about" || field === "address" ? 1000 : 180));
  const email = values[7];
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "Geçerli bir e-posta adresi girin." }, { status: 400 });

  await getDb().prepare(`INSERT INTO organization_profiles
    (organization_id, legal_name, tax_office, tax_number, mersis_number, trade_registry_number, sector, phone, email, website, address, about, updated_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(organization_id) DO UPDATE SET
      legal_name = excluded.legal_name, tax_office = excluded.tax_office, tax_number = excluded.tax_number,
      mersis_number = excluded.mersis_number, trade_registry_number = excluded.trade_registry_number,
      sector = excluded.sector, phone = excluded.phone, email = excluded.email, website = excluded.website,
      address = excluded.address, about = excluded.about, updated_by = excluded.updated_by, updated_at = CURRENT_TIMESTAMP`)
    .bind(context.organization.id, ...values, user.id).run();
  await addAudit(user.id, "update", "organization_profile", context.organization.id, "Firma profil bilgileri güncellendi.", context.organization.id);
  return NextResponse.json({ ok: true });
}
