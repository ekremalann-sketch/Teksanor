"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  AlertOctagon, ArrowRight, Bot, Check, CheckSquare, Clock, Loader2, MapPin, MessageCircle,
  Phone, Plus, Search, Send, ShoppingCart, Trash2, Users2, Wrench, X, Zap,
} from "lucide-react";

/* ---------------------------------------------------------------- types ---- */
export type Task = { id: string; title: string; description?: string | null; department: string; assignee_name?: string | null; status: "open" | "in_progress" | "done" | "cancelled"; priority: "low" | "normal" | "high" | "critical"; due_date?: string | null; completed_at?: string | null; created_at: string };
export type WorkOrder = { id: string; order_number: string; title: string; description?: string | null; customer_name?: string | null; location?: string | null; department: string; order_type: "maintenance" | "repair" | "installation" | "inspection" | "other"; status: "open" | "assigned" | "in_progress" | "completed" | "cancelled"; priority: "low" | "normal" | "high" | "critical"; assigned_to?: string | null; scheduled_date?: string | null; completed_date?: string | null; estimated_hours?: number; notes?: string | null; created_at: string };
export type FieldVisit = { id: string; visit_number: string; visitor_name: string; customer_name?: string | null; location: string; visit_date: string; visit_type: "inspection" | "installation" | "maintenance" | "support" | "audit" | "other"; status: "planned" | "completed" | "cancelled"; duration_hours?: number; findings?: string | null; actions_taken?: string | null; next_visit_date?: string | null; created_at: string };
export type ProcurementRequest = { id: string; request_number: string; title: string; description?: string | null; department: string; requested_by?: string | null; supplier_name?: string | null; quantity: number; unit?: string; unit_price: number; total_price: number; currency: string; status: "draft" | "pending" | "approved" | "ordered" | "delivered" | "cancelled"; priority: "low" | "normal" | "high" | "critical"; required_date?: string | null; order_date?: string | null; delivery_date?: string | null; notes?: string | null; created_at: string };
export type Customer = { id: string; name: string; company_name?: string | null; email?: string | null; phone?: string | null; address?: string | null; sector?: string | null; status: "lead" | "prospect" | "active" | "inactive"; total_value: number; notes?: string | null; created_at: string };
export type CustomerInteraction = { id: string; customer_id: string; interaction_type: "call" | "email" | "meeting" | "visit" | "proposal" | "other"; summary: string; outcome?: string | null; interaction_date: string; next_action?: string | null; next_action_date?: string | null; created_at: string };
export type Employee = { id: string; full_name: string; title?: string | null; department: string; email?: string | null; phone?: string | null; start_date?: string | null; status: "active" | "on_leave" | "inactive"; employment_type: "full_time" | "part_time" | "contractor" | "intern"; notes?: string | null; created_at: string };
export type Risk = { id: string; title: string; description?: string | null; department: string; category: "financial" | "operational" | "legal" | "technical" | "hr" | "other"; likelihood: "low" | "medium" | "high"; impact: "low" | "medium" | "high" | "critical"; status: "identified" | "mitigating" | "resolved" | "accepted"; owner_name?: string | null; mitigation_plan?: string | null; review_date?: string | null; created_at: string };
export type AutomationRule = { id: string; name: string; description?: string | null; trigger_type: "schedule" | "threshold" | "status_change" | "manual"; action_type: "notify" | "create_task" | "create_report" | "flag_record"; is_active: number; last_run_at?: string | null; run_count: number; created_at: string };
export type AgentChat = { id: string; agent_name: string; role: "user" | "assistant"; content: string; created_at: string };

/* -------------------------------------------------------------- helpers ---- */
const money = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 });
const fmtMoney = (v: number) => money.format(Number(v || 0));
const fmtDate = (v?: string | null) => v ? new Date(v).toLocaleDateString("tr-TR") : "—";

const departmentNames = [
  "Yönetim ve strateji", "Finans ve hazine", "Muhasebe ve vergi koordinasyonu", "Proje ve mühendislik",
  "Operasyon yönetimi", "Satın alma ve tedarik", "Satış ve iş geliştirme", "Müşteri deneyimi ve destek",
  "İnsan ve organizasyon", "Bilgi teknolojileri ve güvenlik", "Hukuk ve uyum", "Kalite ve risk yönetimi", "Ar-Ge ve inovasyon",
];

async function api(url: string, organizationId: string, method: string, payload?: unknown) {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", "X-Organization-Id": organizationId },
    body: payload !== undefined ? JSON.stringify(payload) : undefined,
  });
  const result = await response.json().catch(() => ({})) as { error?: string; [k: string]: unknown };
  if (!response.ok) throw new Error(result.error || "İşlem tamamlanamadı.");
  return result;
}

