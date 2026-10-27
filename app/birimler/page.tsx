"use client";
import {goToLogin,goToMfaSetup} from "@/lib/workspace-navigation";
import { organizationFetch, rememberOrganization, storedOrganization } from "@/lib/org-client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import "../servis/service.css";
import "./birimler.css";
import { ScreenHelpBox } from "@/components/shared/ScreenHelpBox";

// Birimler: yönetici için kontrol merkezi (/birimler) ve her birimin tam ekran çalışma alanı (/birimler?birim=ik).
// Yönetici bir birime tıklayınca ekran tamamen o birime döner: birimin süreç türleri sekme olarak,
// her sürecin aşamaları sütun olarak görünür; bir karta tıklayınca ayrıntı, onay ve geçmiş açılır.

type Field = { key: string; label: string; type: "text" | "textarea" | "date" | "number" | "choice"; required?: boolean; options?: string[]; hint?: string };
type Stage = { key: string; label: string; todo: string; approvers?: string[]; slaDays?: number; requires?: string[] };
type Template = { key: string; label: string; summary: string; selfService?: boolean; fields: Field[]; stages: Stage[]; outcomes: string[]; note?: string; next?: NetLink[]; from?: NetLink[] };
type NetLink = { slug: string; template: string; department: string; label: string; when?: string[] };
type Network = { nodes: { slug: string; short: string; name: string; templates: number }[]; links: { from: string; fromTemplate: string; fromLabel: string; to: string; toTemplate: string; toLabel: string; when?: string[] }[]; templateCount: number };
type Filter = "all" | "open" | "awaiting" | "overdue" | "blocked";
const FILTER_LABEL: Record<Filter, string> = { all: "", open: "Açık süreçler", awaiting: "Onay bekleyenler", overdue: "Süresi geçenler", blocked: "Beklemedekiler" };
const matches = (p: Proc, f: Filter) => f === "all" || (f === "open" ? p.status === "active" || p.status === "blocked" : f === "awaiting" ? p.awaiting_approval : f === "overdue" ? p.overdue : p.status === "blocked");
type Proc = { id: string; template_key: string; title: string; stage_key: string; stage_label: string; stage_index: number; stage_count: number; status: string; priority: string; owner_name: string | null; requester_name: string | null; due_date: string | null; data: Record<string, string>; outcome: string | null; blocked_reason: string | null; version: number; stage_entered_at: string; overdue: boolean; awaiting_approval: boolean; missing: string[] };
type Summary = { slug: string; name: string; short: string; mission: string; role: string; templates: number; open: number; blocked: number; overdue: number; awaiting: number; closed30: number; attention: { id: string; title: string; stage: string; overdue: boolean; blocked: boolean }[] };
type Detail = { department: { slug: string; name: string; short: string; mission: string; modules: { id: string; label: string }[] }; role: "manage" | "member"; profile: string; organization: { id: string; name: string }; templates: Template[]; processes: Proc[]; stats: { open: number; overdue: number; blocked: number; awaiting: number } };
type Event = { action: string; from_stage: string | null; to_stage: string | null; actor_name: string | null; note: string | null; created_at: string };

const PRIORITY: Record<string, string> = { critical: "Kritik", high: "Yüksek", normal: "Normal", low: "Düşük" };
const ACTION: Record<string, string> = { create: "Başlattı", advance: "İlerletti", approve: "Onayladı", back: "Geri gönderdi", block: "Beklemeye aldı", unblock: "Beklemeyi kaldırdı", cancel: "İptal etti", update: "Bilgileri güncelledi", done: "Kapattı" };
const org = () => storedOrganization();
const slugFromUrl = () => { try { return new URLSearchParams(location.search).get("birim") || ""; } catch { return ""; } };
const daysIn = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso.replace(" ", "T") + (iso.includes("Z") ? "" : "Z")).getTime()) / 86400000));

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await organizationFetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers as Record<string, string> || {}) } }, org());
  if (r.status === 401) { goToLogin(); throw new Error("Giriş gerekli."); }
  if (r.status === 428) { goToMfaSetup(); throw new Error("İki aşamalı doğrulama kurulumu gerekli."); }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "İşlem tamamlanamadı.");
  return d as T;
}

export default function DepartmentsPage() {
  const [slug, setSlug] = useState("");
  const [view, setView] = useState("");
  useEffect(() => {
    const sync = () => { setSlug(slugFromUrl()); try { setView(new URLSearchParams(location.search).get("gorunum") || ""); } catch { setView(""); } };
    sync();
    const onPop = sync;
    addEventListener("popstate", onPop);
    return () => removeEventListener("popstate", onPop);
  }, []);
  const open = (next: string) => {
    const url = new URL(location.href);
    url.searchParams.delete("gorunum");
    if (next) url.searchParams.set("birim", next); else url.searchParams.delete("birim");
    history.pushState(null, "", url);
    setSlug(next); setView("");
    scrollTo(0, 0);
  };
  const showNetwork = () => { const url = new URL(location.href); url.searchParams.delete("birim"); url.searchParams.set("gorunum", "ag"); history.pushState(null, "", url); setSlug(""); setView("ag"); scrollTo(0, 0); };
  if (slug) return <DepartmentWorkspace key={slug} slug={slug} onBack={() => open("")} onOpen={open} />;
  const showView = (v: string) => { const url = new URL(location.href); url.searchParams.delete("birim"); url.searchParams.set("gorunum", v); history.pushState(null, "", url); setSlug(""); setView(v); scrollTo(0, 0); };
  if (view === "ag") return <NetworkView onOpen={open} onBack={() => open("")} />;
  if (view === "rapor") return <ReportView onOpen={open} onBack={() => open("")} />;
  return <Overview onOpen={open} onNetwork={showNetwork} onReport={() => showView("rapor")} />;
}

