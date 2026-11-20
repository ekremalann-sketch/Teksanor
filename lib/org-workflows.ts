import { requestSafeInitializer } from "./request-safe-initializer";
// Firma iş tanımları: her firma kendi birimlerini ve kendi süreç türlerini (aşamalar, onaylayan roller,
// süre hedefleri, zorunlu alanlar, ret davranışı, kapanınca başka birimde açılacak süreçler) tanımlar.
// Hazır katalog (lib/department-catalog.ts) olduğu gibi kalır; firmanın tanımları onun üzerine eklenir.
// Sunucu her işlemde birleştirilmiş kataloğu kullanır: kural arayüzden atlatılamaz.
import { accessRules, type AccessProfile } from "./access";
import type { Database } from "./db";
import { DEPARTMENTS, WorkflowError, type Department, type FieldType, type WorkflowField, type WorkflowStage, type WorkflowTemplate } from "./department-catalog";

export const REJECTED_OUTCOME = "Reddedildi";
export const FIELD_TYPES: FieldType[] = ["text", "textarea", "date", "number", "choice"];
export const PROFILES = Object.keys(accessRules) as AccessProfile[];
export const PROFILE_LABELS: Record<string, string> = Object.fromEntries(Object.entries(accessRules).map(([k, v]) => [k, v.label]));

export type OrgDepartment = { slug: string; name: string; short: string; mission: string; owners: AccessProfile[] };
export type StoredTemplate = { departmentSlug: string; key: string; active: boolean; version: number; definition: WorkflowTemplate; updatedAt: string | null; updatedBy: string | null };

