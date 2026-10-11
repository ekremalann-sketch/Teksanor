import type { AppUser } from "./auth";
import { getDb } from "./db";
import type { Organization } from "./tenancy";

import { accessRules, moduleIds, type AccessProfile, type ModuleId } from "./access-rules";
export { accessRules, moduleIds, homeFor, type AccessProfile, type ModuleId } from "./access-rules";

/** Firma veya modül yetkisi reddi. Mesaj aynı kalır; rotalar bunu 403 olarak döndürür. */
export class AccessDeniedError extends Error {
  readonly status = 403;
}

/** Yetki reddini 403'e, diğer hataları verilen varsayılana (genellikle 400) çevirir. */
export function errorStatus(error: unknown, fallback = 400) {
  return error instanceof AccessDeniedError ? 403 : fallback;
}

export type MemberAccess = {
  profile: AccessProfile;
  jobRole: string;
  department: string | null;
  label: string;
  viewModules: ModuleId[];
  editModules: ModuleId[];
};

export async function getMemberAccess(user: AppUser, organization: Organization): Promise<MemberAccess> {
  // Platform yöneticisinin "firma gözünden" görünümü: her şeyi görür, hiçbir şeyi değiştiremez.
  if (organization.view_as) {
    return { profile: "company_admin", jobRole: "Platform görünümü", department: null, label: "Platform görünümü (salt okunur)", viewModules: [...moduleIds], editModules: [] };
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
  if (!allowed) throw new AccessDeniedError("Bu bölüm için görev yetkiniz bulunmuyor.");
  return access;
}