const badge = (bg: string, fg: string): React.CSSProperties => ({ background: bg, color: fg, padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", display: "inline-block" });
const priorityColor: Record<string, [string, string, string]> = {
  low: ["#eef2f7", "#5b6b7f", "Düşük"], normal: ["#e7f0ff", "#2563eb", "Normal"], high: ["#fff2e0", "#c2670a", "Yüksek"], critical: ["#fde8e8", "#c0392b", "Kritik"],
};
function PriorityBadge({ value }: { value: string }) { const [bg, fg, label] = priorityColor[value] ?? priorityColor.normal; return <span style={badge(bg, fg)}>{label}</span>; }
function StatusBadge({ map, value }: { map: Record<string, [string, string, string]>; value: string }) { const [bg, fg, label] = map[value] ?? ["#eef2f7", "#5b6b7f", value]; return <span style={badge(bg, fg)}>{label}</span>; }

const taskStatus: Record<string, [string, string, string]> = { open: ["#eef2f7", "#5b6b7f", "Açık"], in_progress: ["#fff2e0", "#c2670a", "Sürüyor"], done: ["#e4f5ec", "#1a8c53", "Tamamlandı"], cancelled: ["#fde8e8", "#c0392b", "İptal"] };
const woStatus: Record<string, [string, string, string]> = { open: ["#eef2f7", "#5b6b7f", "Açık"], assigned: ["#e7f0ff", "#2563eb", "Atandı"], in_progress: ["#fff2e0", "#c2670a", "Sürüyor"], completed: ["#e4f5ec", "#1a8c53", "Tamamlandı"], cancelled: ["#fde8e8", "#c0392b", "İptal"] };
const visitStatus: Record<string, [string, string, string]> = { planned: ["#e7f0ff", "#2563eb", "Planlandı"], completed: ["#e4f5ec", "#1a8c53", "Tamamlandı"], cancelled: ["#fde8e8", "#c0392b", "İptal"] };
const procStatus: Record<string, [string, string, string]> = { draft: ["#eef2f7", "#5b6b7f", "Taslak"], pending: ["#fdf3d6", "#a9820a", "Onay bekliyor"], approved: ["#e7f0ff", "#2563eb", "Onaylandı"], ordered: ["#efe6fb", "#7c3aed", "Sipariş verildi"], delivered: ["#e4f5ec", "#1a8c53", "Teslim alındı"], cancelled: ["#fde8e8", "#c0392b", "İptal"] };
const custStatus: Record<string, [string, string, string]> = { lead: ["#eef2f7", "#5b6b7f", "Aday"], prospect: ["#e7f0ff", "#2563eb", "Görüşülüyor"], active: ["#e4f5ec", "#1a8c53", "Aktif müşteri"], inactive: ["#fde8e8", "#c0392b", "Pasif"] };
const empStatus: Record<string, [string, string, string]> = { active: ["#e4f5ec", "#1a8c53", "Aktif"], on_leave: ["#fff2e0", "#c2670a", "İzinde"], inactive: ["#eef2f7", "#5b6b7f", "Ayrıldı"] };
const riskStatus: Record<string, [string, string, string]> = { identified: ["#fdf3d6", "#a9820a", "Belirlendi"], mitigating: ["#e7f0ff", "#2563eb", "Önlem alınıyor"], resolved: ["#e4f5ec", "#1a8c53", "Çözüldü"], accepted: ["#eef2f7", "#5b6b7f", "Kabul edildi"] };

const orderTypeLabel: Record<string, string> = { maintenance: "Bakım", repair: "Onarım", installation: "Kurulum", inspection: "Kontrol", other: "Diğer" };
const visitTypeLabel: Record<string, string> = { inspection: "Kontrol", installation: "Kurulum", maintenance: "Bakım", support: "Destek", audit: "Denetim", other: "Diğer" };
const interactionLabel: Record<string, string> = { call: "Telefon", email: "E-posta", meeting: "Toplantı", visit: "Ziyaret", proposal: "Teklif", other: "Diğer" };
const riskCategoryLabel: Record<string, string> = { financial: "Finansal", operational: "Operasyonel", legal: "Hukuki", technical: "Teknik", hr: "İnsan kaynakları", other: "Diğer" };
const empTypeLabel: Record<string, string> = { full_time: "Tam zamanlı", part_time: "Yarı zamanlı", contractor: "Sözleşmeli", intern: "Stajyer" };
const triggerLabel: Record<string, string> = { schedule: "Zamanlanmış", threshold: "Eşik değeri", status_change: "Durum değişimi", manual: "El ile" };
const actionLabel: Record<string, string> = { notify: "Bildirim gönder", create_task: "Görev oluştur", create_report: "Rapor hazırla", flag_record: "Kaydı işaretle" };

/* --------------------------------------------------------- generic modal --- */
function ModuleModal({ eyebrow, title, onClose, onSubmit, saving, children, submitLabel = "Kaydet" }: { eyebrow: string; title: string; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; saving: boolean; children: React.ReactNode; submitLabel?: string }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <form className="entry-modal" onSubmit={onSubmit}>
      <div className="modal-head"><div><span>{eyebrow}</span><h2>{title}</h2></div><button type="button" onClick={onClose} aria-label="Pencereyi kapat"><X size={19} /></button></div>
      {children}
      <div className="modal-actions"><button className="outline-button" type="button" onClick={onClose}>Vazgeç</button><button className="panel-primary" disabled={saving}>{saving ? "Kaydediliyor..." : submitLabel}</button></div>
    </form>
  </div>;
}
const departmentOptions = departmentNames.map((name) => <option key={name} value={name}>{name}</option>);

function PanelHead({ eyebrow, title, text, count, action }: { eyebrow: string; title: string; text: string; count?: string; action?: React.ReactNode }) {
  return <section className="finance-workbook-head"><div><span>{eyebrow}</span><h2>{title}</h2><p>{text}</p></div><div className="workbook-actions">{count && <em style={{ alignSelf: "center", color: "#6b7a8d", fontWeight: 600 }}>{count}</em>}{action}</div></section>;
}
function ModuleEmpty({ icon: Icon, title, text, onAdd, addLabel }: { icon: typeof CheckSquare; title: string; text: string; onAdd?: () => void; addLabel?: string }) {
  return <div className="empty-state"><Icon size={28} /><b>{title}</b><p>{text}</p>{onAdd && <button className="panel-primary" style={{ marginTop: 14 }} onClick={onAdd}><Plus size={16} /> {addLabel}</button>}</div>;
}

type ViewProps<T> = { items: T[]; organizationId: string; onReload: () => Promise<void> | void; notify: (text: string) => void; search?: string };

/* -------------------------------------------------------------- Tasks ------ */
export function TasksView({ items, organizationId, onReload, notify, search = "" }: ViewProps<Task>) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("all");
  const term = search.toLocaleLowerCase("tr-TR").trim();
  const filtered = items.filter((t) => (filter === "all" || t.status === filter) && (!term || `${t.title} ${t.department} ${t.assignee_name ?? ""}`.toLocaleLowerCase("tr-TR").includes(term)));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true);
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    try { await api("/api/tasks", organizationId, "POST", payload); setOpen(false); notify("Görev oluşturuldu."); await onReload(); }
    catch (e) { notify(e instanceof Error ? e.message : "Görev oluşturulamadı."); } finally { setSaving(false); }
  }
  async function setStatus(task: Task, status: string) {
    try { await api(`/api/tasks/${task.id}`, organizationId, "PUT", { status }); notify("Görev durumu güncellendi."); await onReload(); }
    catch (e) { notify(e instanceof Error ? e.message : "Güncellenemedi."); }
  }
  async function remove(id: string) { if (!window.confirm("Bu görevi silmek istediğinizden emin misiniz?")) return; try { await api(`/api/tasks/${id}`, organizationId, "DELETE"); notify("Görev silindi."); await onReload(); } catch (e) { notify(e instanceof Error ? e.message : "Silinemedi."); } }

  const filters = [["all", "Tümü"], ["open", "Açık"], ["in_progress", "Sürüyor"], ["done", "Tamamlandı"], ["cancelled", "İptal"]];
  return <>
    <PanelHead eyebrow="GÖREV YÖNETİMİ" title="Departman görevlerini tek listede takip edin." text="Görevleri sorumluya, önceliğe ve son tarihe göre düzenleyin; durumu tek tıkla değiştirin." count={`${items.length} görev`} action={<button className="panel-primary" onClick={() => setOpen(true)}><Plus size={17} /> Yeni görev</button>} />
    <section className="payment-period-bar"><div><span>DURUM FİLTRESİ</span><b>Görevleri duruma göre süzün</b></div><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{filters.map(([id, label]) => <button key={id} type="button" className={filter === id ? "panel-primary" : "outline-button"} style={{ padding: "8px 14px" }} onClick={() => setFilter(id)}>{label}</button>)}</div></section>
    <section className="table-card">
      <div className="table-heading"><div><h3>Görevler</h3><p>Durumu değiştirmek için ilgili düğmeyi kullanın.</p></div><span>{filtered.length} kayıt</span></div>
      {filtered.length ? <div className="responsive-table"><table><thead><tr><th>Görev</th><th>Departman</th><th>Sorumlu</th><th>Öncelik</th><th>Son tarih</th><th>Durum</th><th /></tr></thead><tbody>
        {filtered.map((t) => <tr key={t.id}><td><b>{t.title}</b>{t.description && <small className="cell-note" style={{ display: "block", color: "#6b7a8d" }}>{t.description}</small>}</td><td>{t.department}</td><td>{t.assignee_name || "Atanmadı"}</td><td><PriorityBadge value={t.priority} /></td><td>{fmtDate(t.due_date)}</td><td><StatusBadge map={taskStatus} value={t.status} /></td><td><div className="row-actions" style={{ display: "flex", gap: 6 }}>{t.status !== "done" && <button title="Tamamlandı olarak işaretle" onClick={() => void setStatus(t, "done")}><Check size={15} /></button>}{t.status === "open" && <button title="Başlat" onClick={() => void setStatus(t, "in_progress")}><Clock size={15} /></button>}<button className="danger" title="Sil" onClick={() => void remove(t.id)}><Trash2 size={15} /></button></div></td></tr>)}
      </tbody></table></div> : <ModuleEmpty icon={CheckSquare} title="Görev bulunmuyor" text="Yeni görev düğmesiyle ilk görevi ekleyin." onAdd={() => setOpen(true)} addLabel="Yeni görev" />}
    </section>
    {open && <ModuleModal eyebrow="GÖREV" title="Yeni görev oluştur" onClose={() => setOpen(false)} onSubmit={submit} saving={saving}>
      <div className="form-grid">
        <label className="full"><span>Görev başlığı</span><input name="title" required placeholder="Örn. Aylık bakım raporunu hazırla" /></label>
        <label><span>Departman</span><select name="department" required defaultValue="Operasyon yönetimi">{departmentOptions}</select></label>
        <label><span>Sorumlu</span><input name="assigneeName" placeholder="Ad soyad" /></label>
        <label><span>Öncelik</span><select name="priority" defaultValue="normal"><option value="low">Düşük</option><option value="normal">Normal</option><option value="high">Yüksek</option><option value="critical">Kritik</option></select></label>
        <label><span>Son tarih</span><input name="dueDate" type="date" /></label>
        <label className="full"><span>Açıklama</span><textarea name="description" rows={3} placeholder="Görev ayrıntıları" /></label>
      </div>
    </ModuleModal>}
  </>;
}

