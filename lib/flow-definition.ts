// T4: Akış motoru — iş türü, aşamalar, geçişler ve aşama başına zorunlu alanlar VERİ olarak tanımlanır.
// Teknik servis akışı artık bu tanımdan okunur (lib/service.ts geçişleri, lib/service-ui.ts "sıradaki adım").
// Yeni bir iş türü (ör. bakım sözleşmesi, montaj) aynı biçimde tanımlanabilir; motor değişmez.

export type StepHint =
  | { kind: "stage"; label: string; stage: string; hint: string; needsNote?: boolean }
  | { kind: "share"; label: string; purpose: "quote" | "completion"; hint: string }
  | { kind: "info"; hint: string };

export type RequiredField = { field: "outcome" | "quote_cents" | "scheduled_date" | "assigned_user_id"; message: string };

export type FlowStage = {
  key: string;
  label: string;
  next: string[];
  /** Bu aşamaya geçmek için dolu olması gereken alanlar. */
  required?: RequiredField[];
  /** Saha çalışanı (yönetici olmayan) bu aşamadan hangi aşamalara geçebilir. */
  staffNext?: string[];
  step: { manage: StepHint; staff: StepHint };
  closed?: boolean;
};
export type FlowDefinition = { key: string; label: string; version: number; stages: FlowStage[] };

export const TECHNICAL_SERVICE_FLOW: FlowDefinition = {
  key: "teknik-servis",
  label: "Teknik servis",
  version: 1,
  stages: [
    { key: "requested", label: "Talep", next: ["quoted", "cancelled"],
      step: { manage: { kind: "info", hint: "Teklif tutarını girin ve durumu “Teklif bekliyor” yapıp kaydedin." }, staff: { kind: "info", hint: "Yönetici teklif hazırlıyor. Onaylanınca işe başlayabilirsiniz." } } },
    { key: "quoted", label: "Teklif bekliyor", next: ["requested", "cancelled"],
      step: { manage: { kind: "share", label: "Teklifi müşteriye gönder", purpose: "quote", hint: "Müşteri bağlantıyı açıp teklifi onaylar; isterse imzalar." }, staff: { kind: "info", hint: "Teklif müşteri onayında." } } },
    { key: "quote_approved", label: "Teklif onaylandı", next: ["in_progress", "cancelled"], staffNext: ["in_progress", "completed"],
      step: { manage: { kind: "stage", label: "İşe başla", stage: "in_progress", hint: "Teklif onaylandı. Sahaya çıktığınızda işi başlatın." }, staff: { kind: "stage", label: "İşe başla", stage: "in_progress", hint: "Teklif onaylandı. Sahaya çıktığınızda işi başlatın." } } },
    { key: "in_progress", label: "Sahada", next: ["completed", "cancelled"], staffNext: ["in_progress", "completed"],
      step: { manage: { kind: "stage", label: "İşi tamamla", stage: "completed", needsNote: true, hint: "Yapılan işlemi yazın ve saha formlarını doldurun, sonra işi tamamlayın." }, staff: { kind: "stage", label: "İşi tamamla", stage: "completed", needsNote: true, hint: "Yapılan işlemi yazın ve saha formlarını doldurun, sonra işi tamamlayın." } } },
    { key: "completed", label: "Tamamlandı", next: ["in_progress"], required: [{ field: "outcome", message: "Yapılan işlemi yazın." }],
      step: { manage: { kind: "share", label: "İş raporunu müşteriye gönder", purpose: "completion", hint: "Müşteri raporu onaylayınca iş kapanır ve fatura taslağı açılır." }, staff: { kind: "share", label: "Müşteriden yerinde onay al", purpose: "completion", hint: "Müşteri bağlantıyı kendi cihazında açıp raporu inceleyebilir ve imzalayabilir. Bağlantı 1 saat geçerlidir." } } },
    { key: "accepted", label: "Müşteri onayladı", next: ["collected"],
      step: { manage: { kind: "info", hint: "Müşteri onayladı. Tahsil edilen tutarı girip durumu “Tahsil edildi” yapın." }, staff: { kind: "info", hint: "İş müşteri tarafından onaylandı." } } },
    { key: "collected", label: "Tahsil edildi", next: [], closed: true,
      step: { manage: { kind: "info", hint: "İş tamamlandı ve tahsil edildi." }, staff: { kind: "info", hint: "İş tamamlandı ve tahsil edildi." } } },
    { key: "cancelled", label: "İptal", next: [], closed: true,
      step: { manage: { kind: "info", hint: "İş iptal edildi." }, staff: { kind: "info", hint: "İş iptal edildi." } } },
  ],
};

/** Tanım tutarlı mı? Boş liste = geçerli. */
export function validateFlowDefinition(def: FlowDefinition): string[] {
  const errors: string[] = [];
  const keys = def.stages.map((s) => s.key);
  if (!def.stages.length) errors.push("En az bir aşama gerekli.");
  if (new Set(keys).size !== keys.length) errors.push("Aşama anahtarları tekil olmalı.");
  for (const s of def.stages) {
    for (const n of [...s.next, ...(s.staffNext ?? [])]) if (!keys.includes(n)) errors.push(`${s.key} → ${n}: tanımsız aşama.`);
    if (s.step.manage.kind === "stage" && !s.next.includes(s.step.manage.stage)) errors.push(`${s.key}: önerilen adım geçişlerde yok.`);
  }
  if (!def.stages.some((s) => s.closed)) errors.push("En az bir kapanış aşaması gerekli.");
  // İlk aşamadan bütün aşamalara ulaşılabilmeli (müşteri onayıyla gelen aşamalar hariç tutulmaz: onları dış olay doldurur).
  return errors;
}

export function stageOf(def: FlowDefinition, key: string) { return def.stages.find((s) => s.key === key); }
export function transitionsOf(def: FlowDefinition): Record<string, string[]> { return Object.fromEntries(def.stages.map((s) => [s.key, [...s.next]])); }
export function closedStages(def: FlowDefinition) { return def.stages.filter((s) => s.closed).map((s) => s.key); }

export function canTransition(def: FlowDefinition, from: string, to: string, manage: boolean): boolean {
  const s = stageOf(def, from);
  if (!s) return false;
  if (!manage) return Boolean(s.staffNext?.includes(to));
  return from === to || s.next.includes(to);
}

/** Hedef aşamanın zorunlu alanlarından eksik olanların mesajları. */
export function missingRequired(def: FlowDefinition, to: string, values: Partial<Record<RequiredField["field"], unknown>>): string[] {
  return (stageOf(def, to)?.required ?? []).filter((r) => { const v = values[r.field]; return v === null || v === undefined || v === "" || v === 0; }).map((r) => r.message);
}

export function stepFor(def: FlowDefinition, stage: string, manage: boolean): StepHint {
  const s = stageOf(def, stage);
  return s ? (manage ? s.step.manage : s.step.staff) : { kind: "info", hint: "İş iptal edildi." };
}
