import { optionalCalendarDate } from "@/lib/dates";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { requireOrganization } from "@/lib/tenancy";
import { getMemberAccess, type MemberAccess } from "@/lib/access";
import { createId, getDb, type Database } from "@/lib/db";
import { ensureDepartmentTables } from "@/lib/department-store";
import { rejectCrossSiteMutation } from "@/lib/security";
import {
  DEPARTMENTS, WorkflowError, cleanData, departmentBySlug, departmentRole, departmentSchema, isOverdue,
  followUpsFor, missingForStage, triggeredBy, templateOf, type Department, type WorkflowTemplate,
} from "@/lib/department-catalog";

// Birim çalışma alanları API'si.
// GET                      → yetkili olunan birimlerin özet sayıları (yönetici kontrol kulesi)
// GET ?slug=ik             → birimin süreç türleri, açık/kapalı süreçleri, durum sayıları
// GET ?slug=ik&process=ID  → tek sürecin ayrıntısı ve olay geçmişi
// POST {action:create|advance|back|block|unblock|cancel|update, ...}
// Kurallar sunucuda uygulanır: aşama sırası, zorunlu alan, onay sahibi, talep edenin kendi
// talebini onaylayamaması (firma sahibi hariç), sürüm çakışması (409) ve firma ayrımı.

type Row = {
  id: string; department_slug: string; template_key: string; title: string; stage_key: string; status: string; priority: string;
  owner_name: string | null; requester_id: string; requester_name: string | null; due_date: string | null; data: string;
  outcome: string | null; blocked_reason: string | null; version: number; stage_entered_at: string; created_at: string; updated_at: string; closed_at: string | null;
};
const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
const PRIORITY = ["low", "normal", "high", "critical"];
const text = (v: unknown, max = 200) => String(v ?? "").trim().slice(0, max);

function shape(row: Row, dep: Department) {
  const template = templateOf(dep, row.template_key);
  const data = JSON.parse(row.data || "{}") as Record<string, string>;
  const stageIndex = template ? template.stages.findIndex((s) => s.key === row.stage_key) : -1;
  const stage = template?.stages[stageIndex];
  return {
    ...row, data,
    stage_label: stage?.label ?? row.stage_key, stage_index: stageIndex, stage_count: template?.stages.length ?? 0,
    awaiting_approval: !!stage?.approvers?.length && row.status === "active",
    overdue: isOverdue(row, template),
    missing: template && row.status === "active" ? missingForStage(template, row.stage_key, data) : [],
  };
}

export async function GET(request: Request) { return handle(request); }
export async function POST(request: Request) { const r = rejectCrossSiteMutation(request); return r || handle(request); }

async function handle(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: "Oturum gerekli." }, 401);
  let organization;
  try { ({ organization } = await requireOrganization(request, user)); } catch (e) { return json({ error: "Erişim reddedildi." }, 403); }
  try {
    await ensureDepartmentTables();
    const db = getDb();
    const access = await getMemberAccess(user, organization);
    if (request.method === "GET") return await read(request, db, access, organization.id, user.id, { id: organization.id, name: organization.name });
    return await write(request, db, access, organization.id, { id: user.id, name: user.full_name || user.username });
  } catch (error) {
    if (error instanceof WorkflowError) return json({ error: error.message }, error.status);
    if (error instanceof SyntaxError) return json({ error: "İstek biçimi geçersiz." }, 400);
    console.error("departments", error);
    return json({ error: "İşlem tamamlanamadı." }, 500);
  }
}

