"use client";
// İş tanımları: firma kendi birimlerini ve süreç türlerini tanımlar. Sistem bu tanıma göre çalışır:
// her aşamanın sorumlusu, onaylayan rolü, süre hedefi, zorunlu bilgisi; ret durumunda ne olacağı;
// süreç kapanınca hangi birimde hangi sürecin kendiliğinden açılacağı. Hazır süreç türleri salt okunurdur,
// kopyalanıp firmaya göre değiştirilebilir. Kurallar sunucuda ayrıca doğrulanır.
import { goToLogin, goToMfaSetup } from "@/lib/workspace-navigation";
import { organizationFetch, storedOrganization } from "@/lib/org-client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import "../../servis/service.css";
import "../birimler.css";
import "./is-tanimlari.css";

type FieldType = "text" | "textarea" | "date" | "number" | "choice";
type Field = { key?: string; label: string; type: FieldType; required?: boolean; options?: string[] | string };
type Stage = { key?: string; label: string; todo?: string; approvers?: string[]; slaDays?: number | string; requires?: string[]; rejectTo?: string };
type Next = { slug: string; template: string; when?: string[] };
type Template = { key: string; label: string; summary: string; selfService?: boolean; fields: Field[]; stages: Stage[]; outcomes: string[]; next?: Next[]; note?: string; custom: boolean; active: boolean; version: number | null };
type Dept = { slug: string; name: string; short: string; mission: string; owners: string[]; custom: boolean; templates: Template[] };
type Data = { canEdit: boolean; profiles: { key: string; label: string }[]; fieldTypes: FieldType[]; rejectedOutcome: string; departments: Dept[] };
type Draft = { key?: string; version?: number | null; label: string; summary: string; selfService: boolean; fields: Field[]; stages: Stage[]; outcomes: string; next: Next[] };

const TYPE_LABEL: Record<FieldType, string> = { text: "Kısa metin", textarea: "Uzun metin", date: "Tarih", number: "Sayı", choice: "Seçim listesi" };
const keyOf = (label: string) => label.toLocaleLowerCase("tr-TR").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30);
const emptyDraft = (): Draft => ({ label: "", summary: "", selfService: false, fields: [], stages: [{ label: "Talep", todo: "Talep bilgilerini girin" }, { label: "Yönetici onayı", approvers: ["company_admin"] }, { label: "Uygulama" }], outcomes: "Tamamlandı, Vazgeçildi", next: [] });

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await organizationFetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers as Record<string, string> || {}) } }, storedOrganization());
  if (r.status === 401) { goToLogin(); throw new Error("Giriş gerekli."); }
  if (r.status === 428) { goToMfaSetup(); throw new Error("İki aşamalı doğrulama kurulumu gerekli."); }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "İşlem tamamlanamadı.");
  return d as T;
}