const clean = (v: unknown, max: number) => String(v ?? "").replace(/[<>\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const slugify = (v: string) => v.toLocaleLowerCase("tr-TR").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30);

/** Birim tanımını doğrular. Firma birimleri "f-" önekiyle hazır birimlerden ayrılır. */
export function sanitizeDepartment(raw: unknown, existing: string[]): OrgDepartment {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const name = clean(r.name, 60);
  if (name.length < 2) throw new WorkflowError("Birim adı en az 2 harf olmalı.");
  const short = clean(r.short, 24) || name.slice(0, 24);
  const mission = clean(r.mission, 240);
  let slug = typeof r.slug === "string" && r.slug.startsWith("f-") ? r.slug.slice(0, 32) : `f-${slugify(name)}`;
  if (!/^f-[a-z0-9-]{2,30}$/.test(slug)) throw new WorkflowError("Birim adı Latin harf veya rakam içermeli.");
  if (DEPARTMENTS.some((d) => d.slug === slug || d.name.toLocaleLowerCase("tr-TR") === name.toLocaleLowerCase("tr-TR"))) throw new WorkflowError("Bu ad hazır birimlerden biriyle aynı; o birime süreç ekleyin.");
  if (typeof r.slug !== "string" && existing.includes(slug)) slug = `${slug.slice(0, 27)}-${Math.random().toString(36).slice(2, 4)}`;
  const owners = (Array.isArray(r.owners) ? r.owners : []).filter((p): p is AccessProfile => typeof p === "string" && PROFILES.includes(p as AccessProfile) && !["owner", "company_admin", "ceo"].includes(p)).slice(0, 6);
  return { slug, name, short, mission, owners };
}

/** Süreç türü tanımını doğrular. Hatalı tanım kaydedilmez; hata mesajı hangi alanın düzeltileceğini söyler. */
export function sanitizeTemplate(raw: unknown, departmentSlug: string, catalog: Department[], existingKey?: string): WorkflowTemplate {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const label = clean(r.label, 60);
  if (label.length < 3) throw new WorkflowError("Süreç adı en az 3 harf olmalı.");
  const key = existingKey ?? `f-${slugify(String(r.key || label))}`;
  if (!/^f-[a-z0-9-]{2,30}$/.test(key)) throw new WorkflowError("Süreç adı Latin harf veya rakam içermeli.");
  const summary = clean(r.summary, 240) || label;

  const fields: WorkflowField[] = [];
  for (const f of (Array.isArray(r.fields) ? r.fields : []).slice(0, 20)) {
    const x = (f ?? {}) as Record<string, unknown>;
    const flabel = clean(x.label, 40);
    if (flabel.length < 2) throw new WorkflowError("Her alanın en az 2 harflik adı olmalı.");
    const type = FIELD_TYPES.includes(x.type as FieldType) ? (x.type as FieldType) : "text";
    const fkey = typeof x.key === "string" && /^[a-z0-9-]{2,30}$/.test(x.key) ? x.key : slugify(flabel);
    if (!fkey || fields.some((y) => y.key === fkey)) throw new WorkflowError(`"${flabel}" alanı tekrar ediyor.`);
    const options = type === "choice" ? (Array.isArray(x.options) ? x.options : String(x.options ?? "").split(",")).map((o) => clean(o, 40)).filter(Boolean).slice(0, 12) : undefined;
    if (type === "choice" && (!options || options.length < 2)) throw new WorkflowError(`"${flabel}" seçim alanı için en az 2 seçenek yazın.`);
    fields.push({ key: fkey, label: flabel, type, required: x.required === true, ...(options ? { options } : {}), ...(clean(x.hint, 120) ? { hint: clean(x.hint, 120) } : {}) });
  }

  const rawStages = Array.isArray(r.stages) ? r.stages.slice(0, 15) : [];
  if (rawStages.length < 2) throw new WorkflowError("En az 2 aşama tanımlayın (ör. Talep → Onay).");
  const stages: (WorkflowStage & { rejectTo?: string })[] = [];
  for (const s of rawStages) {
    const x = (s ?? {}) as Record<string, unknown>;
    const slabel = clean(x.label, 40);
    if (slabel.length < 2) throw new WorkflowError("Her aşamanın en az 2 harflik adı olmalı.");
    let skey = typeof x.key === "string" && /^[a-z0-9-]{2,30}$/.test(x.key) ? x.key : slugify(slabel);
    if (stages.some((y) => y.key === skey)) skey = `${skey.slice(0, 26)}-${stages.length + 1}`;
    const approvers = (Array.isArray(x.approvers) ? x.approvers : []).filter((p): p is AccessProfile => typeof p === "string" && PROFILES.includes(p as AccessProfile));
    const sla = Number(x.slaDays);
    const requires = (Array.isArray(x.requires) ? x.requires : []).filter((k): k is string => typeof k === "string" && fields.some((f) => f.key === k));
    stages.push({ key: skey, label: slabel, todo: clean(x.todo, 200) || slabel, ...(approvers.length ? { approvers: [...new Set(approvers)] } : {}),
      ...(Number.isFinite(sla) && sla > 0 ? { slaDays: Math.min(365, Math.round(sla)) } : {}), ...(requires.length ? { requires } : {}),
      ...(typeof x.rejectTo === "string" && x.rejectTo ? { rejectTo: x.rejectTo } : {}) });
  }
  for (const [i, s] of stages.entries()) {
    if (!s.rejectTo) continue;
    const target = stages.findIndex((y) => y.key === s.rejectTo);
    if (!s.approvers?.length) throw new WorkflowError(`"${s.label}": ret davranışı yalnız onay aşamasında tanımlanır.`);
    if (target < 0 || target >= i) throw new WorkflowError(`"${s.label}": reddedilince yalnız önceki bir aşamaya geri gönderilebilir.`);
  }

  const outcomes = [...new Set((Array.isArray(r.outcomes) ? r.outcomes : String(r.outcomes ?? "").split(",")).map((o) => clean(o, 40)).filter(Boolean))].slice(0, 8);
  if (!outcomes.length) throw new WorkflowError("En az bir sonuç yazın (ör. Tamamlandı).");

  const next: NonNullable<WorkflowTemplate["next"]> = [];
  for (const n of (Array.isArray(r.next) ? r.next : []).slice(0, 6)) {
    const x = (n ?? {}) as Record<string, unknown>;
    const slug = String(x.slug ?? ""), template = String(x.template ?? "");
    const dep = catalog.find((d) => d.slug === slug);
    if (!dep || !dep.templates.some((t) => t.key === template)) throw new WorkflowError("Kapanınca başlatılacak süreç bulunamadı.");
    if (slug === departmentSlug && template === key) throw new WorkflowError("Süreç kendini otomatik başlatamaz.");
    const when = (Array.isArray(x.when) ? x.when : []).filter((w): w is string => typeof w === "string" && (outcomes.includes(w) || w === REJECTED_OUTCOME));
    next.push({ slug, template, ...(when.length ? { when } : {}) });
  }
  return { key, label, summary, selfService: r.selfService === true, fields, stages, outcomes, ...(clean(r.note, 300) ? { note: clean(r.note, 300) } : {}), ...(next.length ? { next } : {}) };
}

/** Firmanın birleşik kataloğu: hazır birimler + firma birimleri; her birime firmanın süreç türleri eklenir. */
export type Catalog = {
  departments: Department[];
  bySlug: (slug: string) => Department | null;
  triggeredBy: (slug: string, key: string) => { slug: string; template: string; label: string; when?: string[] }[];
  /** Yeni süreç açılabilecek (pasif olmayan) şablonlar. */
  isActive: (slug: string, key: string) => boolean;
  custom: { departments: OrgDepartment[]; templates: StoredTemplate[] };
};

const ensureOrgWorkflowSchema = requestSafeInitializer(async (db: Database) => {
  await db.prepare("-- Firma iş tanımları: firmanın kendi birimleri ve süreç türleri. Hazır katalog değişmez; yalnız yeni tablolar.\nCREATE TABLE IF NOT EXISTS `organization_departments` (\n\t`organization_id` text NOT NULL,\n\t`slug` text NOT NULL,\n\t`name` text NOT NULL,\n\t`short` text NOT NULL,\n\t`mission` text DEFAULT '' NOT NULL,\n\t`owners` text DEFAULT '[]' NOT NULL,\n\t`created_by` text NOT NULL,\n\t`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,\n\t`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,\n\tPRIMARY KEY(`organization_id`, `slug`)\n);").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS `organization_workflow_templates` (\n\t`organization_id` text NOT NULL,\n\t`department_slug` text NOT NULL,\n\t`template_key` text NOT NULL,\n\t`definition` text NOT NULL,\n\t`active` integer DEFAULT 1 NOT NULL,\n\t`version` integer DEFAULT 1 NOT NULL,\n\t`updated_by` text,\n\t`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,\n\tPRIMARY KEY(`organization_id`, `department_slug`, `template_key`)\n);").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS `idx_org_wf_templates_org` ON `organization_workflow_templates` (`organization_id`, `active`);").run();
});

export async function loadOrgDefinitions(db: Database, orgId: string) {
  await ensureOrgWorkflowSchema(db);
  // Migrasyon uygulanmadan önce de çalışsın: tablo yoksa yalnız hazır katalog kullanılır.
  try {
    const deps = (await db.prepare("SELECT slug, name, short, mission, owners FROM organization_departments WHERE organization_id = ? ORDER BY name LIMIT 60").bind(orgId).all<{ slug: string; name: string; short: string; mission: string; owners: string }>()).results;
    const tpls = (await db.prepare("SELECT department_slug, template_key, definition, active, version, updated_at, updated_by FROM organization_workflow_templates WHERE organization_id = ? ORDER BY updated_at LIMIT 300").bind(orgId).all<{ department_slug: string; template_key: string; definition: string; active: number; version: number; updated_at: string | null; updated_by: string | null }>()).results;
    return {
      departments: deps.map((d) => ({ slug: d.slug, name: d.name, short: d.short, mission: d.mission, owners: safeJson<AccessProfile[]>(d.owners, []) })),
      templates: tpls.map((t) => ({ departmentSlug: t.department_slug, key: t.template_key, active: Boolean(t.active), version: t.version, updatedAt: t.updated_at, updatedBy: t.updated_by, definition: safeJson<WorkflowTemplate | null>(t.definition, null) }))
        .filter((t): t is StoredTemplate => !!t.definition),
    };
  } catch (error) {
    if (/no such table/i.test(String(error))) return { departments: [], templates: [] };
    throw error;
  }
}

function safeJson<T>(v: string, fallback: T): T { try { return JSON.parse(v) as T; } catch { return fallback; } }

export function buildCatalog(custom: { departments: OrgDepartment[]; templates: StoredTemplate[] }): Catalog {
  const departments: Department[] = [
    ...DEPARTMENTS.map((d) => ({ ...d, templates: [...d.templates] })),
    ...custom.departments.map((d) => ({ slug: d.slug, name: d.name, short: d.short, mission: d.mission || `${d.name} biriminin süreçleri.`, owners: d.owners, modules: [], templates: [] as WorkflowTemplate[] })),
  ];
  const inactive = new Set<string>();
  for (const t of custom.templates) {
    const dep = departments.find((d) => d.slug === t.departmentSlug);
    if (!dep || dep.templates.some((x) => x.key === t.key)) continue;
    dep.templates.push(t.definition);
    if (!t.active) inactive.add(`${t.departmentSlug}/${t.key}`);
  }
  const bySlug = (slug: string) => departments.find((d) => d.slug === slug) ?? null;
  return {
    departments, bySlug, custom,
    isActive: (slug, key) => !inactive.has(`${slug}/${key}`),
    triggeredBy: (slug, key) => {
      const out: { slug: string; template: string; label: string; when?: string[] }[] = [];
      for (const d of departments) for (const t of d.templates) for (const n of t.next ?? []) if (n.slug === slug && n.template === key) out.push({ slug: d.slug, template: t.key, label: t.label, when: n.when });
      return out;
    },
  };
}

export async function catalogFor(db: Database, orgId: string) { return buildCatalog(await loadOrgDefinitions(db, orgId)); }

/** Ret: tanımlıysa önceki aşamaya geri gönderir; değilse süreç "Reddedildi" sonucuyla kapanır. */
export function rejectionTarget(template: WorkflowTemplate, stageKey: string) {
  const stage = template.stages.find((s) => s.key === stageKey) as (WorkflowStage & { rejectTo?: string }) | undefined;
  const to = stage?.rejectTo ? template.stages.find((s) => s.key === stage.rejectTo) : null;
  return to ? { kind: "back" as const, stage: to } : { kind: "close" as const };
}
/** Retle kapanan süreçte yalnız açıkça "Reddedildi" sonucuna bağlanmış takip süreçleri açılır. */
export function rejectionFollowUps(template: WorkflowTemplate) { return (template.next ?? []).filter((n) => n.when?.includes(REJECTED_OUTCOME)); }

export function canDesign(profile: AccessProfile) { return profile === "owner" || profile === "company_admin"; }
