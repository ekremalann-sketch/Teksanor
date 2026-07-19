"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, Banknote, BarChart3, Bell, Bot, BriefcaseBusiness, Building2, Check,
  CircleDollarSign, Coins, CreditCard, Database, Download, FileSpreadsheet, Files,
  Gauge, HandCoins, Landmark, LayoutDashboard, LogOut, Menu, MoreHorizontal, Plus, Search,
  Settings, ShieldCheck, Trash2, Upload, UserPlus, Users, WalletCards, Workflow, X,
} from "lucide-react";

type User = { id: string; username: string; fullName: string; role: "admin" | "user" };
type Summary = {
  id: string; period: string; total_limit: number; total_debt: number; restructuring: number;
  monthly_payment: number; next_installment: number; overdraft_debt: number; overdraft_limit: number;
  minimum_payment: number; expense_total: number; sort_order: number;
};
type Payment = {
  id: string; period: string; owner_name: string; bank_name: string; account_name: string;
  total_limit: number; total_debt: number; restructuring: number; monthly_payment: number;
  next_installment: number; overdraft_debt: number; overdraft_limit: number; interest_rate: number;
  minimum_payment: number; due_date: string | null; important_note: string | null;
  workflow_status: "draft" | "submitted" | "approved";
};
type Expense = { id: string; period: string; owner_name: string; category: string; description: string; amount: number; workflow_status: string; created_at: string };
type Activity = { id: string; full_name?: string; action: string; entity_type: string; details?: string; created_at: string };
type FileItem = { id: string; file_name: string; content_type: string; size_bytes: number; full_name: string; created_at: string };
type Organization = { id: string; name: string; slug: string; kind: "business" | "personal"; plan: string; subscription_status: string; trial_ends_at: string | null; membership_role: "owner" | "admin" | "member" };
type CompanyProfile = { legal_name?: string; tax_office?: string; tax_number?: string; mersis_number?: string; trade_registry_number?: string; sector?: string; phone?: string; email?: string; website?: string; address?: string; about?: string } | null;
type DashboardData = { user: User; organization: Organization; organizations: Organization[]; profile: CompanyProfile; summaries: Summary[]; payments: Payment[]; expenses: Expense[]; attentionCount: number; activity: Activity[] };
type CashBalance = { id: string; account_name: string; currency: string; amount: number; note?: string; rate_used: number; rate_ready: boolean; tl_equivalent: number };
type ManualDebt = { id: string; lender_name: string; debt_type: string; currency: string; amount: number; due_date?: string; note?: string; status: string; rate_used: number; rate_ready: boolean; tl_equivalent: number };
type TreasuryData = {
  fx: { TRY: number; USD: number; EUR: number; rates: Record<string, number>; sourceDate: string; sourceLabel: string; live: boolean };
  references: Record<string, number>;
  balances: CashBalance[];
  debts: ManualDebt[];
  summary: { totalCashTL: number; totalManualDebtTL: number; latestExpenseTL: number; netAfterDebtAndExpense: number; unresolvedGoldCount: number };
};
type Project = { id: string; name: string; code?: string; department: string; owner_name?: string; status: "planning" | "active" | "on_hold" | "completed"; priority: string; start_date?: string; target_date?: string; budget: number; progress: number; description?: string };

const navItems = [
  { id: "overview", label: "Şirket merkezi", icon: LayoutDashboard },
  { id: "departments", label: "Departmanlar", icon: Building2 },
  { id: "projects", label: "Projeler", icon: BriefcaseBusiness },
  { id: "agents", label: "Yapay zekâ ekibi", icon: Bot },
  { id: "financial", label: "Finansal durum", icon: Landmark },
  { id: "payments", label: "Ödemeler ve borçlar", icon: CreditCard },
  { id: "expenses", label: "Gelir ve giderler", icon: WalletCards },
  { id: "treasury", label: "Nakit ve elden borç", icon: HandCoins },
  { id: "reports", label: "Raporlar", icon: BarChart3 },
  { id: "files", label: "Belgeler", icon: Files },
  { id: "company", label: "Firma bilgileri", icon: Building2 },
  { id: "users", label: "Kullanıcılar", icon: Users, admin: true },
] as const;