export default function WorkDefinitions() {
  const [data, setData] = useState<Data | null>(null);
  const [slug, setSlug] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [newDept, setNewDept] = useState<{ name: string; short: string; mission: string; owners: string[] } | null>(null);
  const [msg, setMsg] = useState(""), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  const load = useCallback(async () => { try { const d = await call<Data>("/api/organization-workflows"); setData(d); setSlug((s) => s || d.departments[0]?.slug || ""); } catch (e) { setErr((e as Error).message); } }, []);
  useEffect(() => { void load(); }, [load]);
  const dept = data?.departments.find((d) => d.slug === slug);
  const profileLabel = useMemo(() => Object.fromEntries((data?.profiles ?? []).map((p) => [p.key, p.label])), [data]);

  const run = async (body: unknown, ok: string) => {
    setBusy(true); setErr("");
    try { const r = await call<{ slug?: string; key?: string }>("/api/organization-workflows", { method: "POST", body: JSON.stringify(body) }); setMsg(ok); await load(); return r; }
    catch (e) { setErr((e as Error).message); return null; } finally { setBusy(false); }
  };

  const edit = (t: Template, copy = false) => setDraft({
    key: copy ? undefined : t.key, version: copy ? null : t.version, label: copy ? `${t.label} (firmamız)` : t.label, summary: t.summary, selfService: !!t.selfService,
    fields: t.fields.map((f) => ({ ...f, options: Array.isArray(f.options) ? f.options.join(", ") : f.options })), stages: t.stages.map((s) => ({ ...s })),
    outcomes: t.outcomes.join(", "), next: (t.next ?? []).map((n) => ({ ...n })),
  });

  const save = async () => {
    if (!draft || !dept) return;
    const template = { ...draft, outcomes: draft.outcomes.split(",").map((x) => x.trim()).filter(Boolean),
      fields: draft.fields.map((f) => ({ ...f, key: f.key || keyOf(f.label) })),
      stages: draft.stages.map((s) => ({ ...s, key: s.key || keyOf(s.label), slaDays: s.slaDays ? Number(s.slaDays) : undefined })) };
    const r = await run({ action: "template.save", slug: dept.slug, key: draft.key, version: draft.version, template }, draft.key ? "Süreç türü güncellendi." : "Süreç türü eklendi; birim ekranında başlatılabilir.");
    if (r) setDraft(null);
  };

  if (!data) return <main className="service-shell dept-shell"><p className="service-message" role="status">{err || "Yükleniyor…"}</p></main>;
  return <main className="service-shell dept-shell wd">
    <header className="service-header dept-header"><div><Link href="/birimler">← Birimler</Link><h1>İş tanımları</h1><p>Firmanızın birimlerini ve her işin nasıl yürüdüğünü tanımlayın: aşamalar, kim yapar, kim onaylar, kaç günde biter, reddedilirse ne olur, bitince hangi birime geçer.</p></div>
      {data.canEdit && <div className="dept-header-actions"><button type="button" className="primary" onClick={() => setNewDept({ name: "", short: "", mission: "", owners: [] })}>+ Yeni birim</button></div>}</header>
    {msg && <p className="service-message" role="status">{msg}</p>}
    {err && <p className="dept-error" role="alert">{err}</p>}
    {!data.canEdit && <p className="dept-warn">Tanımları görüntülüyorsunuz. Değişikliği firma sahibi veya firma yöneticisi yapar.</p>}
    <div className="wd-grid">
      <nav className="wd-depts" aria-label="Birimler">{data.departments.map((d) => <button type="button" key={d.slug} aria-current={d.slug === slug} onClick={() => { setSlug(d.slug); setDraft(null); }}><b>{d.short}</b><span>{d.templates.length} süreç türü{d.custom ? " · firma birimi" : ""}</span></button>)}</nav>
      {dept && <section className="wd-main" aria-label={dept.name}>
        <div className="wd-dept-head"><div><h2>{dept.name}</h2><p>{dept.mission}</p>{dept.owners.length > 0 && <small>Birimi yöneten roller: {dept.owners.map((o) => profileLabel[o] ?? o).join(", ")}</small>}</div>
          {data.canEdit && <div className="service-actions"><button type="button" className="primary" onClick={() => setDraft(emptyDraft())}>+ Yeni süreç türü</button>{dept.custom && <button type="button" className="danger" disabled={busy} onClick={() => void run({ action: "department.delete", slug: dept.slug }, "Birim silindi.").then(() => setSlug(""))}>Birimi sil</button>}</div>}</div>
        {!draft && <ul className="wd-templates">{dept.templates.map((t) => <li key={t.key} className={t.active ? "" : "off"}>
          <div><b>{t.label}</b>{t.custom ? <em>Firma tanımı{t.active ? "" : " · kapalı"}</em> : <em className="muted">Hazır</em>}{t.selfService && <em className="muted">Çalışan talebi</em>}<p>{t.summary}</p>
            <ol className="wd-flow">{t.stages.map((s) => <li key={s.key ?? s.label} className={s.approvers?.length ? "ap" : ""}>{s.label}{s.approvers?.length ? ` · onay: ${s.approvers.map((a) => profileLabel[a] ?? a).join("/")}` : ""}{s.slaDays ? ` · ${s.slaDays} gün` : ""}</li>)}</ol>
            {!!t.next?.length && <small>Kapanınca: {t.next.map((n) => `${data.departments.find((d) => d.slug === n.slug)?.short ?? n.slug} · ${data.departments.find((d) => d.slug === n.slug)?.templates.find((x) => x.key === n.template)?.label ?? n.template}${n.when?.length ? ` (${n.when.join("/")})` : ""}`).join("; ")}</small>}</div>
          {data.canEdit && <div className="service-actions">{t.custom ? <><button type="button" onClick={() => edit(t)}>Düzenle</button><button type="button" disabled={busy} onClick={() => void run({ action: "template.toggle", slug: dept.slug, key: t.key, version: t.version, active: !t.active }, t.active ? "Süreç türü yeni kayıtlara kapatıldı." : "Süreç türü açıldı.")}>{t.active ? "Kapat" : "Aç"}</button></> : <button type="button" onClick={() => edit(t, true)}>Kopyala ve uyarla</button>}</div>}
        </li>)}{!dept.templates.length && <li className="wd-empty">Bu birimde henüz süreç türü yok. “Yeni süreç türü” ile ilk işi tanımlayın.</li>}</ul>}
        {draft && <Editor draft={draft} setDraft={setDraft} data={data} dept={dept} busy={busy} onSave={() => void save()} onCancel={() => setDraft(null)} />}
      </section>}
    </div>
    {newDept && <div className="wd-modal" role="dialog" aria-modal="true" aria-labelledby="wd-nd"><form onSubmit={async (e) => { e.preventDefault(); const r = await run({ action: "department.save", department: newDept }, "Birim eklendi."); if (r?.slug) { setNewDept(null); setSlug(r.slug); } }}>
      <h2 id="wd-nd">Yeni birim</h2>
      <label><span>Birim adı</span><input required minLength={2} maxLength={60} value={newDept.name} onChange={(e) => setNewDept({ ...newDept, name: e.target.value })} placeholder="Depo ve lojistik" /></label>
      <label><span>Kısa ad</span><input maxLength={24} value={newDept.short} onChange={(e) => setNewDept({ ...newDept, short: e.target.value })} placeholder="Depo" /></label>
      <label><span>Görevi</span><textarea maxLength={240} rows={2} value={newDept.mission} onChange={(e) => setNewDept({ ...newDept, mission: e.target.value })} /></label>
      <fieldset><legend>Birimi yöneten roller (firma sahibi ve yöneticisi her zaman yönetir)</legend><div className="wd-checks">{data.profiles.filter((p) => !["owner", "company_admin", "ceo"].includes(p.key)).map((p) => <label key={p.key}><input type="checkbox" checked={newDept.owners.includes(p.key)} onChange={(e) => setNewDept({ ...newDept, owners: e.target.checked ? [...newDept.owners, p.key] : newDept.owners.filter((x) => x !== p.key) })} />{p.label}</label>)}</div></fieldset>
      <div className="service-actions"><button type="submit" className="primary" disabled={busy}>Kaydet</button><button type="button" onClick={() => setNewDept(null)}>Vazgeç</button></div>
    </form></div>}
  </main>;
}