async function read(request: Request, db: Database, access: MemberAccess, orgId: string, userId: string, org: { id: string; name: string }) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug");
  if (url.searchParams.get("view") === "network") return json(network());
  if (url.searchParams.get("view") === "report") return json(await report(db, access, orgId));
  if (!slug) {
    const visible = DEPARTMENTS.map((d) => ({ d, role: departmentRole(access.profile, access.department, d) })).filter((x) => x.role !== "none");
    const rows = (await db.prepare("SELECT * FROM department_processes WHERE organization_id = ? AND (status IN ('active','blocked') OR closed_at >= datetime('now','-30 days'))").bind(orgId).all<Row>()).results;
    const departments = visible.map(({ d, role }) => {
      const mine = rows.filter((r) => r.department_slug === d.slug && (role === "manage" || r.requester_id === userId));
      const open = mine.filter((r) => r.status === "active" || r.status === "blocked").map((r) => shape(r, d));
      return {
        slug: d.slug, name: d.name, short: d.short, mission: d.mission, role,
        templates: d.templates.length,
        open: open.length, blocked: open.filter((p) => p.status === "blocked").length,
        overdue: open.filter((p) => p.overdue).length, awaiting: open.filter((p) => p.awaiting_approval).length,
        closed30: mine.filter((r) => r.status === "done").length,
        attention: open.filter((p) => p.overdue || p.status === "blocked").slice(0, 3).map((p) => ({ id: p.id, title: p.title, stage: p.stage_label, overdue: p.overdue, blocked: p.status === "blocked" })),
      };
    });
    return json({ departments, profile: access.profile, label: access.label, organization: org });
  }
  const dep = departmentBySlug(slug);
  if (!dep) throw new WorkflowError("Birim bulunamadı.", 404);
  const role = departmentRole(access.profile, access.department, dep);
  if (role === "none") throw new WorkflowError("Bu birim için görev yetkiniz bulunmuyor.", 403);
  const processId = url.searchParams.get("process");
  if (processId) {
    const row = await db.prepare("SELECT * FROM department_processes WHERE id = ? AND organization_id = ? AND department_slug = ?").bind(processId, orgId, dep.slug).first<Row>();
    if (!row || (role !== "manage" && row.requester_id !== userId)) throw new WorkflowError("Süreç bulunamadı.", 404);
    const events = (await db.prepare("SELECT action, from_stage, to_stage, actor_name, note, created_at FROM department_process_events WHERE process_id = ? AND organization_id = ? ORDER BY created_at, rowid").bind(row.id, orgId).all()).results;
    return json({ process: shape(row, dep), events });
  }
  const showClosed = url.searchParams.get("closed") === "1";
  const rows = (await db.prepare(`SELECT * FROM department_processes WHERE organization_id = ? AND department_slug = ?
    ${role === "manage" ? "" : "AND requester_id = ?"} ${showClosed ? "" : "AND status IN ('active','blocked')"}
    ORDER BY CASE priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END, stage_entered_at LIMIT 500`)
    .bind(...(role === "manage" ? [orgId, dep.slug] : [orgId, dep.slug, userId])).all<Row>()).results;
  const processes = rows.map((r) => shape(r, dep));
  const templates = dep.templates.filter((t) => role === "manage" || t.selfService).map((t) => ({
    ...t,
    next: (t.next ?? []).map((n) => ({ ...n, department: departmentBySlug(n.slug)?.short ?? n.slug, label: templateOf(departmentBySlug(n.slug)!, n.template)?.label ?? n.template })),
    from: triggeredBy(dep.slug, t.key).map((f) => ({ ...f, department: departmentBySlug(f.slug)?.short ?? f.slug })),
  }));
  return json({
    department: { slug: dep.slug, name: dep.name, short: dep.short, mission: dep.mission, modules: dep.modules },
    role, profile: access.profile, organization: org, templates, processes,
    stats: { open: processes.filter((p) => p.status === "active" || p.status === "blocked").length, overdue: processes.filter((p) => p.overdue).length, blocked: processes.filter((p) => p.status === "blocked").length, awaiting: processes.filter((p) => p.awaiting_approval).length },
  });
}