const money = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 });
const number = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });
const formatMoney = (value: number) => money.format(Number(value || 0));
const shortMoney = (value: number) => value >= 1_000_000 ? `${(value / 1_000_000).toLocaleString("tr-TR", { maximumFractionDigits: 2 })} Mn ₺` : `${number.format(value / 1000)} Bin ₺`;
const statusText = { approved: "Kaydedildi", submitted: "Kaydedildi", draft: "Kaydedildi" };

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [organizationId, setOrganizationId] = useState("");
  const [treasury, setTreasury] = useState<TreasuryData | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [active, setActive] = useState("overview");
  const [mobileNav, setMobileNav] = useState(false);
  const [topbarPanel, setTopbarPanel] = useState<"notifications" | "settings" | null>(null);
  const [notificationUnread, setNotificationUnread] = useState(false);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<"payment" | "expense" | "user" | "balance" | "manualDebt" | "rates" | "password" | "company" | "project" | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const importRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const topbarActionsRef = useRef<HTMLDivElement>(null);

  async function load(targetOrganizationId?: string) {
    setLoading(true);
    try {
      const requested = targetOrganizationId || organizationId || localStorage.getItem("teksanor_organization") || "";
      const headers = requested ? { "X-Organization-Id": requested } : undefined;
      const response = await fetch("/api/dashboard", { cache: "no-store", headers });
      if (response.status === 401) { window.location.href = "/giris"; return; }
      if (!response.ok) throw new Error("Veriler alınamadı.");
      const nextData = await response.json() as DashboardData;
      setData(nextData);
      setOrganizationId(nextData.organization.id);
      localStorage.setItem("teksanor_organization", nextData.organization.id);
      const organizationHeaders = { "X-Organization-Id": nextData.organization.id };
      const treasuryResponse = await fetch("/api/treasury", { cache: "no-store", headers: organizationHeaders });
      if (treasuryResponse.ok) setTreasury(await treasuryResponse.json() as TreasuryData);
      const fileResponse = await fetch("/api/uploads", { cache: "no-store", headers: organizationHeaders });
      if (fileResponse.ok) setFiles(((await fileResponse.json()) as { files: FileItem[] }).files);
      const projectResponse = await fetch("/api/projects", { cache: "no-store", headers: organizationHeaders });
      if (projectResponse.ok) setProjects(((await projectResponse.json()) as { projects: Project[] }).projects);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  }

  async function refreshTreasury(targetOrganizationId = organizationId) {
    if (!targetOrganizationId) return;
    const response = await fetch("/api/treasury", { cache: "no-store", headers: { "X-Organization-Id": targetOrganizationId } });
    if (response.ok) setTreasury(await response.json() as TreasuryData);
  }

  useEffect(() => { void load(); }, []);

  const notificationKey = data ? `${data.activity[0]?.id ?? "none"}:${data.attentionCount}` : "";

  useEffect(() => {
    if (!data || !notificationKey) return;
    setNotificationUnread(data.attentionCount > 0 && localStorage.getItem("teksanor_notifications_read") !== notificationKey);
  }, [data, notificationKey]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    document.querySelector(".dashboard-main")?.scrollTo({ top: 0, behavior: "smooth" });
    setTopbarPanel(null);
  }, [active]);

  useEffect(() => {
    if (!mobileNav) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileNav(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileNav]);

  useEffect(() => {
    if (!topbarPanel) return;
    const closePanel = (event: globalThis.MouseEvent) => {
      if (!topbarActionsRef.current?.contains(event.target as Node)) setTopbarPanel(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setTopbarPanel(null);
    };
    document.addEventListener("mousedown", closePanel);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closePanel);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [topbarPanel]);

  useEffect(() => {
    if (active !== "treasury" || !organizationId) return;
    void refreshTreasury(organizationId);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refreshTreasury(organizationId);
    };
    const timer = window.setInterval(() => void refreshTreasury(organizationId), 15 * 60 * 1000);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [active, organizationId]);

  const latest = data?.summaries.at(-1);
  const previous = data?.summaries.at(-2);
  const debtChange = latest && previous ? ((latest.total_debt - previous.total_debt) / previous.total_debt) * 100 : 0;
  const filteredPayments = useMemo(() => {
    const term = search.toLocaleLowerCase("tr-TR").trim();
    if (!data || !term) return data?.payments ?? [];
    return data.payments.filter((item) => `${item.owner_name} ${item.bank_name} ${item.account_name} ${item.important_note ?? ""}`.toLocaleLowerCase("tr-TR").includes(term));
  }, [data, search]);

  function notify(text: string) {
    setMessage(text);
    window.setTimeout(() => setMessage(""), 3400);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    localStorage.removeItem("teksanor_organization");
    window.location.href = "/";
  }

  function toggleNotifications() {
    setTopbarPanel((value) => value === "notifications" ? null : "notifications");
    if (notificationKey) localStorage.setItem("teksanor_notifications_read", notificationKey);
    setNotificationUnread(false);
  }

  async function remove(id: string) {
    if (!window.confirm("Bu kaydı kalıcı olarak silmek istediğinizden emin misiniz?")) return;
    const response = await fetch(`/api/payments/${id}`, { method: "DELETE", headers: { "X-Organization-Id": organizationId } });
    if (response.ok) { notify("Kayıt silindi."); await load(organizationId); }
  }

  async function importExcel(file: File) {
    setError("");
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });
      if (!rows.length) throw new Error("Excel dosyasında okunabilir satır bulunamadı.");
      const normalize = (key: string) => key.toLocaleLowerCase("tr-TR").replace(/[^a-z0-9ğüşöçı]+/g, " ").trim();
      const get = (row: Record<string, unknown>, words: string[]) => {
        const found = Object.keys(row).find((key) => words.every((word) => normalize(key).includes(word)));
        return found ? row[found] : "";
      };
      let created = 0;
      for (const row of rows.slice(0, 100)) {
        const payload = {
          period: String(get(row, ["dönem"]) || latest?.period || "Temmuz - Ağustos 2026"),
          ownerName: String(get(row, ["kişi"]) || get(row, ["sahip"]) || get(row, ["kredi", "kartları"]) || "Belirtilmedi"),
          bankName: String(get(row, ["banka"]) || get(row, ["kredi", "kartları"]) || "Belirtilmedi"),
          accountName: String(get(row, ["hesap"]) || get(row, ["kredi", "kartları"]) || "Excel aktarımı"),
          totalLimit: Number(get(row, ["toplam", "limit"]) || 0),
          totalDebt: Number(get(row, ["toplam", "borç"]) || 0),
          restructuring: Number(get(row, ["yapılandırma"]) || 0),
          monthlyPayment: Number(get(row, ["aylık", "ödeme"]) || 0),
          nextInstallment: Number(get(row, ["gelecek", "dönem"]) || 0),
          overdraftDebt: Number(get(row, ["kmh", "borç"]) || 0),
          overdraftLimit: Number(get(row, ["kmh", "limit"]) || 0),
          minimumPayment: Number(get(row, ["asgari", "ödeme"]) || 0),
          importantNote: String(get(row, ["önemli", "not"]) || ""),
        };
        const response = await fetch("/api/payments", { method: "POST", headers: { "Content-Type": "application/json", "X-Organization-Id": organizationId }, body: JSON.stringify(payload) });
        if (response.ok) created += 1;
      }
      notify(`${created} Excel satırı sisteme aktarıldı.`);
      await load(organizationId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Excel aktarımı başarısız oldu.");
    } finally {
      if (importRef.current) importRef.current.value = "";
    }
  }

  async function uploadFile(file: File) {
    const form = new FormData();
    form.append("file", file);
    const response = await fetch("/api/uploads", { method: "POST", headers: { "X-Organization-Id": organizationId }, body: form });
    const result = await response.json() as { error?: string };
    if (!response.ok) { setError(result.error ?? "Dosya yüklenemedi."); return; }
    notify("Dosya güvenli alana yüklendi.");
    await load(organizationId);
  }

  if (loading && !data) return <LoadingScreen />;
  if (!data || !latest) return <div className="fatal-state"><AlertTriangle /><h1>Panel açılamadı</h1><p>{error || "Lütfen daha sonra tekrar deneyin."}</p><button onClick={() => void load()}>Tekrar dene</button></div>;

  const canManage = data.user.role === "admin" || ["owner", "admin"].includes(data.organization.membership_role);
  const roleLabel = data.user.role === "admin"
    ? "Platform yetkilisi"
    : data.organization.membership_role === "owner"
      ? "Firma sahibi"
      : data.organization.membership_role === "admin" ? "Firma yetkilisi" : "Kullanıcı";

  return (
    <div className="dashboard-shell">
      <aside className={`dashboard-sidebar ${mobileNav ? "open" : ""}`}>
        <div className="sidebar-brand">
          <a className="sidebar-home" href="/" aria-label="Teksanor ana sayfasına git"><img src="/assets/teksanor-logo.png" alt="Teksanor" /></a>
          <button type="button" className="mobile-close" onClick={() => setMobileNav(false)} aria-label="Menüyü kapat"><X size={19} /></button>
        </div>
        <div className="sidebar-context">
          <span>Çalışma alanı</span>
          <select aria-label="Çalışma alanı seç" value={organizationId} onChange={(event) => void load(event.target.value)}>
            {data.organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}
          </select>
          <small>{data.organization.kind === "business" ? "Firma hesabı" : "Bireysel hesap"} · {data.organization.subscription_status === "trialing" ? "Deneme planı" : data.organization.plan}</small>
        </div>
        <nav className="sidebar-nav">
          <span className="nav-heading">YÖNETİM</span>
          {navItems.filter((item) => !("admin" in item && item.admin && !canManage)).map(({ id, label, icon: Icon }) => (
            <button key={id} className={active === id ? "active" : ""} onClick={() => { setActive(id); setMobileNav(false); }}><Icon size={18} /><span>{label}</span>{id === "payments" && data.attentionCount > 0 && <em>{data.attentionCount}</em>}</button>
          ))}
        </nav>
        <div className="sidebar-security"><ShieldCheck size={19} /><span><b>Güvenli çalışma alanı</b>Finansal veriler şifreli oturumla korunur.</span></div>
        <div className="sidebar-user"><div>{data.user.fullName.split(" ").map((item) => item[0]).join("").slice(0, 2)}</div><span><b>{data.user.fullName}</b><small>{data.user.username} · {roleLabel}</small></span><button type="button" onClick={logout} title="Çıkış yap" aria-label="Çıkış yap"><LogOut size={17} /></button></div>
      </aside>
      {mobileNav && <button type="button" className="sidebar-backdrop" onClick={() => setMobileNav(false)} aria-label="Menüyü kapat" />}

      <main className="dashboard-main">
        <header className="dashboard-topbar">
          <button type="button" className="mobile-menu" onClick={() => setMobileNav(true)} aria-label="Menüyü aç"><Menu size={21} /></button>
          <div className="topbar-search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Kayıt ara..." /></div>
          <div className="topbar-actions" ref={topbarActionsRef}>
            <button type="button" className={topbarPanel === "notifications" ? "active" : ""} title="Bildirimler" aria-label="Bildirimleri aç" aria-expanded={topbarPanel === "notifications"} onClick={toggleNotifications}><Bell size={19} />{notificationUnread && <i />}</button>
            <button type="button" className={topbarPanel === "settings" ? "active" : ""} title="Ayarlar" aria-label="Ayarları aç" aria-expanded={topbarPanel === "settings"} onClick={() => setTopbarPanel((value) => value === "settings" ? null : "settings")}><Settings size={19} /></button>
            {topbarPanel === "notifications" && <div className="topbar-popover notification-popover">
              <div className="popover-head"><div><span>Bildirim merkezi</span><b>Güncel durum</b></div><button type="button" onClick={() => setTopbarPanel(null)} aria-label="Bildirimleri kapat"><X size={17} /></button></div>
              <div className="notification-summary"><ShieldCheck size={19} /><span><b>Sistem ve veriler erişilebilir</b><small>Çalışma alanınız güvenli oturumla korunuyor.</small></span></div>
              {data.attentionCount > 0 ? <button type="button" className="notification-row" onClick={() => { setActive("payments"); setTopbarPanel(null); }}><span className="notification-mark warning" /><span><b>{data.attentionCount} finansal kayıt takip bekliyor</b><small>Ödemeler ve borçlar bölümünü açın.</small></span><ArrowRight size={16} /></button> : <div className="notification-empty"><Check size={20} /><span><b>Bekleyen önemli bildirim yok</b><small>Yeni gelişmeler burada gösterilecek.</small></span></div>}
              {data.activity.slice(0, 2).map((item) => <div className="notification-row static" key={item.id}><span className="notification-mark" /><span><b>{item.details || "Çalışma alanında işlem yapıldı"}</b><small>{new Date(item.created_at).toLocaleString("tr-TR")}</small></span></div>)}
              <button type="button" className="popover-footer-action" onClick={() => { setActive("overview"); setTopbarPanel(null); }}><span>Yönetim özetine git</span><ArrowRight size={16} /></button>
            </div>}
            {topbarPanel === "settings" && <div className="topbar-popover settings-popover">
              <div className="popover-head"><div><span>Hesap ve çalışma alanı</span><b>Ayarlar</b></div><button type="button" onClick={() => setTopbarPanel(null)} aria-label="Ayarları kapat"><X size={17} /></button></div>
              <div className="settings-profile"><div>{data.user.fullName.split(" ").map((item) => item[0]).join("").slice(0, 2)}</div><span><b>{data.user.fullName}</b><small>{data.organization.name} · {roleLabel}</small></span></div>
              <button type="button" className="settings-row" onClick={() => { setActive("company"); setTopbarPanel(null); }}><Building2 size={18} /><span><b>Firma bilgileri</b><small>Kurumsal profil ve iletişim bilgileri</small></span><ArrowRight size={16} /></button>
              <button type="button" className="settings-row" onClick={() => { setActive("overview"); setTopbarPanel(null); }}><LayoutDashboard size={18} /><span><b>Çalışma alanı özeti</b><small>Plan, dönem ve finansal görünüm</small></span><ArrowRight size={16} /></button>
              {canManage && <button type="button" className="settings-row" onClick={() => { setActive("users"); setTopbarPanel(null); }}><Users size={18} /><span><b>Kullanıcı ve yetkiler</b><small>Ekip erişimlerini güvenle yönetin</small></span><ArrowRight size={16} /></button>}
              <button type="button" className="settings-row" onClick={() => { setModal("password"); setTopbarPanel(null); }}><ShieldCheck size={18} /><span><b>Parolayı değiştir</b><small>Hesabınızın giriş güvenliğini yönetin</small></span><ArrowRight size={16} /></button>
              <button type="button" className="settings-row danger" onClick={logout}><LogOut size={18} /><span><b>Güvenli çıkış</b><small>Yalnızca bu seçenek oturumu kapatır</small></span></button>
            </div>}
          </div>
        </header>

        <div className="dashboard-content">
          {error && <div className="panel-alert error"><AlertTriangle size={17} />{error}<button type="button" onClick={() => setError("")} aria-label="Uyarıyı kapat"><X size={16} /></button></div>}
          {message && <div className="panel-alert success"><Check size={17} />{message}</div>}
          <PageHeader active={active} period={latest.period} organization={data.organization} onNew={() => setModal(active === "projects" ? "project" : active === "expenses" ? "expense" : "payment")} onImport={() => importRef.current?.click()} canAdd={["financial", "payments", "expenses", "projects"].includes(active)} />
          <input ref={importRef} hidden type="file" accept=".xlsx,.xls,.csv" onChange={(event) => event.target.files?.[0] && void importExcel(event.target.files[0])} />

          {active === "overview" && <CompanyHome data={data} projects={projects} onNavigate={setActive} />}
          {active === "departments" && <DepartmentsView onNavigate={setActive} />}
          {active === "projects" && <ProjectsView projects={projects} onAdd={() => setModal("project")} />}
          {active === "agents" && <AgentWorkforceView onNavigate={setActive} />}
          {active === "financial" && <FinancialOverview data={data} latest={latest} previous={previous} debtChange={debtChange} payments={filteredPayments} canManage={canManage} onDelete={remove} onNavigate={setActive} />}
          {active === "payments" && <PaymentsView payments={filteredPayments} isAdmin={canManage} onDelete={remove} />}
          {active === "expenses" && <ExpensesView expenses={data.expenses} latest={latest} />}
          {active === "treasury" && treasury && <TreasuryView data={treasury} onBalance={() => setModal("balance")} onDebt={() => setModal("manualDebt")} />}
          {active === "reports" && <ReportsView summaries={data.summaries} />}
          {active === "files" && <FilesView files={files} organizationId={organizationId} onUpload={() => uploadRef.current?.click()} />}
          {active === "company" && <CompanyView organization={data.organization} profile={data.profile} canManage={canManage} onEdit={() => setModal("company")} />}
          {active === "users" && canManage && <UsersView onAdd={() => setModal("user")} />}
          <input ref={uploadRef} hidden type="file" accept="image/png,image/jpeg,image/webp,application/pdf,.xlsx,.csv" onChange={(event) => event.target.files?.[0] && void uploadFile(event.target.files[0])} />
        </div>
      </main>

      {modal && <EntryModal type={modal} latestPeriod={latest.period} treasury={treasury} profile={data.profile} organizationId={organizationId} close={() => setModal(null)} complete={async (text) => { setModal(null); notify(text); await load(organizationId); }} setError={setError} />}
    </div>
  );
}

