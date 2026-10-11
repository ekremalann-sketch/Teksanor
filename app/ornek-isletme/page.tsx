"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import "../servis/service.css";
import "../birimler/birimler.css";
import { ScreenHelpBox } from "@/components/shared/ScreenHelpBox";

// Örnek işletme oluşturma (yalnız platform yöneticisi).
// Yönetici her rol için kullanıcı adını ve parolayı kendisi yazar; parola sunucuda yalnız özet olarak saklanır.
type Role = { username: string; fullName: string; accessProfile: string; department?: string; jobRole?: string };
type Company = { organizationId: string; name: string; createdAt: string; stepsDone: number; complete: boolean; nextPart: "a" | "b" | "c" | null };
type Result = { organization: { id: string; name: string }; accounts: { username: string; role: string }[]; counts: Record<string, number> };
const PROFILE: Record<string, string> = { owner: "Firma sahibi", manager: "Birim yöneticisi", hr: "İnsan kaynakları", finance: "Finans", it: "Bilgi işlem", employee: "Çalışan / teknisyen" };

export default function DemoCompanyPage() {
  const [roles, setRoles] = useState<(Role & { password: string; show: boolean; roleKey: string })[]>([]);
  const [pending, setPending] = useState<{ created: Omit<Result, "counts">; part: number; counts: Record<string, number> } | null>(null);
  const [name, setName] = useState("Örnek · Klima ve Teknik Servis (örnek)");
  const [msg, setMsg] = useState(""), [busy, setBusy] = useState(false), [result, setResult] = useState<Result | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  useEffect(() => {
    fetch("/api/organizations/demo", { cache: "no-store" }).then(async (r) => {
      if (r.status === 401) { location.href = "/giris"; return; }
      const d = await r.json();
      if (!r.ok) { setMsg(d.error || "Bu sayfa yalnız platform yöneticisine açıktır."); return; }
      setRoles((d.roles as Role[]).map((x) => ({ ...x, roleKey: x.username, password: "", show: false })));
      setCompanies(d.companies ?? []);
    }).catch(() => setMsg("Bağlantı kurulamadı."));
  }, []);
  const set = (i: number, patch: Partial<(typeof roles)[number]>) => setRoles(roles.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  // Veri parçalarını sırayla ekler; yarıda kalan kurulumda kaldığı yerden devam eder.
  async function runParts(organizationId: string, from: "a" | "b" | "c") {
    const counts: Record<string, number> = {};
    const parts = (["a", "b", "c"] as const).slice(["a", "b", "c"].indexOf(from));
    for (const part of parts) {
      setMsg(`Örnek kayıtlar ekleniyor (${part === "a" ? "1" : part === "b" ? "2" : "3"}/3)…`);
      const s = await fetch("/api/organizations/demo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "seed", organizationId, part }) });
      const sd = await s.json();
      if (!s.ok) throw new Error(`Kurulum ${part === "a" ? "1" : part === "b" ? "2" : "3"}. adımda durdu: ${sd.error || "bilinmeyen hata"}. Firma ve hesaplar duruyor; aşağıdaki "Yarım kalan kurulumlar" listesinden devam edebilirsiniz.`);
      Object.assign(counts, sd.counts);
    }
    return counts;
  }
  async function refreshList() { try { const r = await fetch("/api/organizations/demo", { cache: "no-store" }); if (r.ok) setCompanies((await r.json()).companies ?? []); } catch { /* yoksay */ } }
  async function resume(c: Company) {
    if (!c.nextPart) return;
    setBusy(true); setMsg("");
    try { const counts = await runParts(c.organizationId, c.nextPart); setMsg(`Kurulum tamamlandı: ${Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(" · ")}.`); }
    catch (x) { setMsg(x instanceof Error ? x.message : "Devam edilemedi."); } finally { setBusy(false); void refreshList(); }
  }
  function openCompany(id: string) { try { localStorage.setItem("teksanor_organization", id); } catch { /* yoksay */ } location.href = "/panel"; }
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/organizations/demo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, accounts: roles.filter((x) => x.password).map((x) => ({ username: x.username, password: x.password, fullName: x.fullName, accessProfile: x.accessProfile, roleKey: x.roleKey })) }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Oluşturulamadı.");
      setRoles(roles.map((x) => ({ ...x, password: "" })));
      const counts = await runParts(d.organization.id, "a");
      setMsg("");
      setResult({ ...d, counts }); setRoles(roles.map((x) => ({ ...x, password: "" })));
    } catch (x) { setMsg(x instanceof Error ? x.message : "Oluşturulamadı."); } finally { setBusy(false); void refreshList(); }
  }
  function openPanel() { try { if (result) localStorage.setItem("teksanor_organization", result.organization.id); } catch { /* yoksay */ } location.href = "/panel"; }

  return <main className="service-shell dept-shell">
    <header className="service-header"><div><Link href="/panel">← Yönetim paneli</Link><h1>Örnek işletme</h1><p>Teksanor'un dolu bir şirkette nasıl çalıştığını görmek ve göstermek için sentetik bir firma oluşturur.</p></div></header>
    <p className="service-message" role="status">{msg}</p>
    <ScreenHelpBox screen="ornek-isletme" />
    {companies.length > 0 && <section className="dept-panel" style={{ position: "static", maxHeight: "none" }} aria-label="Örnek işletmeler">
      <h2 className="dept-h">Oluşturulan örnek işletmeler</h2>
      <table className="demo-table"><thead><tr><th>Firma</th><th>Kurulum</th><th>İşlem</th></tr></thead><tbody>
        {companies.map((c) => <tr key={c.organizationId}><td><b>{c.name}</b><br /><small>{new Date(c.createdAt.replace(" ", "T") + "Z").toLocaleString("tr-TR")}</small></td>
          <td>{c.complete ? "Tamamlandı" : `Yarım kaldı (${c.stepsDone}/4 adım)`}</td>
          <td><span className="service-actions">{!c.complete && <button type="button" className="primary" disabled={busy} onClick={() => void resume(c)}>Kuruluma devam et</button>}<button type="button" onClick={() => openCompany(c.organizationId)}>Paneline geç</button></span></td></tr>)}
      </tbody></table>
      <p className="checklist-muted">Her kurulum adımı tek işlemdir: bir adım hata verirse o adımın hiçbir kaydı kalmaz ve buradan aynı adımdan devam edilir.</p>
    </section>}
    {result ? <section className="dept-panel" style={{ position: "static", maxHeight: "none" }}>
      <h2 className="dept-h">Hazır: {result.organization.name}</h2>
      <p>Oluşturulan kayıtlar: {Object.entries(result.counts).map(([k, v]) => `${v} ${k}`).join(" · ")}.</p>
      <table className="demo-table"><thead><tr><th>Kullanıcı adı</th><th>Rol</th></tr></thead><tbody>{result.accounts.map((a) => <tr key={a.username}><td>{a.username}</td><td>{a.role}</td></tr>)}</tbody></table>
      <p className="checklist-muted">Parolaları sizin yazdığınız gibi ilgili kişilere güvenli bir kanaldan iletin. Parolalar burada tekrar gösterilmez.</p>
      <div className="service-actions"><button type="button" className="primary" onClick={openPanel}>Örnek firmanın paneline geç</button><a href={`/birimler?organizationId=${encodeURIComponent(result.organization.id)}`}>Birimler kontrol merkezi</a></div>
    </section> : <form onSubmit={submit} className="dept-form">
      <section className="dept-panel" style={{ position: "static", maxHeight: "none" }}>
        <h2 className="dept-h">1. Firma</h2>
        <label><span>Firma adı</span><input value={name} onChange={(e) => setName(e.target.value)} required minLength={3} maxLength={120} /></label>
        <p className="checklist-muted">Varsayılan örnek: 15 çalışanı olan, İzmir'de klima, soğutma ve jeneratör servisi veren bir firma. 8 müşteri, 6 cihaz, 10 servis işi (talepten tahsilata her aşamada), 28 birim süreci, görevler, projeler, riskler, satın alma, ödeme ve gider kayıtları birlikte oluşur. Tüm adlar ve tutarlar uydurmadır.</p>
      </section>
      <section className="dept-panel" style={{ position: "static", maxHeight: "none" }}>
        <h2 className="dept-h">2. Hesaplar (kullanıcı adı ve parolayı siz belirleyin)</h2>
        <p className="checklist-muted">Firma sahibi zorunludur. Parolasını boş bıraktığınız rol için hesap açılmaz; sonradan panelde Kullanıcılar ekranından eklenebilir. Parola en az 10 karakter olmalı.</p>
        <table className="demo-table"><thead><tr><th>Rol</th><th>Görünen ad</th><th>Kullanıcı adı</th><th>Parola</th></tr></thead><tbody>
          {roles.map((r, i) => <tr key={r.roleKey}>
            <td><b>{PROFILE[r.accessProfile] ?? r.accessProfile}</b>{r.accessProfile === "owner" && <small> · zorunlu</small>}</td>
            <td><input aria-label={`${PROFILE[r.accessProfile]} görünen ad`} value={r.fullName} onChange={(e) => set(i, { fullName: e.target.value })} /></td>
            <td><input aria-label={`${PROFILE[r.accessProfile]} kullanıcı adı`} value={r.username} pattern="[a-z0-9._-]{3,32}" onChange={(e) => set(i, { username: e.target.value.toLowerCase() })} /></td>
            <td><span className="demo-pass"><input aria-label={`${PROFILE[r.accessProfile]} parola`} type={r.show ? "text" : "password"} value={r.password} minLength={r.password ? 10 : undefined} autoComplete="new-password" required={!pending && r.accessProfile === "owner"} onChange={(e) => set(i, { password: e.target.value })} /><button type="button" onClick={() => set(i, { show: !r.show })}>{r.show ? "Gizle" : "Göster"}</button></span></td>
          </tr>)}
        </tbody></table>
        <div className="service-actions"><button type="submit" className="primary" disabled={busy || !roles.length}>{busy ? "Oluşturuluyor…" : pending ? "Kuruluma devam et" : "Örnek işletmeyi oluştur"}</button></div>
      </section>
      <section className="dept-panel" style={{ position: "static", maxHeight: "none" }}>
        <h2 className="dept-h">Teksanor'da bir işletme nasıl görünür?</h2>
        <ul className="demo-list">
          <li><b>Firma hesabı:</b> şirketin adı, vergi bilgileri ve deneme planı. Her firmanın verisi ayrı tutulur.</li>
          <li><b>Kişiler:</b> firma sahibi her şeyi görür; birim yöneticisi kendi birimini, teknisyen yalnız kendine atanan işleri görür.</li>
          <li><b>Saha servisi:</b> müşteri talebi → teklif → müşteri onayı → saha formu → imza → tahsilat.</li>
          <li><b>Birimler:</b> İK, finans, satın alma, kalite gibi 13 birimde onaylı süreçler.</li>
          <li><b>Finans:</b> borç, ödeme, gider ve dönem özeti.</li>
        </ul>
      </section>
    </form>}
  </main>;
}
