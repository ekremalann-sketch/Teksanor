"use client";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { ArrowLeft, KeyRound, Search, ShieldCheck, UserCheck, UserX, Users } from "lucide-react";
import { goToLogin } from "@/lib/workspace-navigation";
import { organizationFetch, rememberOrganization, storedOrganization } from "@/lib/org-client";
import { accessRules, type AccessProfile } from "@/lib/access-rules";

type Member = { id: string; username: string; full_name: string; role: string; active: number; access_profile?: string | null; job_role?: string | null; department?: string | null };
type Filter = "all" | "active" | "closed";
type Pending = { member: Member; kind: "toggle" | "reset" } | null;

const MEMBERSHIP: Record<string, string> = { owner: "Firma sahibi", admin: "Firma yöneticisi", member: "Üye" };
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toLocaleUpperCase("tr-TR") || "?";
const profileLabel = (member: Member) => (member.access_profile && accessRules[member.access_profile as AccessProfile]?.label) || MEMBERSHIP[member.role] || member.role;

// Kullanıcı erişimleri: özet, arama, durum filtresi ve satır işlemleri.
// Hassas işlemlerde (erişim kapatma/açma, parola sıfırlama) yöneticinin kendi parolası istenir; işlem kayda geçer.
export default function UsersAccessPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [current, setCurrent] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [pending, setPending] = useState<Pending>(null);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [temporary, setTemporary] = useState<{ name: string; password: string } | null>(null);
  const deferredQuery = useDeferredValue(query);

  async function load() {
    const response = await organizationFetch("/api/users", {}, storedOrganization());
    if (response.status === 401) { goToLogin(); return; }
    const body = await response.json().catch(() => ({})) as { users?: Member[]; currentUserId?: string; organizationId?: string; error?: string };
    if (!response.ok) { setError(body.error || "Kullanıcılar alınamadı."); setLoading(false); return; }
    if (body.organizationId) rememberOrganization(body.organizationId);
    setMembers(body.users ?? []); setCurrent(body.currentUserId ?? ""); setLoading(false);
  }
  useEffect(() => { void load().catch(() => { setError("Kullanıcılar alınamadı."); setLoading(false); }); }, []);

  const counts = useMemo(() => ({ all: members.length, active: members.filter((m) => m.active).length, closed: members.filter((m) => !m.active).length }), [members]);
  const list = useMemo(() => {
    const q = deferredQuery.trim().toLocaleLowerCase("tr-TR");
    return members.filter((m) => (filter === "all" || (filter === "active" ? m.active : !m.active))
      && (!q || [m.full_name, m.username, m.department, m.job_role, profileLabel(m)].some((value) => (value || "").toLocaleLowerCase("tr-TR").includes(q))));
  }, [members, filter, deferredQuery]);

  async function confirm() {
    if (!pending) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const body = pending.kind === "reset" ? { action: "reset-password", password } : { active: !pending.member.active, password };
      const response = await organizationFetch(`/api/users/${encodeURIComponent(pending.member.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }, storedOrganization());
      const result = await response.json().catch(() => ({})) as { error?: string; temporaryPassword?: string };
      if (!response.ok) throw new Error(result.error || "İşlem tamamlanamadı.");
      if (result.temporaryPassword) setTemporary({ name: pending.member.full_name, password: result.temporaryPassword });
      else setNotice(pending.member.active ? `${pending.member.full_name} için erişim kapatıldı; açık oturumları sonlandırıldı.` : `${pending.member.full_name} için erişim açıldı.`);
      setPending(null); setPassword("");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "İşlem tamamlanamadı.");
    } finally { setBusy(false); }
  }

  return <main className="users-page">
    <header className="users-header">
      <a className="users-back" href="/panel#panel=admin"><ArrowLeft size={17} /> Yönetim merkezi</a>
      <div><span className="users-kicker">YÖNETİM</span><h1>Kullanıcı erişimleri</h1><p>Ekip hesaplarını, rollerini ve erişim durumlarını yönetin. Kayıtlar silinmez; kapatılan erişim yeniden açılabilir.</p></div>
    </header>

    <section className="users-stats" aria-label="Özet">
      <article><Users size={19} /><b>{counts.all}</b><span>Toplam kullanıcı</span></article>
      <article><UserCheck size={19} /><b>{counts.active}</b><span>Erişimi açık</span></article>
      <article><UserX size={19} /><b>{counts.closed}</b><span>Erişimi kapalı</span></article>
    </section>

    <section className="users-card">
      <div className="users-toolbar">
        <label className="users-search"><Search size={16} /><span className="sr-only">Kullanıcı ara</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ad, kullanıcı adı, birim veya rol ara" /></label>
        <div className="users-filter" role="tablist" aria-label="Durum">
          {([["all", "Tümü"], ["active", "Açık"], ["closed", "Kapalı"]] as [Filter, string][]).map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={filter === key} className={filter === key ? "active" : ""} onClick={() => setFilter(key)}>{label} <em>{counts[key]}</em></button>)}
        </div>
      </div>

      {error && <p className="users-alert error" role="alert">{error}</p>}
      {notice && <p className="users-alert ok" role="status">{notice}</p>}
      {temporary && <div className="users-alert temp" role="status"><KeyRound size={16} /><span><b>{temporary.name}</b> için geçici parola: <code>{temporary.password}</code><small>Yalnız bir kez gösterilir. Kişiye güvenli bir kanaldan iletin; ilk girişte değiştirmesini isteyin.</small></span><button type="button" onClick={() => setTemporary(null)}>Kapat</button></div>}

      {loading ? <p className="users-empty">Yükleniyor…</p> : list.length === 0 ? <p className="users-empty">Bu filtreye uyan kullanıcı yok.</p> :
        <ul className="users-list">
          {list.map((member) => {
            const self = member.id === current;
            return <li key={member.id} className={member.active ? "" : "closed"}>
              <span className="users-avatar" aria-hidden="true">{initials(member.full_name)}</span>
              <span className="users-name"><b>{member.full_name}{self && <em> (siz)</em>}</b><small>{member.username}</small></span>
              <span className="users-role"><b>{profileLabel(member)}</b><small>{[member.department, member.job_role && member.job_role !== member.access_profile ? member.job_role : null].filter(Boolean).join(" · ") || "Birim atanmadı"}</small></span>
              <span className={`users-state ${member.active ? "on" : "off"}`}>{member.active ? "Açık" : "Kapalı"}</span>
              <span className="users-actions">
                {!!member.active && <button type="button" className="ghost" disabled={busy} onClick={() => { setPending({ member, kind: "reset" }); setPassword(""); }}>Parola sıfırla</button>}
                <button type="button" className={member.active ? "danger" : "ghost"} disabled={busy || self} title={self ? "Kendi erişiminizi değiştiremezsiniz" : undefined} onClick={() => { setPending({ member, kind: "toggle" }); setPassword(""); }}>{member.active ? "Erişimi kapat" : "Erişimi aç"}</button>
              </span>
            </li>;
          })}
        </ul>}
    </section>

    {pending && <div className="users-confirm" role="dialog" aria-modal="true" aria-label="İşlemi onayla" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setPending(null); }}>
      <form onSubmit={(event) => { event.preventDefault(); void confirm(); }}>
        <ShieldCheck size={22} />
        <h2>{pending.kind === "reset" ? "Geçici parola atansın mı?" : pending.member.active ? "Erişim kapatılsın mı?" : "Erişim açılsın mı?"}</h2>
        <p>{pending.kind === "reset" ? `${pending.member.full_name} için yeni bir geçici parola üretilir ve açık oturumları kapatılır.` : pending.member.active ? `${pending.member.full_name} artık bu firmaya giriş yapamaz; açık oturumları hemen sonlandırılır.` : `${pending.member.full_name} yeniden giriş yapabilir.`}</p>
        <label><span>Kendi Teksanor parolanız <b className="field-star" aria-hidden="true">*</b></span><input type="password" required aria-required="true" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} autoFocus /><small>Güvenlik için hassas işlemlerde parolanız yeniden doğrulanır.</small></label>
        <div><button type="button" className="ghost" disabled={busy} onClick={() => setPending(null)}>Vazgeç</button><button type="submit" className={pending.kind === "toggle" && pending.member.active ? "danger" : "primary"} disabled={busy || !password}>{busy ? "İşleniyor…" : "Onayla"}</button></div>
      </form>
    </div>}
  </main>;
}