function LoadingScreen() {
  return <div className="loading-screen"><img src="/assets/teksanor-logo.png" alt="Teksanor" /><div className="loading-line"><span /></div><p>Güvenli çalışma alanı hazırlanıyor...</p></div>;
}

function PageHeader({ active, period, organization, onNew, onImport, canAdd }: { active: string; period: string; organization: Organization; onNew: () => void; onImport: () => void; canAdd: boolean }) {
  const titles: Record<string, [string, string]> = {
    overview: ["Şirket merkezi", "Kurumunuzun profili, departmanları, projeleri ve son faaliyetleri tek bakışta görün."],
    departments: ["Departmanlar", "Sorumluluk alanlarını ve günlük çalışma akışlarını düzenli bir kurum yapısında inceleyin."],
    projects: ["Proje portföyü", "Planlanan ve devam eden çalışmaları sorumlu, bütçe, tarih ve ilerleme bilgisiyle yönetin."],
    agents: ["Yapay zekâ ekibi", "Departman görevlerine göre yapılandırılabilen kontrollü ajan prototiplerini inceleyin."],
    financial: ["Finansal durum", "Borç, ödeme, limit ve dönemsel değişimleri ayrı finans çalışma alanında değerlendirin."],
    payments: ["Ödemeler ve borçlar", "Kart, yapılandırma, KMH ve ödeme planlarını yönetin."],
    expenses: ["Gelir ve giderler", "Dönemsel giderleri sade biçimde kaydedin ve izleyin."],
    treasury: ["Finansal analiz", "Eldeki nakdi, dövizleri, elden ve ziynet borçlarını TL karşılığıyla birlikte izleyin."],
    reports: ["Raporlar", "Dönemler arasındaki değişimi anlaşılır göstergelerle inceleyin."],
    files: ["Belgeler", "Finansal dosya, dekont, görsel ve Excel belgelerini güvenle saklayın."],
    company: ["Firma bilgileri", "Kurumsal kimlik ve iletişim bilgilerini kendi çalışma alanınızda yönetin."],
    users: ["Kullanıcı yönetimi", "Veri girecek kişileri oluşturun ve yetkilerini yönetin."],
  };
  const current = titles[active] ?? titles.overview;
  return <><div className="organization-strip"><div><Building2 size={16} /><span><b>{organization.name}</b>{organization.kind === "business" ? "Firma çalışma alanı" : "Kişisel çalışma alanı"}</span></div><em className={`subscription-badge ${organization.subscription_status}`}>{organization.subscription_status === "trialing" ? "14 günlük deneme" : organization.subscription_status === "active" ? "Aktif" : "Ödeme bekleniyor"}</em></div><div className="panel-heading"><div><span className="breadcrumb">TEKSANOR / {organization.name.toLocaleUpperCase("tr-TR")} / {period.toLocaleUpperCase("tr-TR")}</span><h1>{current[0]}</h1><p>{current[1]}</p></div><div className="heading-actions">{["financial", "payments"].includes(active) && <button className="outline-button" onClick={onImport}><FileSpreadsheet size={17} /> Excel aktar</button>}{canAdd && <button className="panel-primary" onClick={onNew}><Plus size={17} /> {active === "projects" ? "Yeni proje" : "Yeni kayıt"}</button>}</div></div></>;
}