function Overview({ onOpen, onNetwork, onReport }: { onOpen: (slug: string) => void; onNetwork: () => void; onReport: () => void }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [data, setData] = useState<{ departments: Summary[]; label: string; organization: { name: string } } | null>(null);
  const [msg, setMsg] = useState("");
  useEffect(() => { call<typeof data>("/api/departments").then(setData).catch((e) => setMsg(e.message)); }, []);
  const totals = useMemo(() => (data?.departments || []).reduce((a, d) => ({ open: a.open + d.open, overdue: a.overdue + d.overdue, awaiting: a.awaiting + d.awaiting, blocked: a.blocked + d.blocked }), { open: 0, overdue: 0, awaiting: 0, blocked: 0 }), [data]);
  const sorted = useMemo(() => [...(data?.departments || [])].filter((d) => filter === "all" || d[filter] > 0).sort((a, b) => (b.overdue + b.blocked) - (a.overdue + a.blocked) || b.open - a.open), [data, filter]);
  const pick = (f: Filter) => () => setFilter(filter === f ? "all" : f);
  return <main className="service-shell dept-shell">
    <header className="service-header dept-header"><div><Link href="/panel">← Yönetim paneli</Link><h1>Birimler</h1><p>{data ? `${data.organization.name} · ${data.label}` : "Yükleniyor"} · Bir birime tıklayın, ekran o birimin çalışma alanına dönsün.</p></div>
      <div className="dept-header-actions"><button type="button" onClick={onNetwork}>Süreç ağını göster</button><button type="button" onClick={onReport}>Performans raporu</button></div></header>
    <p className="service-message" role="status">{msg}</p>
    <ScreenHelpBox screen="birimler" />
    {data && <section className="dept-kpis" aria-label="Tüm birimlerin özeti">
      <Kpi label="Açık süreç" value={totals.open} active={filter === "open"} onClick={pick("open")} />
      <Kpi label="Onay bekleyen" value={totals.awaiting} tone="gold" active={filter === "awaiting"} onClick={pick("awaiting")} />
      <Kpi label="Süresi geçen" value={totals.overdue} tone={totals.overdue ? "red" : undefined} active={filter === "overdue"} onClick={pick("overdue")} />
      <Kpi label="Beklemede" value={totals.blocked} tone={totals.blocked ? "amber" : undefined} active={filter === "blocked"} onClick={pick("blocked")} />
    </section>}
    {filter !== "all" && <p className="dept-filter">Yalnız {FILTER_LABEL[filter].toLocaleLowerCase("tr-TR")} olan birimler gösteriliyor. <button type="button" onClick={() => setFilter("all")}>Filtreyi kaldır</button></p>}
    {data && totals.open === 0 && ["Firma sahibi", "Firma yöneticisi", "Platform yetkilisi"].includes(data.label) && <div className="dept-empty"><h2>Henüz süreç yok</h2><p>Ekranların nasıl çalıştığını görmek için örnek süreçler ekleyebilirsiniz. Başlıkları “[Örnek]” ile başlar; iptal ederek kaldırabilirsiniz.</p><div className="service-actions"><button type="button" className="primary" onClick={() => call("/api/departments", { method: "POST", body: JSON.stringify({ action: "demo.seed" }) }).then(() => call<{ departments: Summary[]; label: string; organization: { name: string } }>("/api/departments").then(setData)).catch((e) => setMsg(e.message))}>Örnek süreçleri ekle</button></div></div>}
    <section className="dept-tiles" aria-label="Birim listesi">
      {sorted.map((d) => <button type="button" key={d.slug} className={`dept-tile ${d.overdue ? "alert" : ""}`} onClick={() => onOpen(d.slug)} aria-label={`${d.short} (${d.name}): ${d.open} açık, ${d.overdue} geciken. Birimi aç`}>
        <span className="dept-tile-head"><b>{d.short}</b>{d.role === "member" && <em>Talep</em>}</span>
        <span className="dept-tile-name">{d.name}</span>
        <span className="dept-tile-mission">{d.mission}</span>
        <span className="dept-chips"><i>{d.open} açık</i>{d.awaiting > 0 && <i className="gold">{d.awaiting} onay</i>}{d.overdue > 0 && <i className="red">{d.overdue} geciken</i>}{d.blocked > 0 && <i className="amber">{d.blocked} beklemede</i>}<i className="muted">30 günde {d.closed30} kapandı</i></span>
        {d.attention.length > 0 && <span className="dept-attention">{d.attention.map((a) => <span key={a.id}>• {a.title} — {a.stage}{a.overdue ? " (gecikti)" : ""}{a.blocked ? " (beklemede)" : ""}</span>)}</span>}
        <span className="dept-tile-go">Birimi aç →</span>
      </button>)}
    </section>
  </main>;
}

