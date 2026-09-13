// Çok kiracılı (multi-tenant) firma bazlı erişim katmanı.
import { getDb } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";

export type OrganizationContext = {
  id: string;
  name: string;
  slug: string | null;
  sector: string | null;
  role: string;
};

export type TenantContext = {
  organization: OrganizationContext;
  role: string;
};

const MANAGE_ROLES = new Set(["owner", "admin", "manager"]);

export function canManageOrganization(_user: CurrentUser, organization: { role?: string }): boolean {
  return MANAGE_ROLES.has(organization.role ?? "");
}

function requestedOrganizationId(request: Request): string | null {
  const header = request.headers.get("x-organization-id");
  if (header) return header.trim();
  try {
    const url = new URL(request.url);
    const q = url.searchParams.get("organizationId");
    if (q) return q.trim();
  } catch {
    // yoksay
  }
  return null;
}

export async function requireOrganization(request: Request, user: CurrentUser): Promise<TenantContext> {
  const db = getDb();
  const requestedId = requestedOrganizationId(request);

  const membership = requestedId
    ? await db.prepare(
        `SELECT m.role AS role, o.id AS id, o.name AS name, o.slug AS slug, o.sector AS sector
         FROM organization_members m JOIN organizations o ON o.id = m.organization_id
         WHERE m.user_id = ? AND m.organization_id = ?`,
      ).bind(user.id, requestedId).first<{ role: string; id: string; name: string; slug: string | null; sector: string | null }>()
    : await db.prepare(
        `SELECT m.role AS role, o.id AS id, o.name AS name, o.slug AS slug, o.sector AS sector
         FROM organization_members m JOIN organizations o ON o.id = m.organization_id
         WHERE m.user_id = ? ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 WHEN 'manager' THEN 2 ELSE 3 END, m.created_at
         LIMIT 1`,
      ).bind(user.id).first<{ role: string; id: string; name: string; slug: string | null; sector: string | null }>();

  if (!membership) {
    throw new Error(requestedId ? "Bu çalışma alanına erişim yetkiniz yok." : "Bağlı bir çalışma alanı bulunamadı.");
  }

  return {
    organization: {
      id: membership.id,
      name: membership.name,
      slug: membership.slug,
      sector: membership.sector,
      role: membership.role,
    },
    role: membership.role,
  };
}