function CompanyHome({ data, projects, onNavigate }: { data: DashboardData; projects: Project[]; onNavigate: (page: string) => void }) {
  const activeProjects = projects.filter((item) => item.status === "active").length;
  return <>
    <section className="company-command-hero"><div><span>KURUMSAL ÇALIŞMA ALANI</span><h2>{data.profile?.legal_name || data.organization.name}</h2><p>{data.profile?.about || "Firmanızın temel bilgilerini, projelerini ve günlük çalışmalarını burada bir arada tutun."}</p><button type="button" onClick={() => onNavigate("company")}>Firma bilgilerini aç <ArrowRight size={16} /></button></div><div className="command-hero-mark"><Building2 size={42} /><span>Faaliyet alanı</span><b>{data.profile?.sector || "Henüz eklenmedi"}</b></div></section>
    <section className="company-command-grid">
      <button onClick={() => onNavigate("departments")}><Building2 size={22} /><span><b>Departmanlar</b><small>Şirket birimleri ve görev alanları</small></span><ArrowRight size={17} /></button>
      <button onClick={() => onNavigate("projects")}><BriefcaseBusiness size={22} /><span><b>Proje portföyü</b><small>{projects.length} proje · {activeProjects} aktif çalışma</small></span><ArrowRight size={17} /></button>
      <button onClick={() => onNavigate("financial")}><Landmark size={22} /><span><b>Finansal durum</b><small>Borç, ödeme ve nakit özeti</small></span><ArrowRight size={17} /></button>
      <button onClick={() => onNavigate("files")}><Files size={22} /><span><b>Kurumsal belgeler</b><small>Sözleşme, dekont, tablo ve proje dosyaları</small></span><ArrowRight size={17} /></button>
      <button onClick={() => onNavigate("agents")}><Bot size={22} /><span><b>Akıllı asistanlar</b><small>Onayınızla çalışan görev yardımcıları</small></span><ArrowRight size={17} /></button>
    </section>
    <section className="company-activity-board"><div><span>SON FAALİYETLER</span><h3>Çalışma alanındaki güncel hareketler</h3></div><div>{data.activity.length ? data.activity.slice(0, 5).map((item) => <article key={item.id}><i /><span><b>{item.details || "Çalışma alanında işlem yapıldı"}</b><small>{new Date(item.created_at).toLocaleString("tr-TR")}</small></span></article>) : <p>Henüz faaliyet kaydı bulunmuyor.</p>}</div></section>
  </>;
}

const departmentCatalog = [
  { name: "Yönetim ve strateji", icon: Gauge, description: "Hedefler, yönetim kararları, performans göstergeleri ve şirket genelindeki öncelikler.", roles: ["Firma sahibi / üst yönetim", "Yönetim asistanı", "Strateji ve raporlama"] },
  { name: "Finans ve mali işler", icon: Landmark, description: "Nakit planlama, bütçe, borç ve alacak takibi, iç finansal kontrol ve mali müşavir koordinasyonu.", roles: ["Finans yöneticisi", "Ön muhasebe", "Bütçe ve raporlama"] },
  { name: "Proje ve mühendislik", icon: BriefcaseBusiness, description: "Proje kapsamı, görevler, kilometre taşları, teknik dokümanlar, kaynak ve ilerleme takibi.", roles: ["Proje yöneticisi", "Mühendis / uzman", "Saha ve teknik ekip"] },
  { name: "Operasyon ve satın alma", icon: Workflow, description: "Günlük iş akışları, tedarikçi ilişkileri, talepler, satın alma ve teslimat koordinasyonu.", roles: ["Operasyon sorumlusu", "Satın alma", "Tedarik ve lojistik"] },
  { name: "İnsan ve organizasyon", icon: Users, description: "Çalışan kayıtları, rol ve yetki tanımları, işe alım, izin ve gelişim süreçleri.", roles: ["İnsan kaynakları", "Birim yöneticisi", "Çalışan deneyimi"] },
  { name: "Satış ve müşteri ilişkileri", icon: UserPlus, description: "Fırsat, teklif, müşteri iletişimi, sözleşme başlangıcı ve satış sonrası takip.", roles: ["Satış yöneticisi", "Müşteri temsilcisi", "Teklif ve sözleşme"] },
];

function DepartmentsView({ onNavigate }: { onNavigate: (page: string) => void }) {
  return <section className="department-grid">{departmentCatalog.map(({ name, icon: Icon, description, roles }) => <article key={name}><div><Icon size={23} /><span>DEPARTMAN</span></div><h3>{name}</h3><p>{description}</p><ul>{roles.map((role) => <li key={role}><Check size={13} />{role}</li>)}</ul>{name === "Finans ve mali işler" && <button type="button" onClick={() => onNavigate("financial")}>Finans çalışma alanını aç <ArrowRight size={15} /></button>}{name === "Proje ve mühendislik" && <button type="button" onClick={() => onNavigate("projects")}>Proje portföyünü aç <ArrowRight size={15} /></button>}</article>)}</section>;
}

function ProjectsView({ projects, onAdd }: { projects: Project[]; onAdd: () => void }) {
  const statusLabel = { planning: "Planlama", active: "Devam ediyor", on_hold: "Beklemede", completed: "Tamamlandı" };
  return <section className="projects-workspace"><div className="project-portfolio-head"><div><span>PROJE PORTFÖYÜ</span><h2>Çalışmaları görünür ve sorumlu hâle getirin.</h2><p>Her proje için kapsam, departman, sorumlu, hedef tarih, bütçe ve ilerleme bilgisi aynı yerde tutulur.</p></div><button className="panel-primary" onClick={onAdd}><Plus size={17} /> Proje oluştur</button></div>{projects.length ? <div className="project-card-grid">{projects.map((project) => <article key={project.id}><div className="project-card-top"><span>{project.department}</span><em className={project.status}>{statusLabel[project.status]}</em></div><h3>{project.name}</h3><p>{project.description || "Proje açıklaması henüz eklenmedi."}</p><div className="project-progress"><span><b>İlerleme</b><em>%{project.progress}</em></span><i><b style={{ width: `${project.progress}%` }} /></i></div><dl><div><dt>Sorumlu</dt><dd>{project.owner_name || "Atanmadı"}</dd></div><div><dt>Hedef tarih</dt><dd>{project.target_date || "Belirlenmedi"}</dd></div><div><dt>Bütçe</dt><dd>{project.budget ? formatMoney(project.budget) : "Belirlenmedi"}</dd></div></dl></article>)}</div> : <div className="project-empty"><BriefcaseBusiness size={34} /><h3>İlk projenizi oluşturun</h3><p>Şirket içi çalışma, müşteri işi, mühendislik geliştirmesi veya yatırım projesi ekleyebilirsiniz.</p><button className="panel-primary" onClick={onAdd}><Plus size={17} /> Yeni proje</button></div>}</section>;
}

const agentCatalog = [
  { name: "Finans Kontrol Ajanı", department: "Finans ve mali işler", task: "Vade yaklaşan kayıtları özetler, dövizli borçların TL etkisini açıklar ve tutarsızlıkları incelemeye sunar.", boundary: "Ödeme yapamaz, kaydı silemez; finans sorumlusunun onayı olmadan kritik işlem başlatamaz.", target: "financial" },
  { name: "Proje Koordinasyon Ajanı", department: "Proje ve mühendislik", task: "Hedef tarihleri, ilerleme oranlarını ve eksik sorumlu alanlarını izler; haftalık proje özeti hazırlar.", boundary: "Proje kapsamını veya bütçesini kendi başına değiştiremez.", target: "projects" },
  { name: "Operasyon Takip Ajanı", department: "Operasyon ve satın alma", task: "Tekrarlanan talepleri sınıflandırır, geciken işleri işaretler ve sorumlu ekip için takip listesi oluşturur.", boundary: "Sipariş veremez veya tedarikçi adına taahhütte bulunamaz.", target: "departments" },
  { name: "Yönetim Raporlama Ajanı", department: "Yönetim ve strateji", task: "Departmanlardan gelen doğrulanmış bilgileri sade bir yönetim notunda birleştirir ve karar bekleyen konuları ayırır.", boundary: "Nihai karar vermez; yalnızca kaynak gösteren bir taslak hazırlar.", target: "overview" },
];

function AgentWorkforceView({ onNavigate }: { onNavigate: (page: string) => void }) {
  return <section className="agent-workforce"><div className="agent-prototype-banner"><div><Bot size={30} /><span>PROTOTİP MODU</span></div><h2>Her departman için aynı botu değil, o işin sınırlarını bilen bir çalışma profili tasarlıyoruz.</h2><p>Bu ekranda ajanların görev tanımları ve yetki sınırları gösterilir. Gerçek OpenAI bağlantısı ancak firma yetkilisi hizmeti etkinleştirdiğinde, kullanım bütçesini onayladığında ve veri işleme koşullarını kabul ettiğinde açılır.</p><a href="/yapay-zeka-hizmeti" target="_blank" rel="noreferrer">Hizmet ve fiyatlandırma modelini incele <ArrowRight size={16} /></a></div><div className="agent-card-grid">{agentCatalog.map((agent) => <article key={agent.name}><div className="agent-avatar"><Bot size={22} /></div><span>{agent.department}</span><h3>{agent.name}</h3><b>Görevi</b><p>{agent.task}</p><b>Yetki sınırı</b><p>{agent.boundary}</p><div><em>İnsan onayı zorunlu</em><button type="button" onClick={() => onNavigate(agent.target)}>Departmanı aç <ArrowRight size={14} /></button></div></article>)}</div><div className="agent-commercial-note"><ShieldCheck size={22} /><div><b>Şeffaf ücret ve kontrollü veri kullanımı</b><p>Toplam bedel; Teksanor platform hizmeti, ajan kurulum/yönetim hizmeti, onaylanan OpenAI API kullanımı ve vergilerden oluşur. Satın alma öncesinde toplam ücret gösterilir; gizli komisyon veya habersiz kullanım yapılmaz.</p></div></div></section>;
}

