// T5: Akış düzenleyici. Firma teknik servis akışını kendi işine göre değiştirir:
//  - aşama adlarını değiştirir,
//  - "Parça bekliyor" gibi kendi aşamalarını onaylı teklif ile tamamlama arasına ekler,
//  - aşama başına zorunlu alan seçer.
// Sistem aşamaları (teklif onayı, müşteri onayı, tahsilat) para ve onay kurallarına bağlı olduğu için silinmez.
import { TECHNICAL_SERVICE_FLOW, validateFlowDefinition, type FlowDefinition, type FlowStage, type RequiredField } from "./flow-definition";
import type { Database } from "./db";

export const serviceFlowSchema = `CREATE TABLE IF NOT EXISTS service_flows (
 organization_id TEXT NOT NULL, flow_key TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, custom_json TEXT NOT NULL DEFAULT '{}',
 updated_by TEXT, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (organization_id, flow_key))`;

export const serviceStageApprovalSchema = `CREATE TABLE IF NOT EXISTS service_stage_approvals (
 organization_id TEXT NOT NULL, job_id TEXT NOT NULL, stage TEXT NOT NULL, job_version INTEGER NOT NULL, approved_by TEXT NOT NULL,
 approved_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (job_id, stage, job_version))`;

export const EDITABLE_AFTER = ["quote_approved", "in_progress"] as const;
export const REQUIRED_FIELDS: Record<RequiredField["field"], string> = { outcome: "Yapılan işlem notu", quote_cents: "Teklif tutarı", scheduled_date: "Planlanan tarih", assigned_user_id: "Sorumlu kişi" };

export type ExtraStage = { key: string; label: string; after: (typeof EDITABLE_AFTER)[number]; required?: RequiredField["field"][]; approval?: { by: "manager" | "user"; userId?: string; notCreator: boolean } };
export type FlowCustom = { labels?: Record<string, string>; extra?: ExtraStage[]; required?: Record<string, RequiredField["field"][]> };

const cleanLabel = (v: unknown) => String(v ?? "").replace(/[<>]/g, "").trim().slice(0, 40);
const reqMsg = (f: RequiredField["field"]) => `${REQUIRED_FIELDS[f]} gerekli.`;

/** Ekran ve istemciden gelen özelleştirmeyi temizler; geçersizse hata listesi döner. */
export function sanitizeCustom(raw: unknown): { ok: true; value: FlowCustom } | { ok: false; errors: string[] } {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const errors: string[] = [];
  const labels: Record<string, string> = {};
  for (const [k, v] of Object.entries((r.labels as Record<string, unknown>) ?? {})) {
    const l = cleanLabel(v);
    if (l.length >= 2) labels[k] = l;
  }
  const extra: ExtraStage[] = [];
  const keys = new Set(TECHNICAL_SERVICE_FLOW.stages.map((s) => s.key));
  for (const e of Array.isArray(r.extra) ? r.extra.slice(0, 10) : []) {
    const x = e as Record<string, unknown>;
    const key = String(x.key ?? "");
    const label = cleanLabel(x.label);
    const after = String(x.after ?? "") as ExtraStage["after"];
    if (!/^ozel_[a-z0-9_]{2,30}$/.test(key) || keys.has(key)) { errors.push("Aşama anahtarı geçersiz veya tekrar ediyor."); continue; }
    if (label.length < 2) { errors.push("Aşama adı en az 2 harf olmalı."); continue; }
    if (!EDITABLE_AFTER.includes(after)) { errors.push(`${label}: yalnız "Teklif onaylandı" veya "Sahada" aşamasından sonra eklenebilir.`); continue; }
    keys.add(key);
    const ap = x.approval as Record<string, unknown> | undefined;
    const approval = ap && (ap.by === "manager" || ap.by === "user") ? { by: ap.by as "manager" | "user", userId: ap.by === "user" ? String(ap.userId ?? "").slice(0, 80) : undefined, notCreator: ap.notCreator !== false } : undefined;
    if (approval?.by === "user" && !approval.userId) { errors.push(`${label}: onaylayacak kişiyi seçin.`); continue; }
    extra.push({ key, label, after, approval, required: (Array.isArray(x.required) ? x.required : []).filter((f): f is RequiredField["field"] => typeof f === "string" && f in REQUIRED_FIELDS) });
  }
  const required: Record<string, RequiredField["field"][]> = {};
  for (const [k, v] of Object.entries((r.required as Record<string, unknown>) ?? {})) {
    if (!keys.has(k) || !Array.isArray(v)) continue;
    required[k] = v.filter((f): f is RequiredField["field"] => typeof f === "string" && f in REQUIRED_FIELDS);
  }
  if (errors.length) return { ok: false, errors };
  const value = { labels, extra, required };
  const check = validateFlowDefinition(buildFlow(value));
  return check.length ? { ok: false, errors: check } : { ok: true, value };
}