function Kpi({ label, value, tone, onClick, active }: { label: string; value: number; tone?: string; onClick?: () => void; active?: boolean }) {
  if (!onClick) return <div className={`dept-kpi ${tone || ""}`}><b>{value}</b><span>{label}</span></div>;
  return <button type="button" className={`dept-kpi ${tone || ""} ${active ? "on" : ""}`} aria-pressed={!!active} onClick={onClick}><b>{value}</b><span>{label}</span></button>;
}

type Report = {
  periodDays: number;
  totals: { started: number; done: number; open: number; overdue: number; onTimeRate: number | null; stageSamples: number };
  departments: { slug: string; department: string; started: number; done: number; open: number; overdue: number }[];
  templates: { department: string; slug: string; key: string; label: string; started: number; done: number; cancelled: number; open: number; overdue: number; avgDays: number | null; targetDays: number | null }[];
  bottlenecks: { department: string; slug: string; template: string; stage: string; slaDays: number | null; samples: number; avgDays: number | null; onTimeRate: number | null }[];
};
function ReportView({ onOpen, onBack }: { onOpen: (slug: string) => void; onBack: () => void }) {
  const [r, setR] = useState<Report | null>(null);
  const [msg, setMsg] = useState("");
  useEffect(() => { document.title = "Performans | Birimler | Teksanor"; call<Report>("/api/departments?view=report").then(setR).catch((e) => setMsg(e.message)); }, []);
  const d = (x: number | null) => (x === null ? "—" : x < 1 ? `${Math.round(x * 24)} sa` : `${x} gün`);
  return <main className="service-shell dept-shell">
    <header className="service-header"><div><button type="button" className="dept-back" onClick={onBack}>← Birimler</button><h1>Performans raporu</h1><p>Son {r?.periodDays ?? 180} gün · Süreler süreç olay kayıtlarından hesaplanır; hedef, süreç tanımındaki aşama süreleridir.</p></div></header>
    <p className="service-message" role="status">{msg}</p>
    {r && <>
      <section className="dept-kpis" aria-label="Özet">
        <Kpi label="Başlatılan süreç" value={r.totals.started} />
        <Kpi label="Tamamlanan" value={r.totals.done} />
        <Kpi label="Şu an geciken" value={r.totals.overdue} tone={r.totals.overdue ? "red" : undefined} />
        <div className="dept-kpi gold"><b>{r.totals.onTimeRate === null ? "—" : `%${r.totals.onTimeRate}`}</b><span>Aşamaların hedef sürede geçme oranı</span></div>
      </section>
      <section className="dept-panel report-block" aria-label="En çok bekleten aşamalar">
        <h2 className="dept-h">En çok bekleten aşamalar</h2>
        {r.bottlenecks.length ? <table className="demo-table"><thead><tr><th>Birim</th><th>Süreç</th><th>Aşama</th><th>Ortalama bekleme</th><th>Hedef</th><th>Hedefe uyum</th><th>Örnek</th></tr></thead><tbody>
          {r.bottlenecks.map((b) => <tr key={b.slug + b.template + b.stage}><td><button type="button" className="net-chip" onClick={() => onOpen(b.slug)}>{b.department}</button></td><td>{b.template}</td><td>{b.stage}</td><td>{d(b.avgDays)}</td><td>{b.slaDays ? `${b.slaDays} gün` : "—"}</td><td>{b.onTimeRate === null ? "—" : `%${b.onTimeRate}`}</td><td>{b.samples}</td></tr>)}
        </tbody></table> : <p className="checklist-muted">Henüz aşama geçişi yok. Süreçler ilerledikçe burada hangi aşamanın işi yavaşlattığı görünür.</p>}
      </section>
      <section className="dept-panel report-block" aria-label="Birimler">
        <h2 className="dept-h">Birimler</h2>
        <table className="demo-table"><thead><tr><th>Birim</th><th>Başlatılan</th><th>Tamamlanan</th><th>Açık</th><th>Geciken</th></tr></thead><tbody>
          {r.departments.map((x) => <tr key={x.slug}><td><button type="button" className="net-chip" onClick={() => onOpen(x.slug)}>{x.department}</button></td><td>{x.started}</td><td>{x.done}</td><td>{x.open}</td><td>{x.overdue}</td></tr>)}
        </tbody></table>
      </section>
      <section className="dept-panel report-block" aria-label="Süreç türleri">
        <h2 className="dept-h">Süreç türleri: ne kadar sürüyor?</h2>
        <table className="demo-table"><thead><tr><th>Birim</th><th>Süreç</th><th>Başlatılan</th><th>Tamamlanan</th><th>İptal</th><th>Açık / geciken</th><th>Ortalama süre</th><th>Hedef toplam</th></tr></thead><tbody>
          {r.templates.map((t) => <tr key={t.slug + t.key}><td>{t.department}</td><td>{t.label}</td><td>{t.started}</td><td>{t.done}</td><td>{t.cancelled}</td><td>{t.open} / {t.overdue}</td><td>{d(t.avgDays)}</td><td>{t.targetDays ? `${t.targetDays} gün` : "—"}</td></tr>)}
        </tbody></table>
      </section>
    </>}
  </main>;
}

