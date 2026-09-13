// Belge (attachment) kayıtlarına erişim denetimi — kayıt firmaya ait mi?
import { getDb } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import type { OrganizationContext } from "@/lib/tenancy";

const RECORD_TABLES: Record<string, string> = {
  work_order: "work_orders",
  customer: "customers",
  asset: "assets",
  field_visit: "field_visits",
  maintenance_plan: "maintenance_plans",
  procurement_request: "procurement_requests",
  payment_record: "payment_records",
};

export async function requireAttachmentRecord(
  _user: CurrentUser,
  organization: OrganizationContext,
  recordType: string | null,
  recordId: string | null,
): Promise<void> {
  // Kayda bağlı olmayan genel belgelere izin verilir.
  if (!recordType || !recordId) return;
  const table = RECORD_TABLES[recordType];
  if (!table) throw new Error("Geçersiz belge kaydı türü.");
  const row = await getDb().prepare(`SELECT id FROM ${table} WHERE id = ? AND organization_id = ?`)
    .bind(recordId, organization.id).first();
  if (!row) throw new Error("Belge kaydı bu firmaya ait değil.");
}