// Performans raporu (son 180 gün): süreç türü başına ortalama tamamlanma süresi, aşama başına ortalama bekleme,
// hedef süreye (SLA) uyum, en çok bekleten aşamalar ve şu an geciken süreçler. Yalnız yönetilen birimler.
async function report(db: Database, access: MemberAccess, orgId: string) {
  const managed = DEPARTMENTS.filter((d) => departmentRole(access.profile, access.department, d) === "manage");
  if (!managed.length) throw new WorkflowError("Performans raporu birim sorumlularına açıktır.", 403);
  const slugs = managed.map((d) => d.slug);
  const procs = (await db.prepare(`SELECT * FROM department_processes WHERE organization_id = ? AND department_slug IN (${slugs.map(() => "?").join(", ")}) AND created_at >= datetime('now','-180 days') LIMIT 3000`).bind(orgId, ...slugs).all<Row>()).results;
  const events = procs.length ? (await db.prepare(`SELECT process_id, action, from_stage, to_stage, created_at FROM department_process_events WHERE organization_id = ? AND created_at >= datetime('now','-181 days') ORDER BY created_at, rowid LIMIT 20000`).bind(orgId).all<{ process_id: string; action: string; from_stage: string | null; to_stage: string | null; created_at: string }>()).results : [];
  const ms = (t: string) => new Date(t.replace(" ", "T") + (t.includes("Z") ? "" : "Z")).getTime();
  const DAY = 86_400_000;
  const byProc = new Map<string, typeof events>();
  for (const e of events) (byProc.get(e.process_id) ?? byProc.set(e.process_id, []).get(e.process_id)!).push(e);
  const templates = new Map<string, { slug: string; department: string; key: string; label: string; started: number; done: number; cancelled: number; days: number[]; open: number; overdue: number }>();
  const stages = new Map<string, { slug: string; department: string; template: string; stage: string; label: string; slaDays: number | null; waits: number[]; onTime: number }>();
  const now = Date.now();
  for (const p of procs) {
    const dep = managed.find((d) => d.slug === p.department_slug)!; const t = templateOf(dep, p.template_key);
    if (!t) continue;
    const key = `${dep.slug}/${t.key}`;
    const row = templates.get(key) ?? { slug: dep.slug, department: dep.short, key: t.key, label: t.label, started: 0, done: 0, cancelled: 0, days: [], open: 0, overdue: 0 };
    row.started++;
    if (p.status === "done") { row.done++; if (p.closed_at) row.days.push((ms(p.closed_at) - ms(p.created_at)) / DAY); }
    else if (p.status === "cancelled") row.cancelled++;
    else { row.open++; if (isOverdue(p, t)) row.overdue++; }
    templates.set(key, row);
    // Aşama beklemeleri: bir aşamaya giriş olayından o aşamadan çıkışa kadar geçen süre.
    const evs = byProc.get(p.id) ?? [];
    for (let i = 0; i < evs.length; i++) {
      const entered = evs[i].to_stage; if (!entered || evs[i].action === "update" || evs[i].action === "block" || evs[i].action === "unblock") continue;
      const exit = evs.slice(i + 1).find((e) => e.from_stage === entered && !["update", "block", "unblock"].includes(e.action));
      if (!exit) continue;
      const st = t.stages.find((x) => x.key === entered); if (!st) continue;
      const sk = `${key}/${st.key}`;
      const srow = stages.get(sk) ?? { slug: dep.slug, department: dep.short, template: t.label, stage: st.key, label: st.label, slaDays: st.slaDays ?? null, waits: [], onTime: 0 };
      const wait = (ms(exit.created_at) - ms(evs[i].created_at)) / DAY;
      srow.waits.push(wait); if (st.slaDays && wait <= st.slaDays) srow.onTime++;
      stages.set(sk, srow);
    }
  }
  const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);
  const stageRows = [...stages.values()].map((r) => ({ department: r.department, slug: r.slug, template: r.template, stage: r.label, slaDays: r.slaDays, samples: r.waits.length, avgDays: avg(r.waits), onTimeRate: r.slaDays && r.waits.length ? Math.round((r.onTime / r.waits.length) * 100) : null }))
    .sort((a, b) => (b.avgDays ?? 0) - (a.avgDays ?? 0));
  const templateRows = [...templates.values()].map((r) => ({ department: r.department, slug: r.slug, key: r.key, label: r.label, started: r.started, done: r.done, cancelled: r.cancelled, open: r.open, overdue: r.overdue, avgDays: avg(r.days), targetDays: (() => { const t = templateOf(managed.find((d) => d.slug === r.slug)!, r.key); return t ? t.stages.reduce((a, s) => a + (s.slaDays ?? 0), 0) || null : null; })() }))
    .sort((a, b) => b.overdue - a.overdue || b.started - a.started);
  const slaSamples = stageRows.filter((r) => r.slaDays);
  const onTime = [...stages.values()].reduce((a, r) => a + (r.slaDays ? r.onTime : 0), 0), total = [...stages.values()].reduce((a, r) => a + (r.slaDays ? r.waits.length : 0), 0);
  const deptRows = managed.map((d) => {
    const rows = templateRows.filter((r) => r.slug === d.slug);
    return { slug: d.slug, department: d.short, started: rows.reduce((a, r) => a + r.started, 0), done: rows.reduce((a, r) => a + r.done, 0), open: rows.reduce((a, r) => a + r.open, 0), overdue: rows.reduce((a, r) => a + r.overdue, 0) };
  }).filter((r) => r.started).sort((a, b) => b.overdue - a.overdue || b.open - a.open);
  return {
    generatedAt: new Date(now).toISOString(), periodDays: 180,
    totals: { started: procs.length, done: procs.filter((p) => p.status === "done").length, open: procs.filter((p) => p.status === "active" || p.status === "blocked").length, overdue: templateRows.reduce((a, r) => a + r.overdue, 0), onTimeRate: total ? Math.round((onTime / total) * 100) : null, stageSamples: slaSamples.reduce((a, r) => a + r.samples, 0) },
    departments: deptRows, templates: templateRows, bottlenecks: stageRows.slice(0, 15),
  };
}

