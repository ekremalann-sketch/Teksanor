import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { requireOrganization } from "@/lib/tenancy";
import { getMemberAccess } from "@/lib/access";
import { auditStatement, getDb } from "@/lib/db";
import { rejectCrossSiteMutation } from "@/lib/security";
import { WorkflowError } from "@/lib/department-catalog";
import { canDesign, catalogFor, FIELD_TYPES, PROFILE_LABELS, PROFILES, REJECTED_OUTCOME, sanitizeDepartment, sanitizeTemplate } from "@/lib/org-workflows";

// Firma iş tanımları API'si (yalnız firma sahibi / firma yöneticisi değiştirir; birim sorumluları görüntüler).
// GET                                        → birleşik katalog, firma birimleri ve süreç türleri, roller
// POST {action:"department.save", department}            → firma birimi ekle/güncelle
// POST {action:"department.delete", slug}                 → süreci olmayan firma birimini sil
// POST {action:"template.save", slug, template, key?, version?} → süreç türü ekle/güncelle (sürüm kontrollü)
// POST {action:"template.toggle", slug, key, active, version}   → süreç türünü yeni kayıtlara aç/kapat
const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });

export async function GET(request: Request) { return handle(request); }
export async function POST(request: Request) { const r = rejectCrossSiteMutation(request); return r || handle(request); }

