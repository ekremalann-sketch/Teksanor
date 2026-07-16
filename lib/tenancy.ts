import type { AppUser } from "./auth";
import { createId, ensureSchema, getDb } from "./db";

export type Organization = {
  id: string;
  name: string;
  slug: string;
  kind: "business" | "personal";
  plan: string;
  subscription_status: "trialing" | "active" | "past_due" | "canceled";
  trial_ends_at: string | null;
  membership_role: "owner" | "admin" | "member";
};

function requestedOrganizationId(request: Request) {
  const header = request.headers.get("x-organization-id")?.trim();
  if (header) return header;
  try {
    return new URL(request.url).searchParams.get("organizationId")?.trim() || null;
  } catch {
    return null;
  }
}

export async function listOrganizations(user: AppUser): Promise<Organization[]> {
  await ensureSchema();
  const database = getDb();
  if (user.role === "admin") {
    const result = await database.prepare(`SELECT o.*, 'owner' AS membership_role FROM organizations o
      WHERE o.active = 1 ORDER BY o.name`).all<Organization>();
    return result.results;
  }
  const result = await database.prepare(`SELECT o.*, m.role AS membership_role
    FROM organization_members m JOIN organizations o ON o.id = m.organization_id
    WHERE m.user_id = ? AND m.active = 1 AND o.active = 1 ORDER BY o.name`)
    .bind(user.id).all<Organization>();
  return result.results;
}

export async function requireOrganization(request: Request, user: AppUser) {
  const organizations = await listOrganizations(user);
  const requested = requestedOrganizationId(request);
  const organization = requested ? organizations.find((item) => item.id === requested) : organizations[0];
  if (!organization) throw new Error("Bu çalışma alanına erişim yetkiniz yok.");
  return { organization, organizations };
}

export function canManageOrganization(user: AppUser, organization: Organization) {
  return user.role === "admin" || organization.membership_role === "owner" || organization.membership_role === "admin";
}

function slugify(value: string) {
  return value.toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s").replace(/ö/g, "o").replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "calisma-alani";
}

export async function createOrganization(input: { name: string; kind: "business" | "personal"; ownerId: string }) {
  await ensureSchema();
  const database = getDb();
  const id = createId("org");
  const suffix = id.slice(-6).toLowerCase();
  const slug = `${slugify(input.name)}-${suffix}`;
  const trialEnds = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  await database.batch([
    database.prepare(`INSERT INTO organizations
      (id, name, slug, kind, plan, subscription_status, trial_ends_at, created_by)
      VALUES (?, ?, ?, ?, 'trial', 'trialing', ?, ?)`)
      .bind(id, input.name.trim(), slug, input.kind, trialEnds, input.ownerId),
    database.prepare("INSERT INTO organization_members (organization_id, user_id, role) VALUES (?, ?, 'owner')")
      .bind(id, input.ownerId),
    database.prepare(`INSERT INTO organization_period_summaries
      (id, organization_id, period, sort_order) VALUES (?, ?, 'Başlangıç dönemi', 1)`)
      .bind(createId("summary"), id),
  ]);
  return { id, name: input.name.trim(), slug, kind: input.kind, trialEnds };
}