function NetworkView({ onOpen, onBack }: { onOpen: (slug: string) => void; onBack: () => void }) {
  const [net, setNet] = useState<Network | null>(null);
  const [focus, setFocus] = useState("");
  const [msg, setMsg] = useState("");
  useEffect(() => { document.title = "Süreç ağı | Birimler | Teksanor"; call<Network>("/api/departments?view=network").then(setNet).catch((e) => setMsg(e.message)); }, []);
  const pos = useMemo(() => {
    const m: Record<string, { x: number; y: number }> = {};
    (net?.nodes || []).forEach((n, i, a) => { const t = (i / a.length) * Math.PI * 2 - Math.PI / 2; m[n.slug] = { x: 360 + Math.cos(t) * 270, y: 330 + Math.sin(t) * 270 }; });
    return m;
  }, [net]);
  const edges = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of net?.links || []) if (l.from !== l.to) { const k = `${l.from}>${l.to}`; m.set(k, (m.get(k) || 0) + 1); }
    return [...m.entries()].map(([k, n]) => { const [a, b] = k.split(">"); return { a, b, n }; });
  }, [net]);
  const shown = (net?.links || []).filter((l) => !focus || l.from === focus || l.to === focus);
  const groups = useMemo(() => { const g = new Map<string, typeof shown>(); for (const l of shown) { const k = `${l.from}/${l.fromTemplate}`; g.set(k, [...(g.get(k) || []), l]); } return [...g.values()]; }, [shown]);
  const short = (slug: string) => net?.nodes.find((n) => n.slug === slug)?.short || slug;
  return <main className="service-shell dept-shell">
    <header className="service-header"><div><button type="button" className="dept-back" onClick={onBack}>← Birimler</button><h1>Süreç ağı</h1><p>{net ? `${net.nodes.length} birim · ${net.templateCount} süreç türü · ${net.links.length} otomatik bağlantı.` : "Yükleniyor"} Bir süreç belirtilen sonuçla kapanınca oku izleyen birimde yeni süreç kendiliğinden açılır.</p></div></header>
    <p className="service-message" role="status">{msg}</p>
    {net && <div className="net-wrap">
      <svg viewBox="0 0 720 660" className="net-svg" role="group" aria-label="Birimler arası süreç bağlantıları">
        <defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="#7d8ea3" /></marker></defs>
        {edges.map((e) => { const A = pos[e.a], B = pos[e.b]; if (!A || !B) return null; const dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy) || 1; const on = !focus || e.a === focus || e.b === focus;
          return <line key={e.a + e.b} x1={A.x + (dx / L) * 40} y1={A.y + (dy / L) * 40} x2={B.x - (dx / L) * 44} y2={B.y - (dy / L) * 44} stroke={on ? (focus && e.a === focus ? "#1f6feb" : focus ? "#b45309" : "#7d8ea3") : "#e3e8ef"} strokeWidth={1 + e.n} markerEnd="url(#arr)" />; })}
        {net.nodes.map((n) => <g key={n.slug} transform={`translate(${pos[n.slug].x},${pos[n.slug].y})`} className={`net-node ${focus === n.slug ? "on" : ""}`} role="button" tabIndex={0} aria-label={`${n.short}: bağlantıları göster`} onClick={() => setFocus(focus === n.slug ? "" : n.slug)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setFocus(focus === n.slug ? "" : n.slug); } }}>
          <circle r="38" /><text y="-2" textAnchor="middle">{n.short.length > 12 ? n.short.slice(0, 11) + "…" : n.short}</text><text y="15" textAnchor="middle" className="sub">{n.templates} süreç</text>
        </g>)}
      </svg>
      <section className="net-list" aria-label="Bağlantı listesi">
        <h2 className="dept-h">{focus ? `${short(focus)} ile ilgili bağlantılar` : "Tüm bağlantılar"}</h2>
        {focus && <div className="service-actions"><button type="button" className="primary" onClick={() => onOpen(focus)}>{short(focus)} birimini aç</button><button type="button" onClick={() => setFocus("")}>Tümünü göster</button></div>}
        <ul>{groups.map((g) => <li key={g[0].from + g[0].fromTemplate}>
          <button type="button" className="net-chip" onClick={() => onOpen(g[0].from)}>{short(g[0].from)} · {g[0].fromLabel}</button>
          <span className="net-arrow" aria-hidden="true">→</span>
          <span className="net-targets">{g.map((l) => <button type="button" key={l.to + l.toTemplate} className="net-chip to" onClick={() => onOpen(l.to)} title={l.when ? `Sonuç: ${l.when.join(" / ")}` : "Her kapanışta"}>{short(l.to)} · {l.toLabel}{l.when && <small> ({l.when.join(" / ")})</small>}</button>)}</span>
        </li>)}</ul>
      </section>
    </div>}
  </main>;
}