function Editor({ draft, setDraft, data, dept, busy, onSave, onCancel }: { draft: Draft; setDraft: (d: Draft) => void; data: Data; dept: Dept; busy: boolean; onSave: () => void; onCancel: () => void }) {
  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });
  const setStage = (i: number, patch: Partial<Stage>) => set({ stages: draft.stages.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const setField = (i: number, patch: Partial<Field>) => set({ fields: draft.fields.map((f, j) => (j === i ? { ...f, ...patch } : f)) });
  const move = (i: number, d: -1 | 1) => { const s = [...draft.stages]; const j = i + d; if (j < 0 || j >= s.length) return; [s[i], s[j]] = [s[j], s[i]]; set({ stages: s }); };
  const fieldKeys = draft.fields.map((f) => ({ key: f.key || keyOf(f.label), label: f.label })).filter((f) => f.key);
  const outcomes = draft.outcomes.split(",").map((x) => x.trim()).filter(Boolean);
  const targets = data.departments.flatMap((d) => d.templates.filter((t) => t.active).map((t) => ({ value: `${d.slug}|${t.key}`, label: `${d.short} · ${t.label}` })));
  return <form className="wd-editor" onSubmit={(e) => { e.preventDefault(); onSave(); }}>
    <h3>{draft.key ? "Süreç türünü düzenle" : `${dept.short}: yeni süreç türü`}</h3>
    <div className="wd-row"><label><span>Süreç adı</span><input required minLength={3} maxLength={60} value={draft.label} onChange={(e) => set({ label: e.target.value })} placeholder="Sevkiyat onayı" /></label>
      <label><span>Kısa açıklama</span><input maxLength={240} value={draft.summary} onChange={(e) => set({ summary: e.target.value })} /></label></div>
    <label className="wd-inline"><input type="checkbox" checked={draft.selfService} onChange={(e) => set({ selfService: e.target.checked })} /> Çalışanlar bu talebi kendileri başlatabilir (izin, satın alma talebi gibi). Talep eden kendi talebini onaylayamaz.</label>

    <fieldset><legend>Bilgi alanları</legend>
      {draft.fields.map((f, i) => <div className="wd-line" key={i}>
        <input aria-label="Alan adı" required minLength={2} maxLength={40} value={f.label} onChange={(e) => setField(i, { label: e.target.value })} placeholder="Alan adı" />
        <select aria-label="Alan türü" value={f.type} onChange={(e) => setField(i, { type: e.target.value as FieldType })}>{data.fieldTypes.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}</select>
        {f.type === "choice" && <input aria-label="Seçenekler" value={typeof f.options === "string" ? f.options : (f.options ?? []).join(", ")} onChange={(e) => setField(i, { options: e.target.value })} placeholder="Seçenekler (virgülle)" />}
        <label className="wd-inline"><input type="checkbox" checked={!!f.required} onChange={(e) => setField(i, { required: e.target.checked })} /> Başlarken zorunlu</label>
        <button type="button" onClick={() => set({ fields: draft.fields.filter((_, j) => j !== i) })} aria-label="Alanı sil">✕</button>
      </div>)}
      <button type="button" onClick={() => set({ fields: [...draft.fields, { label: "", type: "text" }] })}>+ Alan ekle</button>
    </fieldset>

    <fieldset><legend>Aşamalar (sırayla)</legend>
      {draft.stages.map((s, i) => <div className="wd-stage" key={i}>
        <div className="wd-line"><b>{i + 1}</b>
          <input aria-label="Aşama adı" required minLength={2} maxLength={40} value={s.label} onChange={(e) => setStage(i, { label: e.target.value })} placeholder="Aşama adı" />
          <input aria-label="Bu aşamada yapılacak iş" maxLength={200} value={s.todo ?? ""} onChange={(e) => setStage(i, { todo: e.target.value })} placeholder="Bu aşamada yapılacak iş" />
          <input aria-label="Hedef süre (gün)" type="number" min={0} max={365} value={s.slaDays ?? ""} onChange={(e) => setStage(i, { slaDays: e.target.value })} placeholder="Gün" />
          <button type="button" onClick={() => move(i, -1)} aria-label="Yukarı">↑</button><button type="button" onClick={() => move(i, 1)} aria-label="Aşağı">↓</button>
          <button type="button" disabled={draft.stages.length <= 2} onClick={() => set({ stages: draft.stages.filter((_, j) => j !== i) })} aria-label="Aşamayı sil">✕</button>
        </div>
        <details><summary>Onay, zorunlu bilgi ve ret {s.approvers?.length ? `· onay: ${s.approvers.length} rol` : ""}</summary>
          <p className="wd-hint">Onay rolü seçerseniz iş bu aşamada o rolün “Onayınızı bekleyenler” listesine düşer; birimin üyesi olmasa da yalnız bu kararı verir.</p>
          <div className="wd-checks">{data.profiles.map((p) => <label key={p.key}><input type="checkbox" checked={!!s.approvers?.includes(p.key)} onChange={(e) => setStage(i, { approvers: e.target.checked ? [...(s.approvers ?? []), p.key] : (s.approvers ?? []).filter((x) => x !== p.key) })} />{p.label}</label>)}</div>
          {!!fieldKeys.length && <><p className="wd-hint">Bu aşamadan çıkmadan önce doldurulması gereken bilgiler:</p><div className="wd-checks">{fieldKeys.map((f) => <label key={f.key}><input type="checkbox" checked={!!s.requires?.includes(f.key)} onChange={(e) => setStage(i, { requires: e.target.checked ? [...(s.requires ?? []), f.key] : (s.requires ?? []).filter((x) => x !== f.key) })} />{f.label}</label>)}</div></>}
          {!!s.approvers?.length && <label><span>Reddedilirse</span><select value={s.rejectTo ?? ""} onChange={(e) => setStage(i, { rejectTo: e.target.value || undefined })}>
            <option value="">Süreç “{data.rejectedOutcome}” sonucuyla kapanır</option>
            {draft.stages.slice(0, i).map((p) => <option key={p.key || keyOf(p.label)} value={p.key || keyOf(p.label)}>Düzeltme için “{p.label}” aşamasına geri döner</option>)}</select></label>}
        </details>
      </div>)}
      <button type="button" onClick={() => set({ stages: [...draft.stages, { label: "" }] })}>+ Aşama ekle</button>
    </fieldset>

    <fieldset><legend>Sonuçlar ve bağlantılar</legend>
      <label><span>Kapanış sonuçları (virgülle)</span><input required value={draft.outcomes} onChange={(e) => set({ outcomes: e.target.value })} /></label>
      <p className="wd-hint">Süreç kapanınca (seçerseniz yalnız belirli sonuçla) başka birimde kendiliğinden açılacak süreçler. Ret sonrası bir birime aktarmak için “{data.rejectedOutcome}” sonucunu seçin.</p>
      {draft.next.map((n, i) => <div className="wd-line" key={i}>
        <select aria-label="Açılacak süreç" value={`${n.slug}|${n.template}`} onChange={(e) => { const [slug, template] = e.target.value.split("|"); set({ next: draft.next.map((x, j) => (j === i ? { ...x, slug, template } : x)) }); }}>{targets.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select>
        <select aria-label="Hangi sonuçta" value={n.when?.[0] ?? ""} onChange={(e) => set({ next: draft.next.map((x, j) => (j === i ? { ...x, when: e.target.value ? [e.target.value] : undefined } : x)) })}><option value="">Her sonuçta</option>{[...outcomes, data.rejectedOutcome].map((o) => <option key={o} value={o}>{o}</option>)}</select>
        <button type="button" onClick={() => set({ next: draft.next.filter((_, j) => j !== i) })} aria-label="Bağlantıyı sil">✕</button>
      </div>)}
      {targets.length > 0 && <button type="button" onClick={() => { const [slug, template] = targets[0].value.split("|"); set({ next: [...draft.next, { slug, template }] }); }}>+ Bağlantı ekle</button>}
    </fieldset>
    <div className="service-actions"><button type="submit" className="primary" disabled={busy}>{busy ? "Kaydediliyor…" : "Kaydet"}</button><button type="button" onClick={onCancel}>Vazgeç</button></div>
  </form>;
}
