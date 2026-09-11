import type { AppUser } from "./auth";
import { getDb } from "./db";
import type { Organization } from "./tenancy";

export const moduleIds = [
  "overview", "departments", "projects", "tasks", "work-orders", "assets", "maintenance",
  "field-visits", "procurement", "crm", "hr", "risks", "automations", "agents", "readiness",
  "financial", "payments", "expenses", "treasury", "reports", "files", "company", "users",
] as const;

export type ModuleId = typeof moduleIds[number];
export type AccessProfile = "owner" | "company_admin" | "ceo" | "manager" | "finance" | "hr" | "it" | "employee";
type Rule = { view: ModuleId[]; edit: ModuleId[]; label: string };
const operational: ModuleId[] = ["overview", "departments", "projects", "tasks", "work-orders", "assets", "maintenance", "field-visits", "procurement", "crm", "risks", "automations", "agents", "readiness", "reports", "files", "company"];
const finance: ModuleId[] = ["financial", "payments", "expenses", "treasury", "reports"];

export const accessRules: Record<AccessProfile, Rule> = {
  owner: { label: "Firma sahibi", view: [...moduleIds], edit: [...moduleIds] },
  company_admin: { label: "Firma yöneticisi", view: [...moduleIds], edit: [...moduleIds] },
  ceo: { label: "Üst yönetim", view: [...operational, ...finance, "hr"], edit: [...operational, ...finance] },
  manager: { label: "Birim yöneticisi", view: operational, edit: ["projects", "tasks", "work-orders", "assets", "maintenance", "field-visits", "procurement", "crm", "risks", "files"] },
  finance: { label: "Finans ekibi", view: ["overview", "financial", "payments", "expenses", "treasury", "reports", "files", "company"], edit: ["payments", "expenses", "treasury", "reports", "files"] },
  hr: { label: "İnsan kaynakları", view: ["overview", "departments", "tasks", "hr", "reports", "files", "company"], edit: ["tasks", "hr", "files"] },
  it: { label: "Bilgi işlem", view: operational, edit: ["projects", "tasks", "work-orders", "assets", "maintenance", "automations", "agents", "readiness", "files"] },
  employee: { label: "Çalışan", view: ["overview", "departments", "projects", "tasks", "work-orders", "files", "company"], edit: ["tasks", "work-orders", "files"] },
};

export type MemberAccess = {
  profile: AccessProfile;
  jobRole: string;
  department: string | null;
  label: string;
  viewModules: ModuleId[];
  editModules: ModuleId[];
};

export async function getMemberAccess(user: AppUser, organization: Organization): Promise<MemberAccess> {
  if (user.role === "admin") {
    const rule = accessRules.owner;
    return { profile: "owner", jobRole: "platform_admin", department: null, label: "Platform yetkilisi", viewModules: rule.view, editModules: rule.edit };
  }
  const saved = await getDb().prepare(`SELECT job_role, department, access_profile
    FROM organization_member_access WHERE organization_id = ? AND user_id = ?`)
    .bind(organization.id, user.id).first<{ job_role: string; department: string | null; access_profile: string }>();
  const fallback: AccessProfile = organization.membership_role === "owner" ? "owner" : organization.membership_role === "admin" ? "company_admin" : "employee";
  const profile = (saved?.access_profile && saved.access_profile in accessRules ? saved.access_profile : fallback) as AccessProfile;
  const rule = accessRules[profile];
  return { profile, jobRole: saved?.job_role || profile, department: saved?.department || null, label: rule.label, viewModules: [...new Set(rule.view)], editModules: [...new Set(rule.edit)] };
}

export function canView(access: MemberAccess, module: ModuleId) {
  return access.viewModules.includes(module);
}

export function canEdit(access: MemberAccess, module: ModuleId) {
  return access.editModules.includes(module);
}

export async function requireModuleAccess(user: AppUser, organization: Organization, module: ModuleId, mode: "view" | "edit" = "view") {
  const access = await getMemberAccess(user, organization);
  const allowed = mode === "edit" ? canEdit(access, module) : canView(access, module);
  if (!allowed) throw new Error("Bu bölüm için görev yetkiniz bulunmuyor.");
  return access;
}