function FinancialOverview({ data, latest, previous, debtChange, payments, canManage, onDelete, onNavigate }: { data: DashboardData; latest: Summary; previous?: Summary; debtChange: number; payments: Payment[]; canManage: boolean; onDelete: (id: string) => void; onNavigate: (page: string) => void }) {
  const utilization = latest.total_limit ? (latest.total_debt / latest.total_limit) * 100 : 0;
  const cards = [
    { label: "Toplam borç", value: shortMoney(latest.total_debt), change: debtChange, note: "Önceki döneme göre", icon: CircleDollarSign, tone: "blue", target: "payments" },
    { label: "Aylık ödeme", value: shortMoney(latest.monthly_payment), change: previous ? ((latest.monthly_payment - previous.monthly_payment) / previous.monthly_payment) * 100 : 0, note: "Planlanan ödeme", icon: CreditCard, tone: "gold", target: "payments" },
    { label: "KMH borcu", value: shortMoney(latest.overdraft_debt), change: previous ? ((latest.overdraft_debt - previous.overdraft_debt) / previous.overdraft_debt) * 100 : 0, note: "Ek hesap toplamı", icon: Gauge, tone: "violet", target: "payments" },
    { label: "Asgari ödeme", value: shortMoney(latest.minimum_payment), change: previous ? ((latest.minimum_payment - previous.minimum_payment) / previous.minimum_payment) * 100 : 0, note: "Bu dönem", icon: WalletCards, tone: "green", target: "reports" },
  ];
  return <>
    <section className="stat-grid">{cards.map(({ label, value, change, note, icon: Icon, tone, target }) => <button type="button" className="stat-card clickable" key={label} onClick={() => onNavigate(target)}><div className={`stat-icon ${tone}`}><Icon size={20} /></div><span className="card-menu-icon" aria-hidden="true"><ArrowRight size={18} /></span><span>{label}</span><strong>{value}</strong><small className={change <= 0 ? "positive" : "negative"}>{change <= 0 ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}{Math.abs(change).toLocaleString("tr-TR", { maximumFractionDigits: 1 })}% <em>{note}</em></small></button>)}</section>
    <section className="insight-grid">
      <article className="chart-card"><CardTitle title="Borç değişimi" subtitle="Dönemsel toplam borç" /><div className="bar-chart">{data.summaries.map((item) => { const max = Math.max(...data.summaries.map((summary) => summary.total_debt)); return <div className="bar-column" key={item.id}><div className="bar-value">{shortMoney(item.total_debt).replace(" ₺", "")}</div><div className="bar-track"><div className="bar-fill" style={{ height: `${Math.max(16, item.total_debt / max * 100)}%` }} /></div><span>{item.period.split(" 2026")[0]}</span></div>; })}</div></article>
      <article className="ratio-card"><CardTitle title="Limit kullanım oranı" subtitle="Borç / toplam limit" /><div className="ratio-ring" style={{ background: `conic-gradient(#d4ad67 ${Math.min(utilization, 100)}%, #e9eef5 0)` }}><div><strong>%{utilization.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}</strong><span>Kullanım</span></div></div><div className="ratio-legend"><span><i className="gold" />Toplam borç <b>{shortMoney(latest.total_debt)}</b></span><span><i />Kalan limit <b>{shortMoney(Math.max(0, latest.total_limit - latest.total_debt))}</b></span></div></article>
      <article className="attention-card"><div className="attention-head"><span><AlertTriangle size={18} />Yakın takip</span><em>{data.attentionCount} takip notu</em></div><div className="attention-list">{payments.filter((item) => item.important_note).slice(0, 4).map((item) => <div key={item.id}><div className="attention-bank">{item.bank_name.slice(0, 2).toUpperCase()}</div><span><b>{item.owner_name} · {item.bank_name}</b><small>{item.important_note}</small></span><strong>{shortMoney(item.minimum_payment)}</strong></div>)}</div></article>
    </section>
    <RecentPayments payments={payments.slice(0, 7)} isAdmin={canManage} onDelete={onDelete} />
  </>;
}

function CardTitle({ title, subtitle }: { title: string; subtitle: string }) { return <div className="card-title"><div><h3>{title}</h3><p>{subtitle}</p></div><span className="card-menu-icon" aria-hidden="true"><MoreHorizontal size={18} /></span></div>; }

function RecentPayments({ payments, isAdmin, onDelete }: { payments: Payment[]; isAdmin: boolean; onDelete: (id: string) => void }) {
  return <section className="table-card"><div className="table-heading"><div><h3>Ödeme kayıtları</h3><p>Yeni kayıtlar beklemeden doğrudan tabloya eklenir.</p></div><span>{payments.length} kayıt</span></div><div className="responsive-table"><table><thead><tr><th>Kişi / hesap</th><th>Banka</th><th>Toplam borç</th><th>Aylık ödeme</th><th>Asgari ödeme</th><th>Durum</th><th /></tr></thead><tbody>{payments.map((item) => <tr key={item.id}><td><div className="table-account"><span>{item.owner_name[0]}</span><div><b>{item.owner_name}</b><small>{item.account_name}</small></div></div></td><td>{item.bank_name}</td><td><b>{formatMoney(item.total_debt)}</b></td><td>{formatMoney(item.monthly_payment)}</td><td>{formatMoney(item.minimum_payment)}</td><td><span className={`status-badge ${item.workflow_status}`}>{statusText[item.workflow_status]}</span></td><td>{isAdmin && <div className="row-actions"><button className="danger" title="Sil" onClick={() => onDelete(item.id)}><Trash2 size={16} /></button></div>}</td></tr>)}</tbody></table></div></section>;
}

function PaymentsView({ payments, isAdmin, onDelete }: { payments: Payment[]; isAdmin: boolean; onDelete: (id: string) => void }) {
  return <><div className="mini-summary"><span><b>{payments.length}</b> finansal hesap</span><span><b>{shortMoney(payments.reduce((sum, item) => sum + Number(item.total_debt), 0))}</b> kayıtlı borç</span><span><b>{payments.filter((item) => item.important_note).length}</b> yakın takip notu</span></div><RecentPayments payments={payments} isAdmin={isAdmin} onDelete={onDelete} /></>;
}

function ExpensesView({ expenses, latest }: { expenses: Expense[]; latest: Summary }) {
  return <div className="content-grid"><section className="table-card wide"><div className="table-heading"><div><h3>Gider kayıtları</h3><p>Basit kategori ve açıklama düzeni</p></div><span>{expenses.length} kayıt</span></div>{expenses.length ? <div className="responsive-table"><table><thead><tr><th>Dönem</th><th>Kişi</th><th>Kategori</th><th>Açıklama</th><th>Tutar</th><th>Durum</th></tr></thead><tbody>{expenses.map((item) => <tr key={item.id}><td>{item.period}</td><td>{item.owner_name}</td><td>{item.category}</td><td>{item.description}</td><td><b>{formatMoney(item.amount)}</b></td><td><span className={`status-badge ${item.workflow_status}`}>{statusText[item.workflow_status as keyof typeof statusText] ?? item.workflow_status}</span></td></tr>)}</tbody></table></div> : <EmptyState icon={WalletCards} title="Henüz gider kaydı yok" text="Yeni kayıt düğmesiyle kira, yakıt, mutfak, fatura veya şirket harcaması ekleyin." />}</section><aside className="expense-side"><span>Son dönem gider toplamı</span><strong>{formatMoney(latest.expense_total)}</strong><p>PDF’deki kira, mutfak, yakıt ve fatura kalemlerinden oluşturulan başlangıç özeti.</p></aside></div>;
}