// Süreç ağı: tüm birimler, süreç türleri ve aralarındaki bağlantılar (veritabanı okumaz).
function network() {
  const nodes = DEPARTMENTS.map((d) => ({ slug: d.slug, short: d.short, name: d.name, templates: d.templates.length }));
  const links: { from: string; fromLabel: string; to: string; toTemplate: string; toLabel: string; fromTemplate: string; when?: string[] }[] = [];
  for (const d of DEPARTMENTS) for (const t of d.templates) for (const n of t.next ?? []) {
    links.push({ from: d.slug, fromTemplate: t.key, fromLabel: t.label, to: n.slug, toTemplate: n.template, toLabel: templateOf(departmentBySlug(n.slug)!, n.template)?.label ?? n.template, when: n.when });
  }
  return { nodes, links, templateCount: nodes.reduce((a, n) => a + n.templates, 0) };
}

type Stmt = ReturnType<Database["prepare"]>;
// Olay kaydı. Süreç üzerindeki her değişiklik, "süreç + okunan sürüm" kimlikli tek bir olay yazar: aynı sürüm üzerinde
// iki istek yarışırsa ikincisinin olay kimliği çakışır ve batch'in tamamı geri alınır (yarım veya mükerrer kayıt kalmaz).
function eventStmt(db: Database, orgId: string, processId: string, action: string, actor: { id: string; name: string }, from: string | null, to: string | null, note: string | null, id = createId("dpe")) {
  return db.prepare("INSERT INTO department_process_events (id, organization_id, process_id, action, from_stage, to_stage, actor_id, actor_name, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(id, orgId, processId, action, from, to, actor.id, actor.name, note);
}
function auditStmt(db: Database, userId: string, action: string, entityId: string, details: string, orgId: string) {
  return db.prepare("INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details, organization_id) VALUES (?, ?, ?, 'department_process', ?, ?, ?)")
    .bind(createId("audit"), userId, action, entityId, details, orgId);
}
async function commit(db: Database, statements: Stmt[]) {
  try { await db.batch(statements); }
  catch (error) {
    if (/UNIQUE|constraint/i.test(`${String(error)} ${String((error as { cause?: unknown })?.cause ?? "")}`)) throw new WorkflowError("Bu süreç başka biri tarafından değiştirildi. Sayfayı yenileyin.", 409);
    throw error;
  }
}

// Süreç ağı: kapanan süreç, tanımlı bağlantılara göre diğer birimlerde yeni süreç açar.
// Tek istekte en çok 2 sorgu (çok satırlı ekleme) çalışır; D1 sorgu ve parametre sınırlarının altında kalır.
function followUpStatements(db: Database, orgId: string, actor: { id: string; name: string }, dep: Department, template: WorkflowTemplate, row: Row, outcome: string, sourceData: Record<string, string>) {
  const list = followUpsFor(template, outcome).map((n) => {
    const d = departmentBySlug(n.slug); const t = d ? templateOf(d, n.template) : null;
    return d && t ? { d, t, id: createId("dproc") } : null;
  }).filter((x): x is { d: Department; t: WorkflowTemplate; id: string } => !!x).slice(0, 6);
  if (!list.length) return { statements: [] as Stmt[], started: [] as { id: string; slug: string; department: string; template: string; label: string }[] };
  // Kaynak süreçteki aynı anlamlı alanlar yeni sürece taşınır (ör. işe alımdaki aday → işe girişte çalışan),
  // böylece otomatik açılan süreç boş zorunlu alanlarla başlamaz.
  const procs = list.map((x) => [x.id, orgId, x.d.slug, x.t.key, `${x.t.label} · ${row.title}`.slice(0, 160), x.t.stages[0].key, row.priority || "normal", actor.id, actor.name, JSON.stringify(carryOver(sourceData, x.t))]);
  const note = `Otomatik başlatıldı: ${dep.short} · ${template.label} "${row.title}" (${outcome})`.slice(0, 300);
  const evs = list.map((x) => [createId("dpe"), orgId, x.id, "create", null, x.t.stages[0].key, actor.id, actor.name, note]);
  return {
    statements: [
      db.prepare(`INSERT INTO department_processes (id, organization_id, department_slug, template_key, title, stage_key, priority, requester_id, requester_name, data) VALUES ${procs.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ")}`).bind(...procs.flat()),
      db.prepare(`INSERT INTO department_process_events (id, organization_id, process_id, action, from_stage, to_stage, actor_id, actor_name, note) VALUES ${evs.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ")}`).bind(...evs.flat()),
    ],
    started: list.map((x) => ({ id: x.id, slug: x.d.slug, department: x.d.short, template: x.t.key, label: x.t.label })),
  };
}

// Alan eşleme: aynı anahtar doğrudan; bilinen eş anlamlılar (aday→çalışan, musteri→firma…) çevrilir.
const SYNONYMS: Record<string, string[]> = {
  calisan: ["aday", "calisan", "personel"], musteri: ["musteri", "firma", "karsi-taraf"], firma: ["firma", "musteri", "tedarikci"],
  "karsi-taraf": ["karsi-taraf", "musteri", "firma", "tedarikci"], tutar: ["tutar", "tahmini"], baslama: ["baslama"], proje: ["proje", "konu"],
  konu: ["konu", "baslik", "problem", "uygunsuzluk", "tespit"], urun: ["urun"], tedarikci: ["tedarikci", "firma", "secilen"],
};
function carryOver(source: Record<string, string>, target: WorkflowTemplate) {
  const out: Record<string, string> = {};
  for (const f of target.fields) {
    const keys = SYNONYMS[f.key] ?? [f.key];
    const hit = keys.map((k) => source[k]).find((v) => typeof v === "string" && v.trim());
    if (!hit) continue;
    if (f.type === "choice" && !(f.options ?? []).includes(hit)) continue;
    if (f.type === "number" && !/^-?\d+(\.\d+)?$/.test(hit)) continue;
    if (f.type === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(hit)) continue;
    out[f.key] = hit.slice(0, f.type === "textarea" ? 2000 : 300);
  }
  return out;
}

async function write(request: Request, db: Database, access: MemberAccess, orgId: string, actor: { id: string; name: string }) {
  const body = await request.json() as Record<string, unknown>;
  if (body.action === "demo.seed") return seedExamples(db, access, orgId, actor);
  const dep = departmentBySlug(text(body.slug, 40));
  if (!dep) throw new WorkflowError("Birim bulunamadı.", 404);
  const role = departmentRole(access.profile, access.department, dep);
  if (role === "none") throw new WorkflowError("Bu birim için görev yetkiniz bulunmuyor.", 403);
  const action = text(body.action, 20);

  if (action === "create") {
    const template = templateOf(dep, text(body.template, 40));
    if (!template) throw new WorkflowError("Süreç türü bulunamadı.", 404);
    if (role !== "manage" && !template.selfService) throw new WorkflowError("Bu süreci birim sorumlusu başlatır.", 403);
    const title = text(body.title, 160);
    if (title.length < 3) throw new WorkflowError("Süreç için kısa bir başlık yazın.");
    const data = cleanData(template, body.data);
    const missing = template.fields.filter((f) => f.required && !data[f.key]).map((f) => f.label);
    if (missing.length) throw new WorkflowError(`Zorunlu alanlar eksik: ${missing.join(", ")}.`);
    const due = optionalCalendarDate(body.dueDate);
    if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) throw new WorkflowError("Hedef tarih geçersiz.");
    const priority = PRIORITY.includes(text(body.priority)) ? text(body.priority) : "normal";
    const id = createId("dproc");
    await commit(db, [
      db.prepare(`INSERT INTO department_processes (id, organization_id, department_slug, template_key, title, stage_key, priority, owner_name, requester_id, requester_name, due_date, data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(id, orgId, dep.slug, template.key, title, template.stages[0].key, priority,
        role === "manage" ? text(body.ownerName, 120) || null : null, actor.id, actor.name, due, JSON.stringify(data)),
      eventStmt(db, orgId, id, "create", actor, null, template.stages[0].key, null, `${id}:v0`),
      auditStmt(db, actor.id, "create", id, `${dep.short}: ${template.label} başlatıldı (${title}).`, orgId),
    ]);
    return json({ ok: true, id }, 201);
  }

  const row = await db.prepare("SELECT * FROM department_processes WHERE id = ? AND organization_id = ? AND department_slug = ?").bind(text(body.id, 60), orgId, dep.slug).first<Row>();
  if (!row || (role !== "manage" && row.requester_id !== actor.id)) throw new WorkflowError("Süreç bulunamadı.", 404);
  const template = templateOf(dep, row.template_key) as WorkflowTemplate;
  if (Number(body.version) !== row.version) throw new WorkflowError("Bu süreç başka biri tarafından değiştirildi. Sayfayı yenileyin.", 409);
  if (row.status === "done" || row.status === "cancelled") throw new WorkflowError("Kapanmış süreç değiştirilemez.", 409);
  const note = text(body.note, 600) || null;
  const data = JSON.parse(row.data || "{}") as Record<string, string>;
  const index = template.stages.findIndex((s) => s.key === row.stage_key);
  const stage = template.stages[index];
  const isOwner = access.profile === "owner";
  // Tek işlem: koşullu güncelleme + sürüm kimlikli olay + (varsa) denetim izi ve takip süreçleri aynı batch'te.
  const save = (sets: string, values: unknown[]) => db.prepare(`UPDATE department_processes SET ${sets}, version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ? AND version = ?`)
    .bind(...values, row.id, orgId, row.version);
  const ev = (evAction: string, from: string | null, to: string | null, evNote: string | null) => eventStmt(db, orgId, row.id, evAction, actor, from, to, evNote, `${row.id}:v${row.version}`);

  if (action === "update") {
    // Talep eden, süreç ilk aşamadayken kendi bilgilerini düzeltebilir; birim sorumlusu her zaman.
    if (role !== "manage" && index > 0) throw new WorkflowError("Talep işleme alındı; değişiklik için birim sorumlusuna yazın.", 403);
    const next = cleanData(template, body.data, data);
    const priority = PRIORITY.includes(text(body.priority)) ? text(body.priority) : row.priority;
    const owner = role === "manage" && "ownerName" in body ? text(body.ownerName, 120) || null : row.owner_name;
    const due = "dueDate" in body ? optionalCalendarDate(body.dueDate) : row.due_date;
    if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) throw new WorkflowError("Hedef tarih geçersiz.");
    await commit(db, [save("data = ?, priority = ?, owner_name = ?, due_date = ?", [JSON.stringify(next), priority, owner, due]), ev("update", row.stage_key, row.stage_key, note)]);
    return json({ ok: true });
  }

  if (action === "cancel") {
    if (role !== "manage" && index > 0) throw new WorkflowError("İşleme alınmış talebi birim sorumlusu iptal eder.", 403);
    if (!note) throw new WorkflowError("İptal nedenini yazın.");
    await commit(db, [save("status = 'cancelled', closed_at = CURRENT_TIMESTAMP, outcome = ?", ["İptal edildi"]), ev("cancel", row.stage_key, null, note), auditStmt(db, actor.id, "cancel", row.id, `${dep.short}: ${row.title} iptal edildi.`, orgId)]);
    return json({ ok: true });
  }

  if (role !== "manage") throw new WorkflowError("Süreci yalnız birim sorumlusu ilerletir.", 403);

  if (action === "block" || action === "unblock") {
    if (action === "block") {
      if (row.status === "blocked") throw new WorkflowError("Süreç zaten beklemede.", 409);
      if (!note) throw new WorkflowError("Bekleme nedenini yazın (ör. belge bekleniyor).");
      await commit(db, [save("status = 'blocked', blocked_reason = ?", [note]), ev(action, row.stage_key, row.stage_key, note)]);
    } else {
      if (row.status !== "blocked") throw new WorkflowError("Süreç beklemede değil.", 409);
      await commit(db, [save("status = 'active', blocked_reason = NULL", []), ev(action, row.stage_key, row.stage_key, note)]);
    }
    return json({ ok: true });
  }

  if (action === "back") {
    if (index <= 0) throw new WorkflowError("Süreç zaten ilk aşamada.");
    if (!note) throw new WorkflowError("Geri gönderme nedenini yazın.");
    const prev = template.stages[index - 1];
    await commit(db, [save("stage_key = ?, status = 'active', blocked_reason = NULL, stage_entered_at = CURRENT_TIMESTAMP", [prev.key]), ev("back", row.stage_key, prev.key, note)]);
    return json({ ok: true });
  }

  if (action === "advance") {
    if (row.status === "blocked") throw new WorkflowError("Beklemedeki süreç ilerletilemez; önce beklemeyi kaldırın.", 409);
    const merged = body.data === undefined ? data : cleanData(template, body.data, data);
    const missing = missingForStage(template, stage.key, merged);
    if (missing.length) throw new WorkflowError(`Bu aşamayı geçmek için doldurun: ${missing.join(", ")}.`);
    if (stage.approvers?.length) {
      if (!stage.approvers.includes(access.profile)) {
        throw new WorkflowError(`"${stage.label}" adımını yalnız onay yetkilisi geçirebilir.`, 403);
      }
      // Görevler ayrılığı: çalışan talebinde (izin, ödeme, satın alma…) talep eden kendi talebini onaylayamaz.
      // Birimin kendi yürüttüğü süreçlerde (işe alım, DÖF…) onay sınırı yalnız onay profilleriyle çizilir.
      // Firma sahibi de kendi talebini onaylayamaz; yalnız firmada bu adımı onaylayabilecek başka kimse yoksa
      // (tek kişilik yönetim) geçebilir ve bu durum denetim izine ayrıca yazılır.
      if (template.selfService && row.requester_id === actor.id) {
        throw new WorkflowError("Kendi talebinizi onaylayamazsınız; başka bir yetkili onaylamalı.", 403);
      }
    }
    const last = index === template.stages.length - 1;
    if (last) {
      const outcome = text(body.outcome, 80);
      if (!template.outcomes.includes(outcome)) throw new WorkflowError("Süreci kapatmak için sonucu seçin.");
      const follow = followUpStatements(db, orgId, actor, dep, template, row, outcome, merged);
      await commit(db, [
        save("status = 'done', outcome = ?, data = ?, closed_at = CURRENT_TIMESTAMP", [outcome, JSON.stringify(merged)]),
        ev("done", stage.key, null, [outcome, note].filter(Boolean).join(" · ")),
        auditStmt(db, actor.id, "complete", row.id, `${dep.short}: ${row.title} kapandı (${outcome}).`, orgId),
        ...follow.statements,
      ]);
      return json({ ok: true, done: true, started: follow.started });
    }
    const next = template.stages[index + 1];
    await commit(db, [
      save("stage_key = ?, data = ?, stage_entered_at = CURRENT_TIMESTAMP", [next.key, JSON.stringify(merged)]),
      ev(stage.approvers?.length ? "approve" : "advance", stage.key, next.key, note),
      ...(stage.approvers?.length ? [auditStmt(db, actor.id, "approve", row.id, `${dep.short}: ${row.title} — ${stage.label} onaylandı.`, orgId)] : []),
    ]);
    return json({ ok: true, stage: next.key });
  }

  throw new WorkflowError("Bilinmeyen işlem.");
}

// Boş bir firmada birim ekranlarının nasıl çalıştığını görmek için örnek süreçler.
// Yalnız firma sahibi/yöneticisi, yalnız hiç süreç yokken; başlıklar "[Örnek]" ile başlar ve iptal edilerek temizlenebilir.
const EXAMPLES: { slug: string; template: string; title: string; data: Record<string, string>; steps: number }[] = [
  { slug: "ik", template: "ise-alim", title: "[Örnek] Saha teknisyeni alımı", data: { pozisyon: "Saha teknisyeni", birim: "Operasyon" }, steps: 2 },
  { slug: "ik", template: "izin", title: "[Örnek] Yıllık izin talebi", data: { tur: "Yıllık", baslangic: "2026-11-02", bitis: "2026-11-06" }, steps: 1 },
  { slug: "ik", template: "ise-giris", title: "[Örnek] Yeni çalışan oryantasyonu", data: { calisan: "Örnek Çalışan", baslama: "2026-11-02" }, steps: 0 },
  { slug: "arge", template: "fikir", title: "[Örnek] Arıza tahmini için sensör denemesi", data: { problem: "Plansız duruşlar", olcut: "Duruşlarda %20 azalma" }, steps: 2 },
  { slug: "arge", template: "destek", title: "[Örnek] Destek programı başvurusu", data: { program: "Ar-Ge destek çağrısı", "son-tarih": "2026-12-15" }, steps: 1 },
  { slug: "satin-alma", template: "talep", title: "[Örnek] Saha ekibi için tablet", data: { urun: "Tablet", miktar: "4" }, steps: 0 },
  { slug: "finans", template: "odeme-talebi", title: "[Örnek] Kira ödemesi", data: { alici: "Örnek Gayrimenkul", tutar: "45000", dayanak: "KİRA-ÖRNEK" }, steps: 1 },
  { slug: "kalite", template: "dof", title: "[Örnek] Geç teslim düzeltici faaliyeti", data: { uygunsuzluk: "Planlanan tarih kaçtı", kok: "Kapasite uyarısı izlenmiyordu" }, steps: 2 },
];
async function seedExamples(db: Database, access: MemberAccess, orgId: string, actor: { id: string; name: string }) {
  if (!["owner", "company_admin"].includes(access.profile)) throw new WorkflowError("Örnek süreçleri firma yöneticisi ekler.", 403);
  const existing = await db.prepare("SELECT COUNT(*) AS n FROM department_processes WHERE organization_id = ?").bind(orgId).first<{ n: number }>();
  if (Number(existing?.n ?? 0) > 0) throw new WorkflowError("Bu firmada süreç zaten var; örnekler yalnız boş firmaya eklenir.", 409);
  const statements: Stmt[] = [];
  for (const ex of EXAMPLES) {
    const dep = departmentBySlug(ex.slug)!; const t = templateOf(dep, ex.template)!;
    const stage = t.stages[Math.min(ex.steps, t.stages.length - 1)];
    const id = createId("dproc");
    statements.push(db.prepare(`INSERT INTO department_processes (id, organization_id, department_slug, template_key, title, stage_key, requester_id, requester_name, owner_name, data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(id, orgId, dep.slug, t.key, ex.title, stage.key, actor.id, actor.name, "Örnek sorumlu", JSON.stringify(cleanData(t, ex.data))));
    statements.push(eventStmt(db, orgId, id, "create", actor, null, stage.key, "Örnek süreç", `${id}:v0`));
  }
  // Çift tıklamaya karşı kilit: firma başına tek örnek ekleme kaydı.
  statements.unshift(db.prepare("INSERT INTO app_metadata (key, value) VALUES (?, 'done')").bind(`department_examples:${orgId}`));
  statements.push(db.prepare("INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details, organization_id) VALUES (?, ?, 'seed', 'department_process', NULL, ?, ?)").bind(createId("audit"), actor.id, `${EXAMPLES.length} örnek süreç eklendi.`, orgId));
  await commit(db, statements);
  return json({ ok: true, created: EXAMPLES.length }, 201);
}