/* ---------------------------------------------------------- Work orders ---- */
export function WorkOrdersView({ items, organizationId, onReload, notify, search = "" }: ViewProps<WorkOrder>) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const term = search.toLocaleLowerCase("tr-TR").trim();
  const filtered = items.filter((w) => !term || `${w.order_number} ${w.title} ${w.customer_name ?? ""} ${w.location ?? ""}`.toLocaleLowerCase("tr-TR").includes(term));
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true);
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    try { await api("/api/work-orders", organizationId, "POST", payload); setOpen(false); notify("İş emri oluşturuldu."); await onReload(); }
    catch (e) { notify(e instanceof Error ? e.message : "İş emri oluşturulamadı."); } finally { setSaving(false); }
  }
  async function setStatus(w: WorkOrder, status: string) { try { await api(`/api/work-orders/${w.id}`, organizationId, "PUT", { status }); notify("İş emri durumu güncellendi."); await onReload(); } catch (e) { notify(e instanceof Error ? e.message : "Güncellenemedi."); } }
  async function remove(id: string) { if (!window.confirm("Bu iş emrini silmek istediğinizden emin misiniz?")) return; try { await api(`/api/work-orders/${id}`, organizationId, "DELETE"); notify("İş emri silindi."); await onReload(); } catch (e) { notify(e instanceof Error ? e.message : "Silinemedi."); } }
  const nextStatus: Record<string, [string, string]> = { open: ["assigned", "Ata"], assigned: ["in_progress", "Başlat"], in_progress: ["completed", "Tamamla"] };
  return <>
    <a className="panel-primary" style={{display:"inline-flex",marginBottom:16}} href="/servis">Servis masası: teklif, onay ve rapor →</a>
    <PanelHead eyebrow="OPERASYON YÖNETİMİ" title="Saha ve bakım iş emirlerini yönetin." text="Her iş emri otomatik numara alır; durum akışını kart üzerinden ilerletin." count={`${items.length} iş emri`} action={<button className="panel-primary" onClick={() => setOpen(true)}><Plus size={17} /> Yeni iş emri</button>} />
    {filtered.length ? <section className="project-card-grid">{filtered.map((w) => { const step = nextStatus[w.status]; return <article key={w.id}>
      <div className="project-card-top"><span>{w.order_number} · {orderTypeLabel[w.order_type]}</span><StatusBadge map={woStatus} value={w.status} /></div>
      <h3>{w.title}</h3><p>{w.description || "Açıklama eklenmedi."}</p>
      <dl><div><dt>Müşteri</dt><dd>{w.customer_name || "—"}</dd></div><div><dt>Konum</dt><dd>{w.location || "—"}</dd></div><div><dt>Sorumlu</dt><dd>{w.assigned_to || "Atanmadı"}</dd></div><div><dt>Planlanan</dt><dd>{fmtDate(w.scheduled_date)}</dd></div></dl>
      <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center" }}><PriorityBadge value={w.priority} />{step && <button className="panel-primary" style={{ padding: "7px 12px", marginLeft: "auto" }} onClick={() => void setStatus(w, step[0])}>{step[1]}</button>}<button className="outline-button" style={{ padding: "7px 10px", marginLeft: step ? 0 : "auto" }} onClick={() => void remove(w.id)}><Trash2 size={15} /></button></div>
    </article>; })}</section> : <section className="table-card"><ModuleEmpty icon={Wrench} title="İş emri bulunmuyor" text="Yeni iş emri düğmesiyle ilk kaydı oluşturun." onAdd={() => setOpen(true)} addLabel="Yeni iş emri" /></section>}
    {open && <ModuleModal eyebrow="İŞ EMRİ" title="Yeni iş emri oluştur" onClose={() => setOpen(false)} onSubmit={submit} saving={saving}>
      <div className="form-grid">
        <label className="full"><span>Başlık</span><input name="title" required placeholder="Örn. Jeneratör periyodik bakımı" /></label>
        <label><span>İş türü</span><select name="orderType" defaultValue="maintenance"><option value="maintenance">Bakım</option><option value="repair">Onarım</option><option value="installation">Kurulum</option><option value="inspection">Kontrol</option><option value="other">Diğer</option></select></label>
        <label><span>Öncelik</span><select name="priority" defaultValue="normal"><option value="low">Düşük</option><option value="normal">Normal</option><option value="high">Yüksek</option><option value="critical">Kritik</option></select></label>
        <label><span>Müşteri</span><input name="customerName" placeholder="Müşteri adı" /></label>
        <label><span>Konum</span><input name="location" placeholder="Saha / adres" /></label>
        <label><span>Sorumlu</span><input name="assignedTo" placeholder="Görevli ekip / kişi" /></label>
        <label><span>Planlanan tarih</span><input name="scheduledDate" type="date" /></label>
        <label><span>Tahmini süre (saat)</span><input name="estimatedHours" type="number" min="0" step="0.5" placeholder="0" /></label>
        <label className="full"><span>Açıklama</span><textarea name="description" rows={3} placeholder="İş kapsamı ve notlar" /></label>
      </div>
    </ModuleModal>}
  </>;
}

/* --------------------------------------------------------- Field visits ---- */
export function FieldVisitsView({ items, organizationId, onReload, notify, search = "" }: ViewProps<FieldVisit>) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const term = search.toLocaleLowerCase("tr-TR").trim();
  const sorted = [...items].sort((a, b) => (b.visit_date || "").localeCompare(a.visit_date || ""));
  const filtered = sorted.filter((v) => !term || `${v.visit_number} ${v.visitor_name} ${v.location} ${v.customer_name ?? ""}`.toLocaleLowerCase("tr-TR").includes(term));
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true);
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    try { await api("/api/field-visits", organizationId, "POST", payload); setOpen(false); notify("Saha ziyareti kaydedildi."); await onReload(); }
    catch (e) { notify(e instanceof Error ? e.message : "Kaydedilemedi."); } finally { setSaving(false); }
  }
  async function complete(v: FieldVisit) { try { await api(`/api/field-visits/${v.id}`, organizationId, "PUT", { status: "completed" }); notify("Ziyaret tamamlandı olarak işaretlendi."); await onReload(); } catch (e) { notify(e instanceof Error ? e.message : "Güncellenemedi."); } }
  async function remove(id: string) { if (!window.confirm("Bu ziyareti silmek istediğinizden emin misiniz?")) return; try { await api(`/api/field-visits/${id}`, organizationId, "DELETE"); notify("Ziyaret silindi."); await onReload(); } catch (e) { notify(e instanceof Error ? e.message : "Silinemedi."); } }
  return <>
    <PanelHead eyebrow="SAHA HAREKETLERİ" title="Saha ziyaretlerini tarih sırasıyla izleyin." text="Kontrol, kurulum, bakım ve destek ziyaretlerini bulgu ve süreyle birlikte kaydedin." count={`${items.length} ziyaret`} action={<button className="panel-primary" onClick={() => setOpen(true)}><Plus size={17} /> Yeni ziyaret</button>} />
    <section className="table-card">
      <div className="table-heading"><div><h3>Saha ziyaretleri</h3><p>En yeni ziyaretler üstte listelenir.</p></div><span>{filtered.length} kayıt</span></div>
      {filtered.length ? <div className="responsive-table"><table><thead><tr><th>No</th><th>Tarih</th><th>Ziyaretçi</th><th>Müşteri</th><th>Konum</th><th>Tür</th><th>Süre</th><th>Durum</th><th /></tr></thead><tbody>
        {filtered.map((v) => <tr key={v.id}><td><b>{v.visit_number}</b></td><td>{fmtDate(v.visit_date)}</td><td>{v.visitor_name}</td><td>{v.customer_name || "—"}</td><td>{v.location}</td><td>{visitTypeLabel[v.visit_type]}</td><td>{v.duration_hours ? `${v.duration_hours} sa` : "—"}</td><td><StatusBadge map={visitStatus} value={v.status} /></td><td><div className="row-actions" style={{ display: "flex", gap: 6 }}>{v.status === "planned" && <button title="Tamamlandı" onClick={() => void complete(v)}><Check size={15} /></button>}<button className="danger" title="Sil" onClick={() => void remove(v.id)}><Trash2 size={15} /></button></div></td></tr>)}
      </tbody></table></div> : <ModuleEmpty icon={MapPin} title="Saha ziyareti yok" text="Yeni ziyaret düğmesiyle ilk kaydı ekleyin." onAdd={() => setOpen(true)} addLabel="Yeni ziyaret" />}
    </section>
    {open && <ModuleModal eyebrow="SAHA ZİYARETİ" title="Yeni saha ziyareti" onClose={() => setOpen(false)} onSubmit={submit} saving={saving}>
      <div className="form-grid">
        <label><span>Ziyaretçi</span><input name="visitorName" required placeholder="Ad soyad" /></label>
        <label><span>Ziyaret tarihi</span><input name="visitDate" type="date" required /></label>
        <label><span>Konum</span><input name="location" required placeholder="Saha / adres" /></label>
        <label><span>Müşteri</span><input name="customerName" placeholder="Müşteri adı" /></label>
        <label><span>Tür</span><select name="visitType" defaultValue="inspection"><option value="inspection">Kontrol</option><option value="installation">Kurulum</option><option value="maintenance">Bakım</option><option value="support">Destek</option><option value="audit">Denetim</option><option value="other">Diğer</option></select></label>
        <label><span>Süre (saat)</span><input name="durationHours" type="number" min="0" step="0.5" placeholder="0" /></label>
        <label><span>Sonraki ziyaret</span><input name="nextVisitDate" type="date" /></label>
        <label className="full"><span>Bulgular</span><textarea name="findings" rows={2} placeholder="Sahada gözlenenler" /></label>
        <label className="full"><span>Yapılan işlemler</span><textarea name="actionsTaken" rows={2} placeholder="Alınan aksiyonlar" /></label>
      </div>
    </ModuleModal>}
  </>;
}