const currencyLabels: Record<string, string> = {
  TRY: "Türk lirası", USD: "ABD doları", EUR: "Euro", GBP: "İngiliz sterlini", CHF: "İsviçre frangı",
  CAD: "Kanada doları", AUD: "Avustralya doları", JPY: "Japon yeni", CNY: "Çin yuanı", AED: "BAE dirhemi",
  SAR: "Suudi Arabistan riyali", QAR: "Katar riyali", KWD: "Kuveyt dinarı", AZN: "Azerbaycan manatı",
  BGN: "Bulgar levası", RON: "Rumen leyi", RUB: "Rus rublesi", DKK: "Danimarka kronu",
  SEK: "İsveç kronu", NOK: "Norveç kronu", KRW: "Güney Kore wonu", PKR: "Pakistan rupisi", IRR: "İran riyali",
  GRAM_GOLD: "Gram altın", QUARTER_GOLD: "Çeyrek altın", HALF_GOLD: "Yarım altın", FULL_GOLD: "Tam altın",
  REPUBLIC_GOLD: "Cumhuriyet altını", ATA_GOLD: "Ata altın", BRACELET_22K_GRAM: "22 ayar bilezik (gram)",
};

const fiatCodes = ["TRY", "USD", "EUR", "GBP", "CHF", "CAD", "AUD", "JPY", "CNY", "AED", "SAR", "QAR", "KWD", "AZN", "BGN", "RON", "RUB", "DKK", "SEK", "NOK", "KRW", "PKR", "IRR"];
const goldCodes = ["GRAM_GOLD", "QUARTER_GOLD", "HALF_GOLD", "FULL_GOLD", "REPUBLIC_GOLD", "ATA_GOLD", "BRACELET_22K_GRAM"];

function originalAmount(amount: number, currency: string) {
  if (currency === "TRY") return formatMoney(amount);
  if (currency === "USD") return `${number.format(amount)} USD`;
  if (currency === "EUR") return `${number.format(amount)} EUR`;
  if (goldCodes.includes(currency)) return `${number.format(amount)} ${currencyLabels[currency] ?? currency}`;
  return `${number.format(amount)} ${currency}`;
}

function TreasuryView({ data, onBalance, onDebt }: { data: TreasuryData; onBalance: () => void; onDebt: () => void }) {
  const negative = data.summary.netAfterDebtAndExpense < 0;
  return <>
    <section className="treasury-summary">
      <article><div className="treasury-icon cash"><Banknote /></div><span>Eldeki toplam</span><strong>{formatMoney(data.summary.totalCashTL)}</strong><small>Dövizler TL karşılığına çevrildi</small></article>
      <article><div className="treasury-icon debt"><HandCoins /></div><span>Elden ve ziynet borcu</span><strong>{formatMoney(data.summary.totalManualDebtTL)}</strong><small>{data.summary.unresolvedGoldCount ? `${data.summary.unresolvedGoldCount} altın kaydı için fiyat gerekli` : "Tüm kayıtların TL karşılığı hazır"}</small></article>
      <article><div className="treasury-icon expense"><WalletCards /></div><span>Son dönem gideri</span><strong>{formatMoney(data.summary.latestExpenseTL)}</strong><small>PDF dönem özetinden</small></article>
      <article className={negative ? "negative" : "positive"}><div className="treasury-icon net"><CircleDollarSign /></div><span>Net kullanılabilir görünüm</span><strong>{formatMoney(data.summary.netAfterDebtAndExpense)}</strong><small>Eldeki − elden borç − dönem gideri</small></article>
    </section>
    <section className="currency-rate-panel tcmb-compact-panel">
      <div className="market-panel-heading"><div><CircleDollarSign size={20} /><span><b>Türkiye Cumhuriyet Merkez Bankası döviz kurları</b><small>Resmî günlük döviz satış kurları · Türk lirası karşılığı</small></span></div><em>{data.fx.sourceDate}</em></div>
      <div className="currency-rate-grid tcmb-main-rates">
        {["USD", "EUR", "GBP"].map((code) => <article key={code}><span>{currencyLabels[code]} <em>{code} / TRY</em></span><b>{Number(data.fx.rates?.[code] ?? 0).toLocaleString("tr-TR", { minimumFractionDigits: 4, maximumFractionDigits: 4 })} ₺</b></article>)}
      </div>
      <p className="market-source-note"><i className={data.fx.live ? "live" : ""} /> Kaynak: {data.fx.sourceLabel}. Dövizli varlık ve borçların TL karşılığı bu kur verisiyle otomatik güncellenir.</p>
    </section>
    <div className="treasury-actions"><button className="panel-primary" onClick={onBalance}><Plus size={16} /> Eldeki tutarı ekle</button><button className="panel-primary" onClick={onDebt}><Plus size={16} /> Elden borç ekle</button></div>
    <section className="treasury-grid">
      <article className="table-card"><div className="table-heading"><div><h3>Eldeki nakit, döviz ve altın</h3><p>Kasa, banka veya elde tutulan varlıklar</p></div><span>{data.balances.length} kayıt</span></div>{data.balances.length ? <div className="responsive-table"><table><thead><tr><th>Hesap</th><th>Orijinal tutar</th><th>Kur / fiyat</th><th>TL karşılığı</th></tr></thead><tbody>{data.balances.map((item) => <tr key={item.id}><td><b>{item.account_name}</b><small className="cell-note">{item.note}</small></td><td>{originalAmount(item.amount, item.currency)}</td><td>{item.rate_ready ? item.rate_used.toLocaleString("tr-TR", { maximumFractionDigits: 4 }) : <span className="rate-missing">Fiyat gerekli</span>}</td><td>{item.rate_ready ? <b>{formatMoney(item.tl_equivalent)}</b> : "—"}</td></tr>)}</tbody></table></div> : <EmptyState icon={Banknote} title="Henüz varlık girilmedi" text="Para veya altın birimini seçip tutarı eklediğinizde TL karşılığı burada görünür." />}</article>
      <article className="table-card"><div className="table-heading"><div><h3>Elden alınan borçlar</h3><p>Nakit, döviz ve ziynet borçları</p></div><span>{data.debts.length} kayıt</span></div><div className="responsive-table"><table><thead><tr><th>Kişi / kurum</th><th>Borç</th><th>TL karşılığı</th><th>Not</th></tr></thead><tbody>{data.debts.map((item) => <tr key={item.id}><td><b>{item.lender_name}</b></td><td>{originalAmount(item.amount, item.currency)}</td><td>{item.rate_ready ? <b>{formatMoney(item.tl_equivalent)}</b> : <span className="rate-missing">Fiyat girilmeli</span>}</td><td><small className="cell-note">{item.note || "—"}</small></td></tr>)}</tbody></table></div></article>
    </section>
    <p className="treasury-disclaimer"><ShieldCheck size={14} /> Dövizli varlık ve borçların TL karşılığı, ekran açıldığında ve kayıtlar güncellendiğinde {data.fx.sourceLabel.toLocaleLowerCase("tr-TR")} ile otomatik yeniden hesaplanır. Kur tarihi: {data.fx.sourceDate}. Bu görünüm iç finansal analiz içindir; resmî muhasebe veya yatırım tavsiyesi değildir.</p>
  </>;
}

function ReportsView({ summaries }: { summaries: Summary[] }) {
  const latest = summaries.at(-1)!;
  return <><section className="report-hero"><div><span>Yönetim özeti</span><h2>{latest.period}</h2><p>Bu rapor resmî muhasebe bilançosu değildir; karar vermeyi kolaylaştıran iç yönetim görünümüdür.</p></div><button className="outline-button" onClick={() => window.print()}><Download size={17} /> PDF olarak yazdır</button></section><section className="table-card"><div className="table-heading"><div><h3>Dönem karşılaştırması</h3><p>Temel finansal göstergeler</p></div></div><div className="responsive-table"><table><thead><tr><th>Dönem</th><th>Toplam limit</th><th>Toplam borç</th><th>Yapılandırma</th><th>Aylık ödeme</th><th>KMH borcu</th><th>Asgari ödeme</th></tr></thead><tbody>{summaries.map((item) => <tr key={item.id}><td><b>{item.period}</b></td><td>{formatMoney(item.total_limit)}</td><td>{formatMoney(item.total_debt)}</td><td>{formatMoney(item.restructuring)}</td><td>{formatMoney(item.monthly_payment)}</td><td>{formatMoney(item.overdraft_debt)}</td><td>{formatMoney(item.minimum_payment)}</td></tr>)}</tbody></table></div></section></>;
}

