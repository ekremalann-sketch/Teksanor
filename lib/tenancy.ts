import { AccessDeniedError, requireModuleAccess, type ModuleId } from "./access";
import type { AppUser } from "./auth";
import { createId, ensureSchema, getDb } from "./db";
import { mfaEnrollmentEnforced, viewAsRequiresMfa } from "./mfa";

export type Organization = {
  id: string;
  name: string;
  slug: string;
  kind: "business" | "personal";
  plan: string;
  subscription_status: "trialing" | "active" | "past_due" | "canceled";
  trial_ends_at: string | null;
  membership_role: "owner" | "admin" | "member";
  /** Platform yöneticisi bu firmayı "firma gözünden", salt okunur açtı. */
  view_as?: boolean;
};

export const VIEW_AS_COOKIE = "tk_view_as";
function viewAsCookie(request: Request) {
  const match = (request.headers.get("cookie") ?? "").split(/;\s*/).find((part) => part.startsWith(`${VIEW_AS_COOKIE}=`));
  return match ? decodeURIComponent(match.slice(VIEW_AS_COOKIE.length + 1)) : null;
}

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
  const result = await database.prepare(`SELECT o.*, m.role AS membership_role
    FROM organization_members m JOIN organizations o ON o.id = m.organization_id
    WHERE m.user_id = ? AND m.active = 1 AND o.active = 1 ORDER BY o.name`)
    .bind(user.id).all<Organization>();
  return result.results;
}

export async function requireOrganization(request: Request, user: AppUser) {
  const organizations = await listOrganizations(user);
  const requested = requestedOrganizationId(request);
  let organization = requested ? organizations.find((item) => item.id === requested) : organizations[0];
  const viewAsRequested = !!requested && user.role === "admin" && viewAsCookie(request) === requested;
  // Platform yöneticisi üyesi olmadığı bir firmayı yalnız okuma amacıyla açabilir ("firma gözünden gör").
  // Değişiklik yapamaz; panel girişleri denetim kaydına yazılır.
  if (!organization && requested && viewAsRequested) {
    const target = await getDb().prepare("SELECT * FROM organizations WHERE id = ? AND active = 1").bind(requested).first<Omit<Organization, "membership_role">>();
    if (target) {
      if (!["GET", "HEAD"].includes(request.method)) throw new AccessDeniedError("Firma gözünden görünüm salt okunurdur; değişiklik yapılamaz.");
      // İsteğe bağlı mod kurulumu zorlamaz; required modunda erteleme bu erişimi açmaz.
      if (viewAsRequiresMfa(user)) throw new AccessDeniedError("Firma gözünden görünüm için önce iki aşamalı doğrulamayı etkinleştirin.");
      organization = { ...target, membership_role: "member", view_as: true };
    }
  }
  // Tarayıcıda kalmış eski/başka kullanıcıya ait firma kimliği kalıcı kilitlenmeye yol açmasın:
  // istenen firma üyelikler arasında yoksa (ve geçerli bir firma gözünden görünüm değilse) ilk üyeliğe düşülür.
  // Üye olunmayan firmaya asla erişim verilmez; yalnız kullanıcının kendi firmalarından biri seçilir.
  // Yazma isteklerinde düşülmez: değişiklik yanlışlıkla başka (kendi) firmanıza yazılmasın; istemci 403'te seçimi temizleyip yeniden yükler.
  if (!organization && requested && !viewAsRequested && ["GET", "HEAD"].includes(request.method)) organization = organizations[0];
  if (!organization) throw new AccessDeniedError("Bu çalışma alanına erişim yetkiniz yok.");
  // Parola oturumu yeterlidir; firma ve modül yetkileri aşağıda uygulanır.
  if (mfaEnrollmentEnforced(user, user.role === "admin" || ["owner", "admin"].includes(organization.membership_role))) {
    throw new AccessDeniedError("İki aşamalı doğrulamayı hesap güvenliği ekranında kurmalısınız.");
  }
  // Enforce server-side module permissions on every organization-scoped API.
  const segment = new URL(request.url).pathname.split("/")[2];
  const modules: Record<string, ModuleId> = {
    payments: "payments", expenses: "expenses", treasury: "treasury", projects: "projects",
    tasks: "tasks", "work-orders": "work-orders", assets: "assets", maintenance: "maintenance",
    "field-visits": "field-visits", procurement: "procurement", customers: "crm", employees: "hr",
    risks: "risks", automations: "automations", agents: "agents", uploads: "files", users: "users",
    organization: "company", service: "work-orders",
  };
  if (modules[segment]) await requireModuleAccess(user, organization, modules[segment],
    ["GET", "HEAD"].includes(request.method) ? "view" : "edit");
  if (segment === "notifications" && request.method === "POST" && !canManageOrganization(user, organization)) {
    throw new AccessDeniedError("Bildirim oluşturmak için firma yöneticisi yetkisi gerekir.");
  }
  return { organization, organizations };
}

export function canManageOrganization(user: AppUser, organization: Organization) {
  return organization.membership_role === "owner" || organization.membership_role === "admin";
}

function slugify(value: string) {
  return value.toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s").replace(/ö/g, "o").replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "calisma-alani";
}

export async function createOrganization(input: { name: string; kind: "business" | "personal"; ownerId: string }) {
  await ensureSchema();
  const database = getDb();
  const { org, statements } = organizationStatements(database, input);
  await database.batch(statements);
  return org;
}

/** Firma kuruluşunun ifadeleri; başka kayıtlarla aynı batch'te (tek işlem) çalıştırmak için. */
export function organizationStatements(database: ReturnType<typeof getDb>, input: { name: string; kind: "business" | "personal"; ownerId: string }) {
  const id = createId("org");
  const suffix = id.slice(-6).toLowerCase();
  const slug = `${slugify(input.name)}-${suffix}`;
  const trialEnds = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  return {
    org: { id, name: input.name.trim(), slug, kind: input.kind, trialEnds },
    statements: [
      database.prepare(`INSERT INTO organizations
      (id, name, slug, kind, plan, subscription_status, trial_ends_at, created_by)
      VALUES (?, ?, ?, ?, 'trial', 'trialing', ?, ?)`)
        .bind(id, input.name.trim(), slug, input.kind, trialEnds, input.ownerId),
      database.prepare("INSERT INTO organization_members (organization_id, user_id, role) VALUES (?, ?, 'owner')")
        .bind(id, input.ownerId),
      database.prepare(`INSERT INTO organization_period_summaries
      (id, organization_id, period, sort_order) VALUES (?, ?, 'Başlangıç dönemi', 1)`)
        .bind(createId("summary"), id),
    ],
  };
}