/* ---------------------------------------------------------- Procurement ---- */
export function ProcurementView({ items, organizationId, onReload, notify, search = "" }: ViewProps<ProcurementRequest>) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const term = search.toLocaleLowerCase("tr-TR").trim();
  const filtered = items.filter((p) => !term || `${p.request_number} ${p.title} ${p.supplier_name ?? ""} ${p.department}`.toLocaleLowerCase("tr-TR").includes(term));
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true);
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    try { await api("/api/procurement", organizationId, "POST", payload); setOpen(false); notify("Satın alma talebi oluşturuldu."); await onReload(); }
    catch (e) { notify(e instanceof Error ? e.message : "Oluşturulamadı."); } finally { setSaving(false); }
  }
  async function setStatus(p: ProcurementRequest, status: string) { try { await api(`/api/procurement/${p.id}`, organizationId, "PUT", { status }); notify("Talep durumu güncellendi."); await onReload(); } catch (e) { notify(e instanceof Error ? e.message : "Güncellenemedi."); } }
  async function remove(id: string) { if (!window.confirm("Bu talebi silmek istediğinizden emin misiniz?")) return; try { await api(`/api/procurement/${id}`, organizationId, "DELETE"); notify("Talep silindi."); await onReload(); } catch (e) { notify(e instanceof Error ? e.message : "Silinemedi."); } }
  const flow: Record<string, [string, string]> = { draft: ["pending", "Onaya gönder"], pending: ["approved", "Onayla"], approved: ["ordered", "Sipariş ver"], ordered: ["delivered", "Teslim alındı"] };
  const pending = items.filter((p) => p.status === "pending").length;
  return <>
    <PanelHead eyebrow="SATIN ALMA VE TEDARİK" title="Talep, onay ve teslim sürecini tek akışta yönetin." text="Her talep taslaktan teslime kadar kontrollü bir onay akışında ilerler." count={`${items.length} talep · ${pending} onay bekliyor`} action={<button className="panel-primary" onClick={() => setOpen(true)}><Plus size={17} /> Yeni talep</button>} />
    {filtered.length ? <section className="project-card-grid">{filtered.map((p) => { const step = flow[p.status]; return <article key={p.id}>
      <div className="project-card-top"><span>{p.request_number} · {p.department}</span><StatusBadge map={procStatus} value={p.status} /></div>
      <h3>{p.title}</h3><p>{p.description || "Açıklama eklenmedi."}</p>
      <dl><div><dt>Tedarikçi</dt><dd>{p.supplier_name || "—"}</dd></div><div><dt>Miktar</dt><dd>{p.quantity} {p.unit || "adet"}</dd></div><div><dt>Toplam tutar</dt><dd><b>{fmtMoney(p.total_price)}</b></dd></div><div><dt>İstenen tarih</dt><dd>{fmtDate(p.required_date)}</dd></div></dl>
      <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center" }}><PriorityBadge value={p.priority} />{step && p.status !== "cancelled" && <button className="panel-primary" style={{ padding: "7px 12px", marginLeft: "auto" }} onClick={() => void setStatus(p, step[0])}>{step[1]}</button>}{["draft", "pending", "approved"].includes(p.status) && <button className="outline-button" style={{ padding: "7px 10px" }} onClick={() => void setStatus(p, "cancelled")}>İptal</button>}<button className="outline-button" style={{ padding: "7px 10px", marginLeft: step ? 0 : "auto" }} onClick={() => void remove(p.id)}><Trash2 size={15} /></button></div>
    </article>; })}</section> : <section className="table-card"><ModuleEmpty icon={ShoppingCart} title="Satın alma talebi yok" text="Yeni talep düğmesiyle ilk kaydı oluşturun." onAdd={() => setOpen(true)} addLabel="Yeni talep" /></section>}
    {open && <ModuleModal eyebrow="SATIN ALMA TALEBİ" title="Yeni satın alma talebi" onClose={() => setOpen(false)} onSubmit={submit} saving={saving}>
      <div className="form-grid">
        <label className="full"><span>Talep başlığı</span><input name="title" required placeholder="Örn. Ölçüm cihazı alımı" /></label>
        <label><span>Departman</span><select name="department" required defaultValue="Satın alma ve tedarik">{departmentOptions}</select></label>
        <label><span>Tedarikçi</span><input name="supplierName" placeholder="Tedarikçi adı" /></label>
        <label><span>Miktar</span><input name="quantity" type="number" min="1" step="1" defaultValue="1" /></label>
        <label><span>Birim</span><input name="unit" placeholder="adet / kg / saat" defaultValue="adet" /></label>
        <label><span>Birim fiyat</span><div className="money-input"><input name="unitPrice" type="number" min="0" step="0.01" placeholder="0" /><em>₺</em></div></label>
        <label><span>Öncelik</span><select name="priority" defaultValue="normal"><option value="low">Düşük</option><option value="normal">Normal</option><option value="high">Yüksek</option><option value="critical">Kritik</option></select></label>
        <label><span>İstenen tarih</span><input name="requiredDate" type="date" /></label>
        <label className="full"><span>Açıklama</span><textarea name="description" rows={3} placeholder="Talep gerekçesi ve teknik detay" /></label>
      </div>
    </ModuleModal>}
  </>;
}