function FilesView({ files, organizationId, onUpload }: { files: FileItem[]; organizationId: string; onUpload: () => void }) {
  return <section className="files-panel"><div className="upload-zone" onClick={onUpload}><div><Upload size={25} /></div><h3>Dosya veya görsel yükleyin</h3><p>PDF, Excel, CSV, PNG, JPG veya WebP · En fazla 10 MB</p><button className="panel-primary">Dosya seç</button></div><div className="file-list"><h3>Son belgeler</h3>{files.length ? files.map((file) => <a key={file.id} href={`/api/uploads/${file.id}?organizationId=${encodeURIComponent(organizationId)}`} target="_blank" rel="noreferrer"><div className="file-icon"><FileSpreadsheet size={19} /></div><span><b>{file.file_name}</b><small>{file.full_name} · {(file.size_bytes / 1024).toLocaleString("tr-TR", { maximumFractionDigits: 0 })} KB</small></span><Download size={17} /></a>) : <EmptyState icon={Files} title="Henüz belge yüklenmedi" text="Dekont, tablo, şirket görseli ve destekleyici belgeleri burada saklayabilirsiniz." />}</div></section>;
}

function CompanyView({ organization, profile, canManage, onEdit }: { organization: Organization; profile: CompanyProfile; canManage: boolean; onEdit: () => void }) {
  const items = [
    ["Ticari unvan", profile?.legal_name], ["Faaliyet alanı", profile?.sector], ["Vergi dairesi", profile?.tax_office],
    ["Vergi numarası", profile?.tax_number], ["MERSİS numarası", profile?.mersis_number], ["Ticaret sicil no", profile?.trade_registry_number],
    ["Telefon", profile?.phone], ["E-posta", profile?.email], ["İnternet sitesi", profile?.website], ["Adres", profile?.address],
  ];
  return <section className="company-panel"><div className="company-profile-head"><div className="company-avatar"><Building2 size={30} /></div><div><span>{organization.kind === "business" ? "FİRMA PROFİLİ" : "BİREYSEL PROFİL"}</span><h2>{profile?.legal_name || organization.name}</h2><p>{profile?.about || "Profil bilgileri henüz tamamlanmadı."}</p></div>{canManage && <button className="panel-primary" onClick={onEdit}><Settings size={16} /> Bilgileri düzenle</button>}</div><div className="company-info-grid">{items.map(([label, value]) => <div key={label}><span>{label}</span><b>{value || "Henüz girilmedi"}</b></div>)}</div><div className="company-privacy"><ShieldCheck size={19} /><span><b>Şirkete özel kayıt</b>Bu bilgiler yalnızca bu çalışma alanına erişimi olan kişiler ve Teksanor platform yetkilileri tarafından görülebilir.</span></div></section>;
}

function UsersView({ onAdd }: { onAdd: () => void }) { return <section className="users-panel"><div className="users-illustration"><Users size={34} /></div><h2>Ekibiniz için kontrollü erişim</h2><p>admin1, admin2 ve diğer kullanıcılar aynı kurumsal giriş ekranını kullanır; yetkiler arka planda uygulanır.</p><div className="role-grid"><div><ShieldCheck /><b>Yönetici</b><span>Tüm kayıtları görür, silebilir, altın referans fiyatlarını ve kullanıcıları yönetir.</span></div><div><Database /><b>Kullanıcı</b><span>Veri ve belge ekler; kayıtları ayrıca onay beklemeden doğrudan sisteme işlenir.</span></div></div><button className="panel-primary" onClick={onAdd}><UserPlus size={17} /> Kullanıcı oluştur</button></section>; }

function EmptyState({ icon: Icon, title, text }: { icon: typeof Files; title: string; text: string }) { return <div className="empty-state"><Icon size={26} /><b>{title}</b><p>{text}</p></div>; }

type ModalType = "payment" | "expense" | "user" | "balance" | "manualDebt" | "rates" | "password" | "company" | "project";

function EntryModal({ type, latestPeriod, treasury, profile, organizationId, close, complete, setError }: { type: ModalType; latestPeriod: string; treasury: TreasuryData | null; profile: CompanyProfile; organizationId: string; close: () => void; complete: (text: string) => Promise<void>; setError: (text: string) => void }) {
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    const form = new FormData(event.currentTarget); const payload = Object.fromEntries(form.entries());
    if (type === "password" && payload.newPassword !== payload.confirmPassword) {
      setSaving(false); setError("Yeni parolalar birbiriyle aynı olmalıdır."); return;
    }
    const endpoint = type === "project" ? "/api/projects" : type === "payment" ? "/api/payments" : type === "expense" ? "/api/expenses" : type === "user" ? "/api/users" : type === "password" ? "/api/auth/password" : type === "company" ? "/api/organization" : "/api/treasury";
    if (type === "balance") payload.action = "balance";
    if (type === "manualDebt") payload.action = "debt";
    if (type === "rates") payload.action = "rates";
    const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", "X-Organization-Id": organizationId }, body: JSON.stringify(payload) });
    const result = await response.json() as { error?: string };
    setSaving(false);
    if (!response.ok) { setError(result.error ?? "Kayıt eklenemedi."); close(); return; }
    await complete(type === "project" ? "Proje çalışma alanına eklendi." : type === "user" ? "Kullanıcı oluşturuldu." : type === "rates" ? "Altın referans fiyatları güncellendi." : type === "password" ? "Parolanız güvenle değiştirildi." : type === "company" ? "Firma bilgileri güncellendi." : "Kayıt doğrudan sisteme eklendi.");
  }
  const headings: Record<ModalType, [string, string]> = {
    payment: ["FİNANS KAYDI", "Yeni ödeme veya borç"], expense: ["GİDER KAYDI", "Yeni gider"],
    user: ["KULLANICI", "Yeni kullanıcı oluştur"], balance: ["ELDEKİ VARLIK", "Nakit veya döviz ekle"],
    manualDebt: ["ELDEN BORÇ", "Elden alınan borç ekle"], rates: ["REFERANS FİYAT", "Altın TL karşılıklarını güncelle"],
    password: ["HESAP GÜVENLİĞİ", "Parolanızı değiştirin"],
    company: ["KURUMSAL PROFİL", "Firma bilgilerini düzenleyin"],
    project: ["PROJE PORTFÖYÜ", "Yeni proje oluşturun"],
  };
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && close()}><form className="entry-modal" onSubmit={submit}><div className="modal-head"><div><span>{headings[type][0]}</span><h2>{headings[type][1]}</h2></div><button type="button" onClick={close} aria-label="Pencereyi kapat"><X size={19} /></button></div>{type === "payment" && <PaymentFields period={latestPeriod} />}{type === "expense" && <ExpenseFields period={latestPeriod} />}{type === "user" && <UserFields />}{type === "balance" && <BalanceFields />}{type === "manualDebt" && <ManualDebtFields />}{type === "rates" && <RateFields references={treasury?.references ?? {}} />}{type === "password" && <PasswordFields />}{type === "company" && <CompanyFields profile={profile} />}{type === "project" && <ProjectFields />}<div className="modal-actions"><button className="outline-button" type="button" onClick={close}>Vazgeç</button><button className="panel-primary" disabled={saving}>{saving ? "Kaydediliyor..." : type === "password" ? "Parolayı değiştir" : "Kaydı tamamla"}</button></div></form></div>;
}

function ProjectFields() { return <div className="form-grid"><label className="full"><span>Proje adı</span><input name="name" placeholder="Örn. Üretim hattı veri izleme sistemi" required /></label><label><span>Proje kodu</span><input name="code" placeholder="Örn. PRJ-2026-01" /></label><label><span>Departman</span><select name="department" required><option>Proje ve mühendislik</option><option>Finans ve mali işler</option><option>Operasyon ve satın alma</option><option>Satış ve müşteri ilişkileri</option><option>İnsan ve organizasyon</option><option>Yönetim ve strateji</option></select></label><label><span>Proje sorumlusu</span><input name="ownerName" placeholder="Ad soyad veya ekip" /></label><label><span>Durum</span><select name="status"><option value="planning">Planlama</option><option value="active">Devam ediyor</option><option value="on_hold">Beklemede</option><option value="completed">Tamamlandı</option></select></label><label><span>Öncelik</span><select name="priority"><option value="normal">Normal</option><option value="high">Yüksek</option><option value="critical">Kritik</option><option value="low">Düşük</option></select></label><label><span>Başlangıç tarihi</span><input name="startDate" type="date" /></label><label><span>Hedef tarih</span><input name="targetDate" type="date" /></label><label><span>Planlanan bütçe</span><div className="money-input"><input name="budget" type="number" min="0" step="0.01" /><em>₺</em></div></label><label><span>İlerleme (%)</span><input name="progress" type="number" min="0" max="100" defaultValue="0" /></label><label className="full"><span>Kapsam ve beklenen sonuç</span><textarea name="description" rows={4} placeholder="Projenin amacı, teslim edilecek işler ve başarı ölçütleri..." /></label></div>; }

