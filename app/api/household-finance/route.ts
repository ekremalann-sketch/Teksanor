import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addAudit, createId, getDb } from "@/lib/db";
import { requireOrganization } from "@/lib/tenancy";
import { rejectCrossSiteMutation } from "@/lib/security";
import { requireModuleAccess } from "@/lib/access";

type WorkbookPayload = {
  version: 1;
  period: string;
  sheets: Record<string, { headers: string[]; rows: Array<Record<string, unknown>> }>;
};

const expectedSheets = [
  "Kartlar ve KMH", "Ödeme Takvimi", "Ev ve Yaşam Giderleri",
  "Altın Borçları", "Şirket Hareketleri", "Kontrol Edilecekler",
] as const;

function validPayload(value: unknown): value is WorkbookPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<WorkbookPayload>;
  if (payload.version !== 1 || typeof payload.period !== "string" || !payload.period.trim()) return false;
  if (!payload.sheets || typeof payload.sheets !== "object") return false;
  return expectedSheets.every((name) => {
    const sheet = payload.sheets?.[name];
    return Boolean(sheet && Array.isArray(sheet.headers) && Array.isArray(sheet.rows));
  });
}

async function contextFor(request: Request, mode: "view" | "edit") {
  const user = await getCurrentUser(request);
  if (!user) return { error: NextResponse.json({ error: "Oturum gerekli." }, { status: 401 }) } as const;
  try {
    const context = await requireOrganization(request, user);
    await requireModuleAccess(user, context.organization, "household-finance", mode);
    return { user, context } as const;
  } catch (error) {
    return { error: NextResponse.json({ error: error instanceof Error ? error.message : "Yetki reddedildi." }, { status: 403 }) } as const;
  }
}

export async function GET(request: Request) {
  const resolved = await contextFor(request, "view");
  if ("error" in resolved) return resolved.error;
  const rows = await getDb().prepare(`SELECT id, period, payload_json, source_name, updated_at
    FROM household_finance_workbooks WHERE organization_id = ? ORDER BY updated_at DESC`)
    .bind(resolved.context.organization.id).all<{ id: string; period: string; payload_json: string; source_name: string | null; updated_at: string }>();
  return NextResponse.json({ workbooks: rows.results.map(({ payload_json, ...row }) => ({ ...row, payload: JSON.parse(payload_json) })) });
}

export async function POST(request: Request) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  const resolved = await contextFor(request, "edit");
  if ("error" in resolved) return resolved.error;
  if (Number(request.headers.get("content-length") || 0) > 2_000_000) {
    return NextResponse.json({ error: "Finans çalışma kitabı güvenli aktarım sınırını aşıyor." }, { status: 413 });
  }
  const body = await request.json() as { payload?: unknown; sourceName?: unknown };
  if (!validPayload(body.payload)) return NextResponse.json({ error: "Çalışma kitabı yapısı eksik veya geçersiz." }, { status: 400 });
  const payload = body.payload;
  const id = createId("household");
  await getDb().prepare(`INSERT INTO household_finance_workbooks
    (id, organization_id, period, payload_json, source_name, created_by, updated_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(organization_id, period) DO UPDATE SET payload_json = excluded.payload_json,
      source_name = excluded.source_name, updated_by = excluded.updated_by, updated_at = CURRENT_TIMESTAMP`)
    .bind(id, resolved.context.organization.id, payload.period.trim(), JSON.stringify(payload),
      typeof body.sourceName === "string" ? body.sourceName.slice(0, 180) : null,
      resolved.user.id, resolved.user.id).run();
  await addAudit(resolved.user.id, "upsert", "household_finance_workbook", id,
    `${payload.period} aile finans çalışma kitabı aktarıldı.`, resolved.context.organization.id);
  return NextResponse.json({ id, period: payload.period }, { status: 201 });
}