function DepartmentWorkspace({ slug, onBack, onOpen }: { slug: string; onBack: () => void; onOpen: (slug: string) => void }) {
  const [data, setData] = useState<Detail | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [tab, setTab] = useState("all");
  const [selected, setSelected] = useState<Proc | null>(null);
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState("");
  const [showClosed, setShowClosed] = useState(false);
  const load = useCallback(async () => {
    const d = await call<Detail>(`/api/departments?slug=${encodeURIComponent(slug)}${showClosed ? "&closed=1" : ""}`);
    setData(d);rememberOrganization(d.organization.id);
    // "İşlerim" listesinden gelen bağlantı (?surec=ID) ilgili süreci doğrudan açar.
    let wanted = "";
    try { wanted = new URLSearchParams(location.search).get("surec") || ""; } catch { wanted = ""; }
    setSelected((cur) => cur ? d.processes.find((p) => p.id === cur.id) ?? null : (wanted ? d.processes.find((p) => p.id === wanted) ?? null : null));
    return d;
  }, [slug, showClosed]);
  useEffect(() => { load().catch((e) => setMsg(e.message)); }, [load]);
  useEffect(() => { if (data) document.title = `${data.department.short} | Birimler | Teksanor`; }, [data]);

  if (!data) return <main className="service-shell dept-shell"><header className="service-header"><div><button type="button" className="dept-back" onClick={onBack}>← Birimler</button><h1>Yükleniyor…</h1></div></header><p className="service-message" role="status">{msg}</p></main>;
  const { department, templates, processes, stats, role } = data;
  const tpl = templates.find((t) => t.key === tab) || null;
  const list = (tpl ? processes.filter((p) => p.template_key === tpl.key) : processes).filter((p) => matches(p, filter));
  const pick = (f: Filter) => () => setFilter(filter === f ? "all" : f);
  const tplOf = (key: string) => templates.find((t) => t.key === key);

  return <main className="service-shell dept-shell">
    <header className="service-header dept-header">
      <div>
        <button type="button" className="dept-back" onClick={onBack}>← Tüm birimler</button>
        <h1>{department.short}</h1>
        <p><b>{department.name}</b> · {department.mission}</p>
        <p className="dept-sub">{data.organization.name} · {role === "manage" ? "Birim sorumlusu görünümü: tüm süreçler" : "Çalışan görünümü: yalnız sizin talepleriniz"}</p>
      </div>
      <div className="dept-header-actions">
        <button type="button" onClick={() => { setCreating(true); setSelected(null); }}>{role === "manage" ? "Yeni süreç başlat" : "Yeni talep oluştur"}</button>
        {department.modules.map((m) => <a key={m.id} href={`/panel#panel=${m.id}`}>{m.label}</a>)}
      </div>
    </header>
    <p className="service-message" role="status">{msg}</p>
    <section className="dept-kpis" aria-label={`${department.short} özeti`}>
      <Kpi label="Açık süreç" value={stats.open} active={filter === "open"} onClick={pick("open")} />
      <Kpi label="Onay bekleyen" value={stats.awaiting} tone="gold" active={filter === "awaiting"} onClick={pick("awaiting")} />
      <Kpi label="Süresi geçen" value={stats.overdue} tone={stats.overdue ? "red" : undefined} active={filter === "overdue"} onClick={pick("overdue")} />
      <Kpi label="Beklemede" value={stats.blocked} tone={stats.blocked ? "amber" : undefined} active={filter === "blocked"} onClick={pick("blocked")} />
    </section>
    {filter !== "all" && <p className="dept-filter">{FILTER_LABEL[filter]} gösteriliyor ({list.length}). <button type="button" onClick={() => setFilter("all")}>Filtreyi kaldır</button></p>}
    <nav className="dept-tabs" aria-label="Süreç türleri">
      <button type="button" aria-pressed={tab === "all"} onClick={() => setTab("all")}>Tümü <em>{processes.filter((p) => p.status === "active" || p.status === "blocked").length}</em></button>
      {templates.map((t) => <button type="button" key={t.key} aria-pressed={tab === t.key} onClick={() => setTab(t.key)}>{t.label} <em>{processes.filter((p) => p.template_key === t.key && (p.status === "active" || p.status === "blocked")).length}</em></button>)}
      <label className="dept-closed"><input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} /> Kapananları da göster</label>
    </nav>

    <div className={`dept-body ${selected || creating ? "with-panel" : ""}`}>
      <section aria-label="Süreçler">
        {tpl ? <>
          <p className="dept-template-summary"><b>{tpl.label}:</b> {tpl.summary}{tpl.note && <span className="dept-note"> {tpl.note}</span>}</p>
          <NetChips t={tpl} onOpen={onOpen} />
          <div className="dept-board" role="region" aria-label={`${tpl.label} aşamaları`} tabIndex={0}>
            {tpl.stages.map((s, i) => { const items = list.filter((p) => p.stage_key === s.key && p.status !== "done" && p.status !== "cancelled"); return <div className="dept-col" key={s.key}>
              <div className="dept-col-head"><span>{i + 1}. {s.label}</span><em>{items.length}</em></div>
              <small className="dept-col-todo">{s.todo}{s.approvers?.length ? " · Onay adımı" : ""}{s.slaDays ? ` · hedef ${s.slaDays} gün` : ""}</small>
              {items.map((p) => <Card key={p.id} p={p} active={selected?.id === p.id} onOpen={() => { setSelected(p); setCreating(false); }} />)}
            </div>; })}
          </div>
          {showClosed && <ClosedList items={list.filter((p) => p.status === "done" || p.status === "cancelled")} onOpen={(p) => setSelected(p)} />}
        </> : <>
          {processes.length === 0 && <div className="dept-empty"><h2>Bu birimde henüz süreç yok</h2><p>{role === "manage" ? "Sağ üstteki düğmeyle ilk süreci başlatın. Örnek: " : "Talep oluşturabileceğiniz süreçler: "}{templates.map((t) => t.label).join(", ")}.</p></div>}
          {processes.length > 0 && list.length === 0 && <p className="checklist-muted">Bu filtreye uyan süreç yok.</p>}
          <div className="dept-list">{list.map((p) => <Card key={p.id} p={p} wide template={tplOf(p.template_key)?.label} active={selected?.id === p.id} onOpen={() => { setSelected(p); setCreating(false); }} />)}</div>
        </>}
      </section>
      {creating && <CreatePanel templates={templates} slug={slug} role={role} initial={tpl?.key} onClose={() => setCreating(false)} onDone={async (id) => { setCreating(false); setMsg("Süreç başlatıldı."); const d = await load(); setSelected(d.processes.find((p) => p.id === id) ?? null); }} />}
      {selected && tplOf(selected.template_key) && <ProcessPanel key={selected.id + selected.version} p={selected} template={tplOf(selected.template_key)!} slug={slug} role={role} onOpenDept={onOpen} onClose={() => setSelected(null)} onChanged={async (text) => { setMsg(text); await load(); }} />}
    </div>
  </main>;
}