async function handle(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: "Oturum gerekli." }, 401);
  let organization;
  try { ({ organization } = await requireOrganization(request, user)); } catch { return json({ error: "Erişim reddedildi." }, 403); }
  try {
    const db = getDb();
    const access = await getMemberAccess(user, organization);
    const designer = canDesign(access.profile) && access.editModules.length > 0;
    if (!designer && !["ceo", "manager"].includes(access.profile)) throw new WorkflowError("İş tanımlarını firma yöneticisi düzenler.", 403);
    const catalog = await catalogFor(db, organization.id);
    if (request.method === "GET") {
      return json({
        canEdit: designer,
        profiles: PROFILES.map((p) => ({ key: p, label: PROFILE_LABELS[p] })), fieldTypes: FIELD_TYPES, rejectedOutcome: REJECTED_OUTCOME,
        departments: catalog.departments.map((d) => ({ slug: d.slug, name: d.name, short: d.short, mission: d.mission, owners: d.owners, custom: d.slug.startsWith("f-"),
          templates: d.templates.map((t) => {
            const stored = catalog.custom.templates.find((x) => x.departmentSlug === d.slug && x.key === t.key);
            return { ...t, custom: !!stored, active: stored ? stored.active : true, version: stored?.version ?? null, updatedAt: stored?.updatedAt ?? null };
          }) })),
      });
    }
    if (!designer) throw new WorkflowError("İş tanımlarını yalnız firma sahibi veya firma yöneticisi değiştirir.", 403);
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action ?? "");
    const orgId = organization.id;

    if (action === "department.save") {
      const existing = catalog.custom.departments.map((d) => d.slug);
      const dep = sanitizeDepartment(body.department, existing);
      if (typeof (body.department as Record<string, unknown>)?.slug === "string" && !existing.includes(dep.slug)) throw new WorkflowError("Birim bulunamadı.", 404);
      if (!existing.includes(dep.slug) && existing.length >= 40) throw new WorkflowError("En fazla 40 firma birimi tanımlanabilir.");
      if (catalog.custom.departments.some((d) => d.slug !== dep.slug && d.name.toLocaleLowerCase("tr-TR") === dep.name.toLocaleLowerCase("tr-TR"))) throw new WorkflowError("Bu adla bir birim zaten var.", 409);
      await db.batch([
        db.prepare(`INSERT INTO organization_departments (organization_id, slug, name, short, mission, owners, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(organization_id, slug) DO UPDATE SET name = excluded.name, short = excluded.short, mission = excluded.mission, owners = excluded.owners, updated_at = CURRENT_TIMESTAMP`)
          .bind(orgId, dep.slug, dep.name, dep.short, dep.mission, JSON.stringify(dep.owners), user.id),
        auditStatement(user.id, "save", "organization_department", dep.slug, `Birim tanımı kaydedildi: ${dep.name}`, orgId),
      ]);
      return json({ ok: true, slug: dep.slug }, existing.includes(dep.slug) ? 200 : 201);
    }

    if (action === "department.delete") {
      const slug = String(body.slug ?? "").slice(0, 40);
      if (!catalog.custom.departments.some((d) => d.slug === slug)) throw new WorkflowError("Birim bulunamadı.", 404);
      const used = await db.prepare("SELECT COUNT(*) AS n FROM department_processes WHERE organization_id = ? AND department_slug = ?").bind(orgId, slug).first<{ n: number }>();
      if (Number(used?.n ?? 0) > 0) throw new WorkflowError("Bu birimde süreç kaydı var; silinemez. Süreç türlerini kapatabilirsiniz.", 409);
      await db.batch([
        db.prepare("DELETE FROM organization_workflow_templates WHERE organization_id = ? AND department_slug = ?").bind(orgId, slug),
        db.prepare("DELETE FROM organization_departments WHERE organization_id = ? AND slug = ?").bind(orgId, slug),
        auditStatement(user.id, "delete", "organization_department", slug, "Kullanılmayan firma birimi silindi.", orgId),
      ]);
      return json({ ok: true });
    }

    if (action === "template.save") {
      const slug = String(body.slug ?? "").slice(0, 40);
      const dep = catalog.bySlug(slug);
      if (!dep) throw new WorkflowError("Birim bulunamadı.", 404);
      const key = typeof body.key === "string" && body.key ? body.key.slice(0, 40) : undefined;
      const stored = key ? catalog.custom.templates.find((t) => t.departmentSlug === slug && t.key === key) : undefined;
      if (key && !stored) throw new WorkflowError("Hazır süreç türleri değiştirilemez; kopyalayıp yeni süreç türü olarak kaydedin.", 403);
      const template = sanitizeTemplate(body.template, slug, catalog.departments, key);
      if (!key && dep.templates.some((t) => t.key === template.key)) throw new WorkflowError("Bu birimde aynı adla bir süreç türü var.", 409);
      if (!key && catalog.custom.templates.length >= 120) throw new WorkflowError("En fazla 120 firma süreç türü tanımlanabilir.");
      if (stored) {
        // Açık süreçlerin bulunduğu aşamalar silinemez: kayıt "bilinmeyen aşamada" kalmaz.
        const open = (await db.prepare("SELECT DISTINCT stage_key FROM department_processes WHERE organization_id = ? AND department_slug = ? AND template_key = ? AND status IN ('active','blocked')").bind(orgId, slug, key).all<{ stage_key: string }>()).results;
        const missing = open.filter((o) => !template.stages.some((s) => s.key === o.stage_key));
        if (missing.length) throw new WorkflowError(`Açık süreçlerin bulunduğu aşama silinemez: ${missing.map((m) => stored.definition.stages.find((s) => s.key === m.stage_key)?.label ?? m.stage_key).join(", ")}.`, 409);
        if (Number(body.version) !== stored.version) throw new WorkflowError("Tanım başka biri tarafından değiştirildi. Sayfayı yenileyin.", 409);
        const res = await db.prepare("UPDATE organization_workflow_templates SET definition = ?, version = version + 1, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE organization_id = ? AND department_slug = ? AND template_key = ? AND version = ?")
          .bind(JSON.stringify(template), user.id, orgId, slug, key, stored.version).run();
        if (!res.meta?.changes) throw new WorkflowError("Tanım başka biri tarafından değiştirildi. Sayfayı yenileyin.", 409);
        await db.batch([auditStatement(user.id, "update", "organization_workflow", `${slug}/${key}`, `Süreç türü güncellendi: ${template.label}`, orgId)]);
        return json({ ok: true, key: template.key });
      }
      await db.batch([
        db.prepare("INSERT INTO organization_workflow_templates (organization_id, department_slug, template_key, definition, updated_by) VALUES (?, ?, ?, ?, ?)").bind(orgId, slug, template.key, JSON.stringify(template), user.id),
        auditStatement(user.id, "create", "organization_workflow", `${slug}/${template.key}`, `Süreç türü eklendi: ${template.label}`, orgId),
      ]);
      return json({ ok: true, key: template.key }, 201);
    }

    if (action === "template.toggle") {
      const slug = String(body.slug ?? "").slice(0, 40), key = String(body.key ?? "").slice(0, 40);
      const stored = catalog.custom.templates.find((t) => t.departmentSlug === slug && t.key === key);
      if (!stored) throw new WorkflowError("Süreç türü bulunamadı.", 404);
      const res = await db.prepare("UPDATE organization_workflow_templates SET active = ?, version = version + 1, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE organization_id = ? AND department_slug = ? AND template_key = ? AND version = ?")
        .bind(body.active === true ? 1 : 0, user.id, orgId, slug, key, Number(body.version)).run();
      if (!res.meta?.changes) throw new WorkflowError("Tanım başka biri tarafından değiştirildi. Sayfayı yenileyin.", 409);
      await db.batch([auditStatement(user.id, body.active === true ? "enable" : "disable", "organization_workflow", `${slug}/${key}`, `Süreç türü ${body.active === true ? "açıldı" : "kapatıldı"}.`, orgId)]);
      return json({ ok: true });
    }
    throw new WorkflowError("Bilinmeyen işlem.");
  } catch (error) {
    if (error instanceof WorkflowError) return json({ error: error.message }, error.status);
    if (error instanceof SyntaxError) return json({ error: "İstek biçimi geçersiz." }, 400);
    console.error("organization-workflows", error);
    return json({ error: "İşlem tamamlanamadı." }, 500);
  }
}