/* ------------------------------------------------------------------ CRM ---- */
export function CrmView({ items, organizationId, onReload, notify, search = "" }: ViewProps<Customer>) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [interactions, setInteractions] = useState<CustomerInteraction[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [interactionOpen, setInteractionOpen] = useState(false);
  const [savingInteraction, setSavingInteraction] = useState(false);
  const term = search.toLocaleLowerCase("tr-TR").trim();
  const filtered = items.filter((c) => !term || `${c.name} ${c.company_name ?? ""} ${c.sector ?? ""}`.toLocaleLowerCase("tr-TR").includes(term));
  const current = items.find((c) => c.id === selected) ?? null;

  useEffect(() => { if (!selected && filtered.length) setSelected(filtered[0].id); }, [filtered, selected]);
  useEffect(() => {
    if (!selected) { setInteractions([]); return; }
    let cancelled = false;
    setLoadingDetail(true);
    fetch(`/api/customers/${selected}`, { headers: { "X-Organization-Id": organizationId }, cache: "no-store" })
      .then((r) => r.ok ? r.json() : { interactions: [] })
      .then((d: { interactions?: CustomerInteraction[] }) => { if (!cancelled) setInteractions(d.interactions ?? []); })
      .finally(() => { if (!cancelled) setLoadingDetail(false); });
    return () => { cancelled = true; };
  }, [selected, organizationId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true);
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    try { const r = await api("/api/customers", organizationId, "POST", payload) as { id?: string }; setOpen(false); notify("Müşteri eklendi."); await onReload(); if (r.id) setSelected(r.id); }
    catch (e) { notify(e instanceof Error ? e.message : "Eklenemedi."); } finally { setSaving(false); }
  }
  async function submitInteraction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selected) return; setSavingInteraction(true);
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      await api(`/api/customers/${selected}/interactions`, organizationId, "POST", payload);
      setInteractionOpen(false); notify("Görüşme kaydedildi.");
      const d = await fetch(`/api/customers/${selected}`, { headers: { "X-Organization-Id": organizationId }, cache: "no-store" }).then((r) => r.json()) as { interactions?: CustomerInteraction[] };
      setInteractions(d.interactions ?? []);
    } catch (e) { notify(e instanceof Error ? e.message : "Kaydedilemedi."); } finally { setSavingInteraction(false); }
  }
  async function remove(id: string) { if (!window.confirm("Bu müşteriyi silmek istediğinizden emin misiniz?")) return; try { await api(`/api/customers/${id}`, organizationId, "DELETE"); notify("Müşteri silindi."); if (selected === id) setSelected(null); await onReload(); } catch (e) { notify(e instanceof Error ? e.message : "Silinemedi."); } }

  return <>
    <PanelHead eyebrow="MÜŞTERİ YÖNETİMİ" title="Müşteri ilişkilerini ve görüşme geçmişini yönetin." text="Sol listeden bir müşteri seçin; sağda iletişim geçmişini ve görüşmeleri görün." count={`${items.length} müşteri`} action={<button className="panel-primary" onClick={() => setOpen(true)}><Plus size={17} /> Yeni müşteri</button>} />
    {items.length ? <section style={{ display: "grid", gridTemplateColumns: "minmax(240px, 320px) 1fr", gap: 18, alignItems: "start" }}>
      <div className="table-card" style={{ padding: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{filtered.map((c) => <button key={c.id} type="button" onClick={() => setSelected(c.id)} style={{ textAlign: "left", padding: "12px 14px", borderRadius: 12, border: c.id === selected ? "1px solid #2563eb" : "1px solid #e6ecf3", background: c.id === selected ? "#f2f7ff" : "#fff", cursor: "pointer" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}><b style={{ fontSize: 14 }}>{c.name}</b><StatusBadge map={custStatus} value={c.status} /></div>
          <small style={{ color: "#6b7a8d", display: "block", marginTop: 2 }}>{c.company_name || c.sector || "—"}</small>
        </button>)}</div>
      </div>
      <div className="table-card">
        {current ? <>
          <div className="table-heading"><div><h3>{current.name}</h3><p>{current.company_name || "—"} · {current.sector || "Sektör belirtilmedi"}</p></div><button className="outline-button" onClick={() => void remove(current.id)}><Trash2 size={15} /> Sil</button></div>
          <div className="company-info-grid" style={{ padding: "4px 0 16px" }}>
            <div><span>Durum</span><b>{custStatus[current.status]?.[2]}</b></div>
            <div><span>E-posta</span><b>{current.email || "—"}</b></div>
            <div><span>Telefon</span><b>{current.phone || "—"}</b></div>
            <div><span>Toplam değer</span><b>{fmtMoney(current.total_value)}</b></div>
            <div><span>Adres</span><b>{current.address || "—"}</b></div>
          </div>
          <div className="table-heading" style={{ borderTop: "1px solid #eef2f7", paddingTop: 14 }}><div><h3 style={{ fontSize: 16 }}>Görüşme geçmişi</h3><p>Telefon, toplantı, teklif ve ziyaret kayıtları</p></div><button className="panel-primary" style={{ padding: "8px 14px" }} onClick={() => setInteractionOpen(true)}><Plus size={15} /> Görüşme ekle</button></div>
          {loadingDetail ? <div className="empty-state"><Loader2 className="spin" size={22} /><p>Yükleniyor...</p></div> : interactions.length ? <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{interactions.map((i) => <div key={i.id} style={{ padding: "12px 14px", border: "1px solid #eef2f7", borderRadius: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><b>{interactionLabel[i.interaction_type]}</b><small style={{ color: "#6b7a8d" }}>{fmtDate(i.interaction_date)}</small></div>
            <p style={{ margin: "6px 0 0", fontSize: 14 }}>{i.summary}</p>
            {i.outcome && <small style={{ color: "#6b7a8d", display: "block", marginTop: 4 }}>Sonuç: {i.outcome}</small>}
            {i.next_action && <small style={{ color: "#c2670a", display: "block", marginTop: 4 }}>Sonraki adım: {i.next_action} {i.next_action_date ? `(${fmtDate(i.next_action_date)})` : ""}</small>}
          </div>)}</div> : <ModuleEmpty icon={MessageCircle} title="Görüşme kaydı yok" text="Görüşme ekle düğmesiyle ilk kaydı oluşturun." />}
        </> : <ModuleEmpty icon={Users2} title="Müşteri seçin" text="Soldaki listeden bir müşteri seçin." />}
      </div>
    </section> : <section className="table-card"><ModuleEmpty icon={Users2} title="Müşteri bulunmuyor" text="Yeni müşteri düğmesiyle ilk kaydı ekleyin." onAdd={() => setOpen(true)} addLabel="Yeni müşteri" /></section>}
    {open && <ModuleModal eyebrow="MÜŞTERİ" title="Yeni müşteri ekle" onClose={() => setOpen(false)} onSubmit={submit} saving={saving}>
      <div className="form-grid">
        <label><span>Müşteri adı</span><input name="name" required placeholder="Kişi adı" /></label>
        <label><span>Firma</span><input name="companyName" placeholder="Firma adı" /></label>
        <label><span>E-posta</span><input name="email" type="email" /></label>
        <label><span>Telefon</span><input name="phone" type="tel" /></label>
        <label><span>Sektör</span><input name="sector" placeholder="Örn. İnşaat" /></label>
        <label><span>Durum</span><select name="status" defaultValue="lead"><option value="lead">Aday</option><option value="prospect">Görüşülüyor</option><option value="active">Aktif müşteri</option><option value="inactive">Pasif</option></select></label>
        <label><span>Toplam değer</span><div className="money-input"><input name="totalValue" type="number" min="0" step="0.01" placeholder="0" /><em>₺</em></div></label>
        <label className="full"><span>Adres</span><input name="address" /></label>
        <label className="full"><span>Not</span><textarea name="notes" rows={2} /></label>
      </div>
    </ModuleModal>}
    {interactionOpen && <ModuleModal eyebrow="GÖRÜŞME" title="Yeni görüşme kaydı" onClose={() => setInteractionOpen(false)} onSubmit={submitInteraction} saving={savingInteraction}>
      <div className="form-grid">
        <label><span>Tür</span><select name="interactionType" defaultValue="call"><option value="call">Telefon</option><option value="email">E-posta</option><option value="meeting">Toplantı</option><option value="visit">Ziyaret</option><option value="proposal">Teklif</option><option value="other">Diğer</option></select></label>
        <label><span>Tarih</span><input name="interactionDate" type="date" required /></label>
        <label className="full"><span>Özet</span><textarea name="summary" rows={2} required placeholder="Görüşmenin özeti" /></label>
        <label className="full"><span>Sonuç</span><input name="outcome" placeholder="Görüşme sonucu" /></label>
        <label><span>Sonraki adım</span><input name="nextAction" placeholder="Yapılacak" /></label>
        <label><span>Sonraki adım tarihi</span><input name="nextActionDate" type="date" /></label>
      </div>
    </ModuleModal>}
  </>;
}

/* ------------------------------------------------------------------- HR ---- */
export function HrView({ items, organizationId, onReload, notify, search = "" }: ViewProps<Employee>) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const term = search.toLocaleLowerCase("tr-TR").trim();
  const filtered = items.filter((e) => !term || `${e.full_name} ${e.title ?? ""} ${e.department}`.toLocaleLowerCase("tr-TR").includes(term));
  const grouped = useMemo(() => { const map = new Map<string, Employee[]>(); for (const e of filtered) { const list = map.get(e.department) ?? []; list.push(e); map.set(e.department, list); } return [...map.entries()]; }, [filtered]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true);
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    try { await api("/api/employees", organizationId, "POST", payload); setOpen(false); notify("Çalışan eklendi."); await onReload(); }
    catch (e) { notify(e instanceof Error ? e.message : "Eklenemedi."); } finally { setSaving(false); }
  }
  async function remove(id: string) { if (!window.confirm("Bu çalışanı silmek istediğinizden emin misiniz?")) return; try { await api(`/api/employees/${id}`, organizationId, "DELETE"); notify("Çalışan silindi."); await onReload(); } catch (e) { notify(e instanceof Error ? e.message : "Silinemedi."); } }
  return <>
    <PanelHead eyebrow="İNSAN KAYNAKLARI" title="Çalışan kayıtlarını departmana göre yönetin." text="Çalışanları rol, iletişim ve çalışma türüyle birlikte kaydedin." count={`${items.length} çalışan`} action={<button className="panel-primary" onClick={() => setOpen(true)}><Plus size={17} /> Yeni çalışan</button>} />
    {grouped.length ? grouped.map(([dept, list]) => <section className="table-card" key={dept} style={{ marginBottom: 16 }}>
      <div className="table-heading"><div><h3>{dept}</h3><p>{list.length} çalışan</p></div></div>
      <section className="project-card-grid">{list.map((e) => <article key={e.id}>
        <div className="project-card-top"><span>{e.title || "Görev belirtilmedi"}</span><StatusBadge map={empStatus} value={e.status} /></div>
        <h3>{e.full_name}</h3>
        <dl><div><dt>Çalışma türü</dt><dd>{empTypeLabel[e.employment_type]}</dd></div><div><dt>Başlangıç</dt><dd>{fmtDate(e.start_date)}</dd></div><div><dt>E-posta</dt><dd>{e.email || "—"}</dd></div><div><dt>Telefon</dt><dd>{e.phone || "—"}</dd></div></dl>
        <div style={{ display: "flex", marginTop: 12 }}><button className="outline-button" style={{ padding: "7px 10px", marginLeft: "auto" }} onClick={() => void remove(e.id)}><Trash2 size={15} /></button></div>
      </article>)}</section>
    </section>) : <section className="table-card"><ModuleEmpty icon={Users2} title="Çalışan kaydı yok" text="Yeni çalışan düğmesiyle ilk kaydı ekleyin." onAdd={() => setOpen(true)} addLabel="Yeni çalışan" /></section>}
    {open && <ModuleModal eyebrow="ÇALIŞAN" title="Yeni çalışan ekle" onClose={() => setOpen(false)} onSubmit={submit} saving={saving}>
      <div className="form-grid">
        <label><span>Ad soyad</span><input name="fullName" required /></label>
        <label><span>Unvan / görev</span><input name="title" placeholder="Örn. Saha mühendisi" /></label>
        <label><span>Departman</span><select name="department" required defaultValue="İnsan ve organizasyon">{departmentOptions}</select></label>
        <label><span>Çalışma türü</span><select name="employmentType" defaultValue="full_time"><option value="full_time">Tam zamanlı</option><option value="part_time">Yarı zamanlı</option><option value="contractor">Sözleşmeli</option><option value="intern">Stajyer</option></select></label>
        <label><span>Durum</span><select name="status" defaultValue="active"><option value="active">Aktif</option><option value="on_leave">İzinde</option><option value="inactive">Ayrıldı</option></select></label>
        <label><span>Başlangıç tarihi</span><input name="startDate" type="date" /></label>
        <label><span>E-posta</span><input name="email" type="email" /></label>
        <label><span>Telefon</span><input name="phone" type="tel" /></label>
        <label className="full"><span>Not</span><textarea name="notes" rows={2} /></label>
      </div>
    </ModuleModal>}
  </>;
}

/* ----------------------------------------------------------------- Risks --- */
export function RisksView({ items, organizationId, onReload, notify, search = "" }: ViewProps<Risk>) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const term = search.toLocaleLowerCase("tr-TR").trim();
  const filtered = items.filter((r) => !term || `${r.title} ${r.department} ${r.owner_name ?? ""}`.toLocaleLowerCase("tr-TR").includes(term));
  const scoreOf = (r: Risk) => ({ low: 1, medium: 2, high: 3, critical: 4 }[r.likelihood] ?? 2) * ({ low: 1, medium: 2, high: 3, critical: 4 }[r.impact] ?? 2);
  const cellColor = (score: number) => score >= 9 ? "#c0392b" : score >= 6 ? "#e67e22" : score >= 3 ? "#e0a80d" : "#1a8c53";
  const likelihoods: Risk["likelihood"][] = ["high", "medium", "low"];
  const impacts: Risk["impact"][] = ["low", "medium", "high", "critical"];
  const likelihoodLabel: Record<string, string> = { low: "Düşük", medium: "Orta", high: "Yüksek" };
  const impactLabel: Record<string, string> = { low: "Düşük", medium: "Orta", high: "Yüksek", critical: "Kritik" };
  const matrixCount = (l: string, i: string) => filtered.filter((r) => r.likelihood === l && r.impact === i && r.status !== "resolved").length;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true);
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    try { await api("/api/risks", organizationId, "POST", payload); setOpen(false); notify("Risk kaydedildi."); await onReload(); }
    catch (e) { notify(e instanceof Error ? e.message : "Kaydedilemedi."); } finally { setSaving(false); }
  }
  async function setStatus(r: Risk, status: string) { try { await api(`/api/risks/${r.id}`, organizationId, "PUT", { status }); notify("Risk durumu güncellendi."); await onReload(); } catch (e) { notify(e instanceof Error ? e.message : "Güncellenemedi."); } }
  async function remove(id: string) { if (!window.confirm("Bu risk kaydını silmek istediğinizden emin misiniz?")) return; try { await api(`/api/risks/${id}`, organizationId, "DELETE"); notify("Risk silindi."); await onReload(); } catch (e) { notify(e instanceof Error ? e.message : "Silinemedi."); } }
  return <>
    <PanelHead eyebrow="RİSK VE KALİTE" title="Riskleri olasılık ve etki matrisinde değerlendirin." text="Her risk; olasılık × etki puanıyla önceliklendirilir ve durumu izlenir." count={`${items.length} risk`} action={<button className="panel-primary" onClick={() => setOpen(true)}><Plus size={17} /> Yeni risk</button>} />
    <section className="table-card" style={{ marginBottom: 16 }}>
      <div className="table-heading"><div><h3>Risk matrisi</h3><p>Açık risklerin olasılık (satır) ve etki (sütun) dağılımı</p></div></div>
      <div style={{ overflowX: "auto" }}><table style={{ borderCollapse: "separate", borderSpacing: 6, margin: "0 auto" }}><thead><tr><th style={{ fontSize: 12, color: "#6b7a8d" }}>Olasılık \ Etki</th>{impacts.map((i) => <th key={i} style={{ fontSize: 12, color: "#6b7a8d", padding: 4 }}>{impactLabel[i]}</th>)}</tr></thead><tbody>
        {likelihoods.map((l) => <tr key={l}><td style={{ fontSize: 12, color: "#6b7a8d", paddingRight: 8, fontWeight: 600 }}>{likelihoodLabel[l]}</td>{impacts.map((i) => { const score = ({ low: 1, medium: 2, high: 3 }[l]) * ({ low: 1, medium: 2, high: 3, critical: 4 }[i]); const c = matrixCount(l, i); return <td key={i} style={{ width: 70, height: 54, textAlign: "center", verticalAlign: "middle", borderRadius: 10, background: cellColor(score), color: "#fff", fontWeight: 700, opacity: c ? 1 : 0.35 }}>{c || ""}</td>; })}</tr>)}
      </tbody></table></div>
    </section>
    <section className="table-card">
      <div className="table-heading"><div><h3>Risk kayıtları</h3><p>Puan = olasılık × etki</p></div><span>{filtered.length} kayıt</span></div>
      {filtered.length ? <div className="responsive-table"><table><thead><tr><th>Risk</th><th>Departman</th><th>Kategori</th><th>Olasılık</th><th>Etki</th><th>Puan</th><th>Sorumlu</th><th>Durum</th><th /></tr></thead><tbody>
        {[...filtered].sort((a, b) => scoreOf(b) - scoreOf(a)).map((r) => { const score = scoreOf(r); return <tr key={r.id}><td><b>{r.title}</b>{r.mitigation_plan && <small className="cell-note" style={{ display: "block", color: "#6b7a8d" }}>Önlem: {r.mitigation_plan}</small>}</td><td>{r.department}</td><td>{riskCategoryLabel[r.category]}</td><td>{likelihoodLabel[r.likelihood]}</td><td>{impactLabel[r.impact]}</td><td><span style={badge(cellColor(score), "#fff")}>{score}</span></td><td>{r.owner_name || "—"}</td><td><StatusBadge map={riskStatus} value={r.status} /></td><td><div className="row-actions" style={{ display: "flex", gap: 6 }}>{r.status !== "resolved" && <button title="Çözüldü olarak işaretle" onClick={() => void setStatus(r, "resolved")}><Check size={15} /></button>}<button className="danger" title="Sil" onClick={() => void remove(r.id)}><Trash2 size={15} /></button></div></td></tr>; })}
      </tbody></table></div> : <ModuleEmpty icon={AlertOctagon} title="Risk kaydı yok" text="Yeni risk düğmesiyle ilk kaydı ekleyin." onAdd={() => setOpen(true)} addLabel="Yeni risk" />}
    </section>
    {open && <ModuleModal eyebrow="RİSK" title="Yeni risk kaydı" onClose={() => setOpen(false)} onSubmit={submit} saving={saving}>
      <div className="form-grid">
        <label className="full"><span>Risk başlığı</span><input name="title" required placeholder="Örn. Tedarikçi gecikmesi" /></label>
        <label><span>Departman</span><select name="department" required defaultValue="Kalite ve risk yönetimi">{departmentOptions}</select></label>
        <label><span>Kategori</span><select name="category" defaultValue="operational"><option value="financial">Finansal</option><option value="operational">Operasyonel</option><option value="legal">Hukuki</option><option value="technical">Teknik</option><option value="hr">İnsan kaynakları</option><option value="other">Diğer</option></select></label>
        <label><span>Olasılık</span><select name="likelihood" defaultValue="medium"><option value="low">Düşük</option><option value="medium">Orta</option><option value="high">Yüksek</option></select></label>
        <label><span>Etki</span><select name="impact" defaultValue="medium"><option value="low">Düşük</option><option value="medium">Orta</option><option value="high">Yüksek</option><option value="critical">Kritik</option></select></label>
        <label><span>Sorumlu</span><input name="ownerName" placeholder="Ad soyad" /></label>
        <label><span>Gözden geçirme tarihi</span><input name="reviewDate" type="date" /></label>
        <label className="full"><span>Açıklama</span><textarea name="description" rows={2} /></label>
        <label className="full"><span>Önlem planı</span><textarea name="mitigationPlan" rows={2} placeholder="Riski azaltmak için planlanan aksiyonlar" /></label>
      </div>
    </ModuleModal>}
  </>;
}