function NetChips({ t, onOpen }: { t: Template; onOpen: (slug: string) => void }) {
  if (!t.next?.length && !t.from?.length) return null;
  return <div className="net-inline">
    {!!t.from?.length && <p><b>Şuradan gelir:</b> {t.from.map((f) => <button type="button" key={f.slug + f.template} className="net-chip" onClick={() => onOpen(f.slug)}>{f.department} · {f.label}</button>)}</p>}
    {!!t.next?.length && <p><b>Kapanınca başlatır:</b> {t.next.map((n) => <button type="button" key={n.slug + n.template} className="net-chip to" onClick={() => onOpen(n.slug)}>{n.department} · {n.label}{n.when && <small> ({n.when.join(" / ")})</small>}</button>)}</p>}
  </div>;
}

function Card({ p, onOpen, active, wide, template }: { p: Proc; onOpen: () => void; active: boolean; wide?: boolean; template?: string }) {
  const days = daysIn(p.stage_entered_at);
  return <button type="button" className={`dept-card ${active ? "selected" : ""} ${p.overdue ? "overdue" : ""} ${p.status}`} onClick={onOpen} aria-label={`${p.title}, ${p.stage_label}${p.overdue ? ", süresi geçti" : ""}`}>
    <span className="dept-card-top">{template && <small>{template}</small>}<i className={`prio ${p.priority}`}>{p.priority === "critical" && <span aria-hidden="true">★ </span>}{PRIORITY[p.priority]}</i></span>
    <strong>{p.title}</strong>
    {wide && <span className="dept-progress" aria-hidden="true"><b style={{ width: `${p.stage_count ? ((p.stage_index + (p.status === "done" ? 1 : 0)) / p.stage_count) * 100 : 0}%` }} /></span>}
    <span className="dept-card-meta">{wide && <>{p.stage_label} · </>}{p.status === "done" ? `Kapandı: ${p.outcome}` : p.status === "cancelled" ? "İptal edildi" : `${days} gündür bu aşamada`}</span>
    <span className="dept-card-meta">{p.owner_name ? `Sorumlu: ${p.owner_name}` : `Talep: ${p.requester_name || "—"}`}{p.due_date ? ` · Hedef ${p.due_date}` : ""}</span>
    {(p.awaiting_approval || p.overdue || p.status === "blocked" || p.missing.length > 0) && <span className="dept-flags">
      {p.awaiting_approval && <i className="gold">Onay bekliyor</i>}{p.overdue && <i className="red">Gecikti</i>}{p.status === "blocked" && <i className="amber">Beklemede</i>}{p.missing.length > 0 && <i>Eksik: {p.missing.length}</i>}
    </span>}
  </button>;
}

function ClosedList({ items, onOpen }: { items: Proc[]; onOpen: (p: Proc) => void }) {
  if (!items.length) return null;
  return <section className="dept-closed-list"><h2>Kapananlar</h2><div className="dept-list">{items.map((p) => <Card key={p.id} p={p} wide active={false} onOpen={() => onOpen(p)} />)}</div></section>;
}

