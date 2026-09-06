import { getDb } from "./db";
import { requireModuleAccess, getMemberAccess, type ModuleId } from "./access";
import type { AppUser } from "./auth";
import type { Organization } from "./tenancy";
const records: Record<string, [string, ModuleId]> = {
  work_order: ["work_orders", "work-orders"], asset: ["assets", "assets"],
  payment: ["payment_records", "payments"], expense: ["expenses", "expenses"],
  project: ["projects", "projects"], field_visit: ["field_visits", "field-visits"],
  employee: ["employees", "hr"],
};
export async function requireAttachmentRecord(user: AppUser, org: Organization, type: string | null, id: string | null) {
  if (!type && !id) return;
  const rule = type ? records[type] : undefined;
  if (!rule || !id) throw new Error("Geçerli bir belge kaydı seçin.");
  await requireModuleAccess(user, org, rule[1]);
  if(type==="work_order"){
    const service=await getDb().prepare("SELECT assigned_user_id FROM service_jobs WHERE id=? AND organization_id=?").bind(id,org.id).first<{assigned_user_id:string}>();
    const access=await getMemberAccess(user,org);
    if(service && !["owner","company_admin","ceo","manager"].includes(access.profile) && service.assigned_user_id!==user.id)throw new Error("Bu servise erişim yetkiniz yok.");
  }
  if (!await getDb().prepare(`SELECT id FROM ${rule[0]} WHERE id=? AND organization_id=?`).bind(id,org.id).first()) throw new Error("İlişkili kayıt bulunamadı.");
}
