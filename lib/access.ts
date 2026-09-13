// Modül bazlı yetki kontrolü (rol tabanlı erişim).
import type { CurrentUser } from "@/lib/auth";
import type { OrganizationContext } from "@/lib/tenancy";

type AccessAction = "view" | "edit";

// Yönetici rolleri tüm modülleri düzenleyebilir; üyeler operasyonel
// modüllerde düzenleme, finans modüllerinde yalnız görüntüleme yapabilir.
const MANAGER_ROLES = new Set(["owner", "admin", "manager"]);
const MEMBER_EDITABLE = new Set(["work_orders", "field_visits", "maintenance", "tasks", "assets", "customers", "service"]);
const FINANCE_MODULES = new Set(["payments", "treasury", "expenses"]);

export async function requireModuleAccess(
  _user: CurrentUser,
  organization: OrganizationContext,
  module: string,
  action: AccessAction,
): Promise<void> {
  const role = organization.role ?? "member";
  if (MANAGER_ROLES.has(role)) return; // Yöneticiler her şeyi yapabilir.

  if (action === "view") {
    // Üyeler finans dışı modülleri görüntüleyebilir; finans görüntüleme de serbest.
    return;
  }

  // action === "edit"
  if (FINANCE_MODULES.has(module)) {
    throw new Error("Finansal kayıtları yalnızca yöneticiler düzenleyebilir.");
  }
  if (!MEMBER_EDITABLE.has(module)) {
    throw new Error("Bu işlem için yetkiniz yok.");
  }
}

export function canEditModule(organization: OrganizationContext, module: string): boolean {
  const role = organization.role ?? "member";
  if (MANAGER_ROLES.has(role)) return true;
  return MEMBER_EDITABLE.has(module);
}
