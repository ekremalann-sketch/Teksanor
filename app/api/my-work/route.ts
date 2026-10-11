import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { requireOrganization } from "@/lib/tenancy";
import { getMemberAccess } from "@/lib/access";
import { getDb } from "@/lib/db";
import { ensureDepartmentTables } from "@/lib/department-store";
import { DEPARTMENTS, departmentRole, isOverdue, templateOf } from "@/lib/department-catalog";

// "İşlerim": kişiye ve sorumlu olduğu birime yönlendirilmiş açık işlerin kısa listesi.
//  - Bana atanmış servis işleri (saha)
//  - Sorumlusu olduğum birimlere gelen açık süreçler (birim kuyruğu)
//  - Benim açtığım taleplerin durumu
// Yalnız okuma; liste kısa tutulur (en fazla 12 satır), ekranın ortasını kaplamaz.
type Item = { kind: "service" | "unit" | "request"; title: string; detail: string; href: string; overdue: boolean };

const STAGE: Record<string, string> = {
  requested: "Talep alındı", quoted: "Teklif gönderildi", quote_approved: "Teklif onaylandı", in_progress: "Sahada", completed: "Rapor onayı bekliyor",
};

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
    const { organization } = await requireOrganization(request, user);
    const access = await getMemberAccess(user, organization);
    const db = getDb();
    const items: Item[] = [];
    const today = new Date().toISOString().slice(0, 10);

    if (access.viewModules.includes("work-orders")) {
      const jobs = (await db.prepare(`SELECT s.id, s.stage, w.title, w.customer_name, w.scheduled_date FROM service_jobs s
        JOIN work_orders w ON w.id = s.id AND w.organization_id = s.organization_id
        WHERE s.organization_id = ? AND s.assigned_user_id = ? AND s.stage IN ('requested','quoted','quote_approved','in_progress','completed')
        ORDER BY COALESCE(w.scheduled_date, '9999') ASC LIMIT 6`).bind(organization.id, user.id)
        .all<{ id: string; stage: string; title: string; customer_name: string | null; scheduled_date: string | null }>()).results;
      for (const job of jobs) items.push({
        kind: "service", title: job.title,
        detail: [STAGE[job.stage] ?? job.stage, job.customer_name, job.scheduled_date ? job.scheduled_date.slice(0, 10) : null].filter(Boolean).join(" · "),
        href: `/servis?job=${encodeURIComponent(job.id)}`, overdue: !!job.scheduled_date && job.scheduled_date.slice(0, 10) < today,
      });
    }

    if (access.viewModules.includes("departments")) {
      await ensureDepartmentTables();
      const managed = DEPARTMENTS.filter((d) => departmentRole(access.profile, access.department, d) === "manage");
      // Birim yöneticisi tüm firmayı yöneten roller değilse yalnız kendi birim kuyruğunu görür; firma sahibi her birimi görür ama liste kısa kalır.
      if (managed.length) {
        const slugs = managed.map((d) => d.slug);
        const rows = (await db.prepare(`SELECT id, department_slug, template_key, title, stage_key, status, due_date, stage_entered_at, requester_name
          FROM department_processes WHERE organization_id = ? AND status IN ('active','blocked') AND department_slug IN (${slugs.map(() => "?").join(",")})
          ORDER BY updated_at DESC LIMIT 20`).bind(organization.id, ...slugs)
          .all<{ id: string; department_slug: string; template_key: string; title: string; stage_key: string; status: string; due_date: string | null; stage_entered_at: string; requester_name: string | null }>()).results;
        const shaped = rows.map((row) => {
          const dep = managed.find((d) => d.slug === row.department_slug)!;
          const template = templateOf(dep, row.template_key);
          const stage = template?.stages.find((s) => s.key === row.stage_key)?.label ?? row.stage_key;
          return { row, dep, stage, overdue: isOverdue(row, template) };
        }).sort((a, b) => Number(b.overdue) - Number(a.overdue)).slice(0, 6);
        for (const { row, dep, stage, overdue } of shaped) items.push({
          kind: "unit", title: row.title,
          detail: [dep.short, row.status === "blocked" ? "Beklemede" : stage, row.requester_name ? `Talep: ${row.requester_name}` : null].filter(Boolean).join(" · "),
          href: `/birimler?birim=${encodeURIComponent(dep.slug)}&surec=${encodeURIComponent(row.id)}`, overdue,
        });
      }
      const mine = (await db.prepare(`SELECT id, department_slug, template_key, title, stage_key FROM department_processes
        WHERE organization_id = ? AND requester_id = ? AND status IN ('active','blocked') ORDER BY updated_at DESC LIMIT 4`).bind(organization.id, user.id)
        .all<{ id: string; department_slug: string; template_key: string; title: string; stage_key: string }>()).results;
      for (const row of mine) {
        if (items.some((item) => item.href.includes(encodeURIComponent(row.id)))) continue;
        const dep = DEPARTMENTS.find((d) => d.slug === row.department_slug);
        const stage = dep ? templateOf(dep, row.template_key)?.stages.find((s) => s.key === row.stage_key)?.label : null;
        items.push({ kind: "request", title: row.title, detail: [dep?.short ?? row.department_slug, stage ?? row.stage_key].join(" · "), href: `/birimler?birim=${encodeURIComponent(row.department_slug)}&surec=${encodeURIComponent(row.id)}`, overdue: false });
      }
    }

    return NextResponse.json({ items: items.slice(0, 12), overdue: items.filter((item) => item.overdue).length }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "İş listesi alınamadı." }, { status: 403 });
  }
}