/* ------------------------------------------------------------ Automations -- */
export function AutomationsView({ items, organizationId, onReload, notify }: ViewProps<AutomationRule>) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true);
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    try { await api("/api/automations", organizationId, "POST", payload); setOpen(false); notify("Otomasyon kuralı oluşturuldu."); await onReload(); }
    catch (e) { notify(e instanceof Error ? e.message : "Oluşturulamadı."); } finally { setSaving(false); }
  }
  async function toggle(rule: AutomationRule) { try { await api("/api/automations", organizationId, "PATCH", { id: rule.id, isActive: !rule.is_active }); notify(rule.is_active ? "Kural duraklatıldı." : "Kural etkinleştirildi."); await onReload(); } catch (e) { notify(e instanceof Error ? e.message : "Güncellenemedi."); } }
  async function trigger(rule: AutomationRule) {
    setRunning(rule.id);
    try { const r = await api(`/api/automations/${rule.id}`, organizationId, "POST") as { scanned?: number; matched?: number; message?: string }; notify(r.message || `Tarama tamamlandı: ${r.scanned ?? 0} kayıt incelendi, ${r.matched ?? 0} eşleşme.`); await onReload(); }
    catch (e) { notify(e instanceof Error ? e.message : "Çalıştırılamadı."); } finally { setRunning(null); }
  }
  async function remove(id: string) { if (!window.confirm("Bu kuralı silmek istediğinizden emin misiniz?")) return; try { await api(`/api/automations/${id}`, organizationId, "DELETE"); notify("Kural silindi."); await onReload(); } catch (e) { notify(e instanceof Error ? e.message : "Silinemedi."); } }
  const activeCount = items.filter((r) => r.is_active).length;
  return <>
    <PanelHead eyebrow="OTOMASYON MERKEZİ" title="Tekrarlanan kontrolleri kurallarla otomatikleştirin." text="Kurallar; eşik, zamanlama veya durum değişimini izler ve el ile de tetiklenebilir." count={`${items.length} kural · ${activeCount} etkin`} action={<button className="panel-primary" onClick={() => setOpen(true)}><Plus size={17} /> Yeni kural</button>} />
    {items.length ? <section className="project-card-grid">{items.map((rule) => <article key={rule.id} style={{ opacity: rule.is_active ? 1 : 0.72 }}>
      <div className="project-card-top"><span>{triggerLabel[rule.trigger_type]}</span><span style={badge(rule.is_active ? "#e4f5ec" : "#eef2f7", rule.is_active ? "#1a8c53" : "#5b6b7f")}>{rule.is_active ? "Etkin" : "Duraklatıldı"}</span></div>
      <h3>{rule.name}</h3><p>{rule.description || "Açıklama eklenmedi."}</p>
      <dl><div><dt>Eylem</dt><dd>{actionLabel[rule.action_type]}</dd></div><div><dt>Çalışma sayısı</dt><dd>{rule.run_count}</dd></div><div><dt>Son çalışma</dt><dd>{rule.last_run_at ? new Date(rule.last_run_at).toLocaleString("tr-TR") : "—"}</dd></div></dl>
      <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button className="panel-primary" style={{ padding: "7px 12px" }} disabled={running === rule.id} onClick={() => void trigger(rule)}>{running === rule.id ? <Loader2 className="spin" size={15} /> : <Zap size={15} />} Şimdi çalıştır</button>
        <button className="outline-button" style={{ padding: "7px 12px" }} onClick={() => void toggle(rule)}>{rule.is_active ? "Duraklat" : "Etkinleştir"}</button>
        <button className="outline-button" style={{ padding: "7px 10px", marginLeft: "auto" }} onClick={() => void remove(rule.id)}><Trash2 size={15} /></button>
      </div>
    </article>)}</section> : <section className="table-card"><ModuleEmpty icon={Zap} title="Otomasyon kuralı yok" text="Yeni kural düğmesiyle ilk otomasyonu oluşturun." onAdd={() => setOpen(true)} addLabel="Yeni kural" /></section>}
    {open && <ModuleModal eyebrow="OTOMASYON KURALI" title="Yeni otomasyon kuralı" onClose={() => setOpen(false)} onSubmit={submit} saving={saving}>
      <div className="form-grid">
        <label className="full"><span>Kural adı</span><input name="name" required placeholder="Örn. Vadesi yaklaşan ödemeleri bildir" /></label>
        <label><span>Tetikleyici</span><select name="triggerType" defaultValue="threshold"><option value="schedule">Zamanlanmış</option><option value="threshold">Eşik değeri</option><option value="status_change">Durum değişimi</option><option value="manual">El ile</option></select></label>
        <label><span>Eylem</span><select name="actionType" defaultValue="notify"><option value="notify">Bildirim gönder</option><option value="create_task">Görev oluştur</option><option value="create_report">Rapor hazırla</option><option value="flag_record">Kaydı işaretle</option></select></label>
        <label className="full"><span>Açıklama</span><textarea name="description" rows={3} placeholder="Kuralın ne yaptığını açıklayın" /></label>
      </div>
    </ModuleModal>}
  </>;
}