/** Temel teknik servis akışı + firmanın özelleştirmesi = firmanın akışı. */
export function buildFlow(custom: FlowCustom | null | undefined): FlowDefinition {
  const base = TECHNICAL_SERVICE_FLOW;
  if (!custom) return base;
  const stages: FlowStage[] = base.stages.map((s) => ({ ...s, next: [...s.next], staffNext: s.staffNext ? [...s.staffNext] : undefined, required: [...(s.required ?? [])] }));
  const byKey = (k: string) => stages.find((s) => s.key === k);
  for (const e of custom.extra ?? []) {
    const after = byKey(e.after);
    if (!after) continue;
    const forward = after.next.find((n) => n !== "cancelled") ?? "completed";
    const target = byKey(forward);
    const label = custom.labels?.[forward] ?? target?.label ?? forward;
    const stage: FlowStage = {
      key: e.key, label: e.label, next: [forward, "cancelled"], staffNext: [forward, e.key],
      required: (e.required ?? []).map((f) => ({ field: f, message: reqMsg(f) })),
      approval: e.approval,
      step: e.approval ? {
        manage: { kind: "approve", label: "Onayla", stage: forward, hint: `"${e.label}": bu iş onay bekliyor. Onaylanınca "${label}" aşamasına geçebilir.${e.approval.notCreator ? " İşi açan kişi onaylayamaz." : ""}` },
        staff: { kind: "approve", label: "Onayla", stage: forward, hint: `"${e.label}": bu iş onay bekliyor.` },
      } : {
        manage: { kind: "stage", label: `${label} aşamasına geç`, stage: forward, hint: `İş "${e.label}" aşamasında. Hazır olunca devam edin.`, needsNote: forward === "completed" },
        staff: { kind: "stage", label: `${label} aşamasına geç`, stage: forward, hint: `İş "${e.label}" aşamasında. Hazır olunca devam edin.`, needsNote: forward === "completed" },
      },
    };
    after.next = [e.key, ...after.next];
    if (after.staffNext) after.staffNext = [...new Set([...after.staffNext, e.key])];
    stages.splice(stages.indexOf(after) + 1, 0, stage);
  }
  for (const [k, l] of Object.entries(custom.labels ?? {})) { const s = byKey(k); if (s) s.label = l; }
  for (const [k, fields] of Object.entries(custom.required ?? {})) {
    const s = byKey(k); if (!s) continue;
    const have = new Set((s.required ?? []).map((r) => r.field));
    for (const f of fields) if (!have.has(f)) (s.required ??= []).push({ field: f, message: reqMsg(f) });
  }
  return { ...base, stages };
}

export async function loadFlowCustom(db: Database, organizationId: string): Promise<{ custom: FlowCustom; version: number }> {
  try {
    const row = await db.prepare("SELECT custom_json, version FROM service_flows WHERE organization_id=? AND flow_key='teknik-servis'").bind(organizationId).first<{ custom_json: string; version: number }>();
    if (!row) return { custom: {}, version: 0 };
    const parsed = sanitizeCustom(JSON.parse(row.custom_json));
    return { custom: parsed.ok ? parsed.value : {}, version: row.version };
  } catch { return { custom: {}, version: 0 }; }
}
export async function loadFlow(db: Database, organizationId: string): Promise<FlowDefinition> {
  return buildFlow((await loadFlowCustom(db, organizationId)).custom);
}

/** T12: bu aşamayı bu kullanıcı onaylayabilir mi? (açan kişi kuralı ayrıca veritabanında denetlenir) */
export function mayApprove(stage: FlowStage | undefined, userId: string, manage: boolean): boolean {
  if (!stage?.approval) return false;
  return stage.approval.by === "manager" ? manage : stage.approval.userId === userId;
}