function PaymentFields({ period }: { period: string }) { return <div className="form-grid"><label><span>Dönem</span><input name="period" defaultValue={period} required /></label><label><span>Kişi / sorumlu</span><input name="ownerName" placeholder="Örn. Finans sorumlusu" required /></label><label><span>Banka</span><input name="bankName" placeholder="Örn. Garanti" required /></label><label><span>Hesap veya kart adı</span><input name="accountName" placeholder="Örn. Kredi kartı" required /></label><MoneyInput name="totalLimit" label="Toplam limit" /><MoneyInput name="totalDebt" label="Toplam borç" /><MoneyInput name="restructuring" label="Yapılandırma" /><MoneyInput name="monthlyPayment" label="Aylık ödeme" /><MoneyInput name="nextInstallment" label="Gelecek dönem taksit" /><MoneyInput name="overdraftDebt" label="KMH borcu" /><MoneyInput name="overdraftLimit" label="KMH limiti" /><MoneyInput name="minimumPayment" label="Asgari ödeme" /><label><span>Son ödeme tarihi</span><input type="date" name="dueDate" /></label><label className="full"><span>Önemli not</span><textarea name="importantNote" rows={3} placeholder="Gecikme, ödeme planı veya takip notu..." /></label></div>; }
function MoneyInput({ name, label }: { name: string; label: string }) { return <label><span>{label}</span><div className="money-input"><input name={name} type="number" min="0" step="0.01" placeholder="0" /><em>₺</em></div></label>; }
function ExpenseFields({ period }: { period: string }) { return <div className="form-grid"><label><span>Dönem</span><input name="period" defaultValue={period} required /></label><label><span>Kişi / sorumlu</span><input name="ownerName" required /></label><label><span>Kategori</span><select name="category" required><option>Kira</option><option>Fatura</option><option>Mutfak</option><option>Yakıt</option><option>Şirket harcaması</option><option>Diğer</option></select></label><label><span>Tutar</span><div className="money-input"><input name="amount" type="number" min="0" step="0.01" required /><em>₺</em></div></label><label className="full"><span>Açıklama</span><input name="description" placeholder="Giderin kısa açıklaması" required /></label><label><span>Ödeme tarihi</span><input name="dueDate" type="date" /></label></div>; }
function UserFields() { return <div className="form-grid"><label><span>Kullanıcı adı</span><input name="username" pattern="[a-zA-Z0-9._-]{3,32}" placeholder="Örn. finans1" required /></label><label><span>Görünen ad</span><input name="fullName" placeholder="Örn. Finans Kullanıcısı" required /></label><label><span>Geçici parola (en az 10 karakter)</span><input name="password" type="password" minLength={10} maxLength={128} required /></label><label><span>Yetki</span><select name="role"><option value="user">Kullanıcı</option><option value="admin">Firma yetkilisi</option></select></label><div className="full form-help">Firma yetkilisi kullanıcı ve kritik finans ayarlarını yönetebilir. Normal kullanıcı veri ve belge ekleyebilir.</div></div>; }
function PasswordFields() { return <div className="form-grid"><label className="full"><span>Mevcut parola</span><input name="currentPassword" type="password" autoComplete="current-password" required /></label><label><span>Yeni parola</span><input name="newPassword" type="password" minLength={10} maxLength={128} autoComplete="new-password" required /></label><label><span>Yeni parola tekrar</span><input name="confirmPassword" type="password" minLength={10} maxLength={128} autoComplete="new-password" required /></label><div className="full form-help">Yeni parolanız en az 10 karakter olmalı. Değişiklikten sonra diğer cihazlardaki oturumlar kapatılır.</div></div>; }
function CurrencyOptions() { return <>{fiatCodes.map((code) => <option key={code} value={code}>{currencyLabels[code]} ({code})</option>)}<optgroup label="Altın ve ziynet">{goldCodes.map((code) => <option key={code} value={code}>{currencyLabels[code]}</option>)}</optgroup></>; }
function BalanceFields() { return <div className="form-grid"><label><span>Hesap / kasa adı</span><input name="accountName" placeholder="Örn. Merkez kasa" required /></label><label><span>Para veya altın birimi</span><select name="currency"><CurrencyOptions /></select></label><label><span>Tutar / adet</span><input name="amount" type="number" min="0.01" step="0.01" required /></label><label><span>İsteğe bağlı özel TL kuru / fiyatı</span><input name="manualRate" type="number" min="0" step="0.0001" placeholder="Boşsa TCMB veya altın referansı" /></label><label className="full"><span>Not</span><input name="note" placeholder="İsteğe bağlı açıklama" /></label><div className="full form-help">Dövizlerde TCMB satış kuru otomatik kullanılır. Altın için firma yetkilisinin kaydettiği fiyat veya bu alandaki özel fiyat kullanılır.</div></div>; }
function ManualDebtFields() { return <div className="form-grid"><label><span>Borç alınan kişi / kurum</span><input name="lenderName" required /></label><label><span>Borç türü</span><select name="debtType"><option value="cash">Nakit / döviz</option><option value="gold">Altın / ziynet</option><option value="other">Diğer</option></select></label><label><span>Para veya altın birimi</span><select name="currency"><CurrencyOptions /></select></label><label><span>Miktar / adet</span><input name="amount" type="number" min="0.01" step="0.01" required /></label><label><span>Bu kayda özel TL birim fiyatı</span><input name="manualRate" type="number" min="0" step="0.0001" placeholder="Boşsa otomatik kur/referans" /></label><label><span>Vade</span><input name="dueDate" type="date" /></label><label className="full"><span>Not</span><textarea name="note" rows={3} placeholder="Borç açıklaması veya ödeme planı" /></label></div>; }
function RateFields({ references }: { references: Record<string, number> }) { return <div className="form-grid">{[["gramGold", "GRAM_GOLD"], ["quarterGold", "QUARTER_GOLD"], ["halfGold", "HALF_GOLD"], ["fullGold", "FULL_GOLD"], ["republicGold", "REPUBLIC_GOLD"], ["ataGold", "ATA_GOLD"], ["bracelet22kGram", "BRACELET_22K_GRAM"]].map(([name, code]) => <label key={code}><span>{currencyLabels[code]} TL birim fiyatı</span><input name={name} type="number" min="0" step="0.01" defaultValue={references[code] || ""} placeholder="Güncel satış fiyatı" /></label>)}<div className="full form-help">Altın için tek ve resmî bir muhasebe kuru bulunmadığından, kullandığınız kuyumcu veya banka satış fiyatını referans olarak girin.</div></div>; }
function CompanyFields({ profile }: { profile: CompanyProfile }) { return <div className="form-grid"><label className="full"><span>Ticari unvan</span><input name="legalName" defaultValue={profile?.legal_name ?? ""} /></label><label><span>Faaliyet alanı</span><input name="sector" defaultValue={profile?.sector ?? ""} placeholder="Örn. Mühendislik ve teknoloji" /></label><label><span>Vergi dairesi</span><input name="taxOffice" defaultValue={profile?.tax_office ?? ""} /></label><label><span>Vergi numarası</span><input name="taxNumber" defaultValue={profile?.tax_number ?? ""} inputMode="numeric" /></label><label><span>MERSİS numarası</span><input name="mersisNumber" defaultValue={profile?.mersis_number ?? ""} inputMode="numeric" /></label><label><span>Ticaret sicil numarası</span><input name="tradeRegistryNumber" defaultValue={profile?.trade_registry_number ?? ""} /></label><label><span>Telefon</span><input name="phone" defaultValue={profile?.phone ?? ""} type="tel" /></label><label><span>E-posta</span><input name="email" defaultValue={profile?.email ?? ""} type="email" /></label><label className="full"><span>İnternet sitesi</span><input name="website" defaultValue={profile?.website ?? ""} placeholder="https://..." /></label><label className="full"><span>Adres</span><textarea name="address" defaultValue={profile?.address ?? ""} rows={3} /></label><label className="full"><span>Kısa şirket tanıtımı</span><textarea name="about" defaultValue={profile?.about ?? ""} rows={4} placeholder="Şirketinizi sade ve gerçek bilgilerle tanıtın." /></label><div className="full form-help">Resmî kayıt yoksa vergi, MERSİS ve sicil alanlarını boş bırakabilirsiniz. Doğrulanmamış bilgi eklemeyin.</div></div>; }