/* ------------------------------------------------------ Agent chat (real) -- */
type AgentPersona = { name: string; department: string; task: string; boundary: string };
export function AgentWorkforceView({ agents, organizationId, notify }: { agents: AgentPersona[]; organizationId: string; notify: (text: string) => void }) {
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const [messages, setMessages] = useState<AgentChat[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const persona = agents.find((a) => a.name === activeAgent) ?? null;

  useEffect(() => {
    if (!activeAgent) { setMessages([]); return; }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/agents/chat?agent=${encodeURIComponent(activeAgent)}`, { headers: { "X-Organization-Id": organizationId }, cache: "no-store" })
      .then((r) => r.ok ? r.json() : { messages: [] })
      .then((d: { messages?: AgentChat[] }) => { if (!cancelled) setMessages(d.messages ?? []); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [activeAgent, organizationId]);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, sending]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = input.trim();
    if (!message || !activeAgent || sending) return;
    setSending(true); setInput("");
    const temp: AgentChat = { id: `tmp-${Date.now()}`, agent_name: activeAgent, role: "user", content: message, created_at: new Date().toISOString() };
    setMessages((prev) => [...prev, temp]);
    try {
      const r = await api("/api/agents/chat", organizationId, "POST", { agentName: activeAgent, message, organizationId }) as { reply?: string; source?: string };
      setMessages((prev) => [...prev, { id: `a-${Date.now()}`, agent_name: activeAgent, role: "assistant", content: r.reply || "", created_at: new Date().toISOString() }]);
      if (r.source !== "llm") notify("Güncel kayıt özeti gösterildi; yapay zekâ analizi yapılmadı.");
    } catch (e) { notify(e instanceof Error ? e.message : "Yanıt alınamadı."); setMessages((prev) => prev.filter((m) => m.id !== temp.id)); }
    finally { setSending(false); }
  }

  return <section className="agent-workforce">
    <div className="agent-prototype-banner"><div><Bot size={30} /><span>CANLI ASİSTAN</span></div><h2>Departman verilerinizi bilen asistanlarla sohbet edin.</h2><p>Her asistan, kendi görev ve yetki sınırları içinde şirket verilerinizi özetler. OpenAI bağlantısı etkinse gerçek yanıt, değilse şirket verinize dayalı örnek yanıt üretilir. Asistanlar kayıt silmez ve onayınız olmadan işlem başlatmaz.</p></div>
    {persona ? <div className="table-card agent-chat-panel">
      <div className="table-heading agent-chat-heading"><div className="agent-chat-identity"><div className="agent-avatar"><Bot size={22} /></div><div><h3>{persona.name}</h3><p>{persona.department}</p></div></div><button className="outline-button" onClick={() => setActiveAgent(null)}><X size={15} /> Kapat</button></div>
      <div ref={scrollRef} className="agent-chat-messages">
        {loading ? <div className="empty-state"><Loader2 className="spin" size={22} /><p>Geçmiş yükleniyor...</p></div> : <>
          {!messages.length && <div className="agent-chat-intro"><b>Görevi</b><p>{persona.task}</p><b>Yetki sınırı</b><p>{persona.boundary}</p><small>Sohbet devamlıdır; önceki mesajlarınızı hatırlar, güncel sorunuza göre özet, karşılaştırma veya aksiyon planı hazırlayabilir.</small></div>}
          {messages.map((m) => <div key={m.id} className={`agent-chat-message ${m.role}`}>{m.content}</div>)}
          {sending && <div className="agent-chat-message assistant waiting"><Loader2 className="spin" size={16} /> Yanıt hazırlanıyor...</div>}
        </>}
      </div>
      <form onSubmit={send} className="agent-chat-form">
        <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} placeholder={`${persona.name} ile konuşmaya devam edin...`} rows={2} disabled={sending} />
        <button className="panel-primary" disabled={sending || !input.trim()} aria-label="Mesajı gönder"><Send size={17} /></button>
      </form>
    </div> : <div className="agent-card-grid">{agents.map((agent) => <article key={agent.name}>
      <div className="agent-avatar"><Bot size={22} /></div><span>{agent.department}</span><h3>{agent.name}</h3>
      <b>Görevi</b><p>{agent.task}</p><b>Yetki sınırı</b><p>{agent.boundary}</p>
      <div><em>İnsan onayı zorunlu</em><button type="button" onClick={() => setActiveAgent(agent.name)}><MessageCircle size={14} /> Sohbet başlat</button></div>
    </article>)}</div>}
  </section>;
}

/* -------------------------------------------------- Overview module widget - */
export function OverviewModuleWidgets({ tasks, workOrders, fieldVisits, procurement, risks, onNavigate }: { tasks: Task[]; workOrders: WorkOrder[]; fieldVisits: FieldVisit[]; procurement: ProcurementRequest[]; risks: Risk[]; onNavigate: (page: string) => void }) {
  const now = new Date();
  const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const inWeek = (d?: string | null) => { if (!d) return false; const t = new Date(d); return t >= new Date(now.toDateString()) && t <= weekAhead; };
  const cards = [
    { label: "Bekleyen görev", value: tasks.filter((t) => t.status === "open" || t.status === "in_progress").length, note: "Açık ve süren görevler", icon: CheckSquare, target: "tasks" },
    { label: "Açık iş emri", value: workOrders.filter((w) => w.status !== "completed" && w.status !== "cancelled").length, note: "Tamamlanmamış iş emirleri", icon: Wrench, target: "work-orders" },
    { label: "Bu hafta saha ziyareti", value: fieldVisits.filter((v) => v.status === "planned" && inWeek(v.visit_date)).length, note: "Önümüzdeki 7 gün", icon: MapPin, target: "field-visits" },
    { label: "Onay bekleyen satın alma", value: procurement.filter((p) => p.status === "pending").length, note: "Onay bekleyen talepler", icon: ShoppingCart, target: "procurement" },
    { label: "Bu hafta risk gözden geçirme", value: risks.filter((r) => r.status !== "resolved" && inWeek(r.review_date)).length, note: "Planlı risk incelemeleri", icon: AlertOctagon, target: "risks" },
  ];
  return <section className="company-command-grid" style={{ marginTop: 4 }}>
    {cards.map(({ label, value, note, icon: Icon, target }) => <button key={label} onClick={() => onNavigate(target)}><Icon size={22} /><span><b>{value} · {label}</b><small>{note}</small></span><ArrowRight size={17} /></button>)}
  </section>;
}