function FieldInput({ f, value, onChange, disabled }: { f: Field; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const id = `f-${f.key}`;
  return <label htmlFor={id} className={f.type === "textarea" ? "full" : ""}><span>{f.label}{f.required ? " *" : ""}</span>
    {f.type === "textarea" ? <textarea id={id} rows={3} value={value} disabled={disabled} placeholder={f.hint} onChange={(e) => onChange(e.target.value)} />
      : f.type === "choice" ? <select id={id} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}><option value="">Seçin</option>{f.options?.map((o) => <option key={o}>{o}</option>)}</select>
      : <input id={id} type={f.type === "number" ? "text" : f.type} inputMode={f.type === "number" ? "decimal" : undefined} value={value} disabled={disabled} placeholder={f.hint} onChange={(e) => onChange(e.target.value)} />}
  </label>;
}

function CreatePanel({ templates, slug, role, initial, onClose, onDone }: { templates: Template[]; slug: string; role: string; initial?: string; onClose: () => void; onDone: (id: string) => void }) {
  const [key, setKey] = useState(initial || templates[0]?.key || "");
  const [title, setTitle] = useState(""), [priority, setPriority] = useState("normal"), [due, setDue] = useState(""), [owner, setOwner] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  const t = templates.find((x) => x.key === key);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (!t) return; setBusy(true); setErr("");
    try { const r = await call<{ id: string }>("/api/departments", { method: "POST", body: JSON.stringify({ action: "create", slug, template: key, title, priority, dueDate: due, ownerName: owner, data: Object.fromEntries(Object.entries(values).filter(([k]) => t.fields.some((f) => f.key === k))) }) }); onDone(r.id); }
    catch (x) { setErr(x instanceof Error ? x.message : "Kaydedilemedi."); } finally { setBusy(false); }
  }
  return <aside className="dept-panel" aria-label="Yeni süreç">
    <div className="dept-panel-head"><h2>{role === "manage" ? "Yeni süreç" : "Yeni talep"}</h2><button type="button" onClick={onClose} aria-label="Kapat">✕</button></div>
    <form onSubmit={submit} className="dept-form">
      <fieldset><legend>Süreç türü</legend>{templates.map((x) => <label key={x.key} className={`dept-choice ${key === x.key ? "on" : ""}`}><input type="radio" name="tpl" checked={key === x.key} onChange={() => { setKey(x.key); setValues({}); }} /><span><b>{x.label}</b><small>{x.summary}</small></span></label>)}</fieldset>
      {t && <>
        <ol className="dept-steps-mini">{t.stages.map((s) => <li key={s.key}>{s.label}{s.approvers?.length ? " ✓" : ""}</li>)}</ol>
        <label><span>Başlık *</span><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`Örn. ${t.label} – ${new Date().toLocaleDateString("tr-TR")}`} required minLength={3} /></label>
        {t.fields.map((f) => <FieldInput key={f.key} f={f} value={values[f.key] || ""} onChange={(v) => setValues({ ...values, [f.key]: v })} />)}
        <div className="dept-row"><label><span>Öncelik</span><select value={priority} onChange={(e) => setPriority(e.target.value)}>{Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label><label><span>Hedef tarih</span><input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></label></div>
        {role === "manage" && <label><span>Sorumlu</span><input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Ad soyad veya ekip" /></label>}
        {t.note && <p className="dept-note">{t.note}</p>}
      </>}
      {err && <p className="dept-error" role="alert">{err}</p>}
      <div className="service-actions"><button type="submit" className="primary" disabled={busy}>{busy ? "Kaydediliyor…" : "Başlat"}</button><button type="button" onClick={onClose}>Vazgeç</button></div>
    </form>
  </aside>;
}

function ProcessPanel({ p, template, slug, role, onClose, onChanged, onOpenDept }: { p: Proc; template: Template; slug: string; role: string; onClose: () => void; onChanged: (msg: string) => Promise<void>; onOpenDept: (slug: string) => void }) {
  const [values, setValues] = useState<Record<string, string>>(p.data);
  const [note, setNote] = useState(""), [outcome, setOutcome] = useState(""), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  useEffect(() => { call<{ events: Event[] }>(`/api/departments?slug=${slug}&process=${p.id}`).then((d) => setEvents(d.events)).catch(() => setEvents([])); }, [slug, p.id, p.version]);
  const stage = template.stages[p.stage_index];
  const next = template.stages[p.stage_index + 1];
  const closed = p.status === "done" || p.status === "cancelled";
  const editable = !closed && (role === "manage" || p.stage_index === 0);
  const changed = template.fields.some((f) => (values[f.key] || "") !== (p.data[f.key] || ""));
  const stageName = (k: string | null) => template.stages.find((s) => s.key === k)?.label || "";
  async function act(action: string, extra: Record<string, unknown> = {}, done = "") {
    setBusy(true); setErr("");
    try {
      const r = await call<{ started?: { department: string; label: string }[] }>("/api/departments", { method: "POST", body: JSON.stringify({ action, slug, id: p.id, version: p.version, note, ...extra }) });
      await onChanged(r.started?.length ? `${done} Otomatik başlatılanlar: ${r.started.map((x) => `${x.department} · ${x.label}`).join(", ")}.` : done);
    }
    catch (x) { setErr(x instanceof Error ? x.message : "İşlem tamamlanamadı."); } finally { setBusy(false); }
  }
  const dataPayload = () => Object.fromEntries(template.fields.map((f) => [f.key, values[f.key] || ""]));
  return <aside className="dept-panel" aria-label={`Süreç: ${p.title}`}>
    <div className="dept-panel-head"><div><small>{template.label}</small><h2>{p.title}</h2></div><button type="button" onClick={onClose} aria-label="Kapat">✕</button></div>
    <ol className="dept-stepper" aria-label="Aşamalar">{template.stages.map((s, i) => <li key={s.key} className={i < p.stage_index || p.status === "done" ? "done" : i === p.stage_index && !closed ? "current" : ""} aria-current={i === p.stage_index && !closed ? "step" : undefined}><span>{i + 1}</span>{s.label}</li>)}</ol>
    {!closed && stage && <div className="dept-now"><b>Şimdi:</b> {stage.todo}{stage.approvers?.length ? <em> Bu bir onay adımıdır.</em> : null}{stage.slaDays ? <small> Hedef süre {stage.slaDays} gün; {daysIn(p.stage_entered_at)} gündür bu aşamada.</small> : null}</div>}
    {p.status === "blocked" && <p className="dept-warn">Beklemede: {p.blocked_reason}</p>}
    {p.missing.length > 0 && !closed && <p className="dept-warn">Bu aşamayı geçmek için doldurun: {p.missing.join(", ")}</p>}
    {closed && <p className="dept-now"><b>{p.status === "done" ? "Kapandı" : "İptal edildi"}:</b> {p.outcome}</p>}
    {!!(template.next?.length || template.from?.length) && <details className="net-details"><summary>Bu sürecin bağlantıları</summary><NetChips t={template} onOpen={onOpenDept} /></details>}
    <div className="dept-form">
      {template.fields.map((f) => <FieldInput key={f.key} f={f} value={values[f.key] || ""} disabled={!editable} onChange={(v) => setValues({ ...values, [f.key]: v })} />)}
      {editable && changed && <div className="service-actions"><button type="button" disabled={busy} onClick={() => void act("update", { data: dataPayload() }, "Bilgiler kaydedildi.")}>Bilgileri kaydet</button></div>}
    </div>
    {!closed && <div className="dept-actions">
      <label><span>Not (geri gönderme, bekletme ve iptalde zorunlu)</span><textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></label>
      {role === "manage" && <>
        {!next && <label><span>Sonuç</span><select value={outcome} onChange={(e) => setOutcome(e.target.value)}><option value="">Seçin</option>{template.outcomes.map((o) => <option key={o}>{o}</option>)}</select></label>}
        {!next && outcome && !!template.next?.length && (() => { const go = template.next.filter((n) => !n.when || n.when.includes(outcome)); return <p className="net-preview">{go.length ? <>Bu sonuçla kapanınca otomatik açılacak: {go.map((n) => <b key={n.slug + n.template}>{n.department} · {n.label}</b>)}</> : "Bu sonuçla başka birimde süreç açılmaz."}</p>; })()}
        <div className="service-actions">
          <button type="button" className="primary" disabled={busy || p.status === "blocked"} onClick={() => void act("advance", { data: dataPayload(), outcome }, next ? `${next.label} aşamasına geçti.` : "Süreç kapandı.")}>{stage?.approvers?.length ? "Onayla ve " : ""}{next ? `ilerlet → ${next.label}` : "Süreci kapat"}</button>
          {p.stage_index > 0 && <button type="button" disabled={busy} onClick={() => void act("back", {}, "Önceki aşamaya gönderildi.")}>Geri gönder</button>}
          {p.status === "blocked" ? <button type="button" disabled={busy} onClick={() => void act("unblock", {}, "Bekleme kaldırıldı.")}>Beklemeyi kaldır</button> : <button type="button" disabled={busy} onClick={() => void act("block", {}, "Beklemeye alındı.")}>Beklet</button>}
          <button type="button" className="danger" disabled={busy} onClick={() => void act("cancel", {}, "İptal edildi.")}>İptal et</button>
        </div>
      </>}
      {role !== "manage" && p.stage_index === 0 && <div className="service-actions"><button type="button" className="danger" disabled={busy} onClick={() => void act("cancel", {}, "Talep geri çekildi.")}>Talebi geri çek</button></div>}
      {role !== "manage" && p.stage_index > 0 && <p className="checklist-muted">Talebiniz işleme alındı; ilerleyişi buradan izleyebilirsiniz.</p>}
    </div>}
    {err && <p className="dept-error" role="alert">{err}</p>}
    <section className="dept-timeline" aria-label="Geçmiş"><h3>Geçmiş</h3><ol>{events.map((e, i) => <li key={i}><b>{e.actor_name || "—"}</b> {ACTION[e.action] || e.action}{e.to_stage && e.action !== "update" && e.action !== "block" && e.action !== "unblock" ? `: ${stageName(e.to_stage)}` : ""}{e.note ? <q>{e.note}</q> : null}<small>{new Date(e.created_at.replace(" ", "T") + "Z").toLocaleString("tr-TR")}</small></li>)}</ol></section>
  </aside>;
}
