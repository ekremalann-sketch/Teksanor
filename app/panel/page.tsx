"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  UserRound,
  Factory,
  CalendarCheck2,
  MapPin,
  CheckSquare,
  ShoppingCart,
  AlertTriangle,
  LogOut,
} from "lucide-react";

type Org = { id: string; name: string; role?: string };
type Dashboard = {
  user: { full_name: string; email: string };
  organization: Org;
  organizations: Org[];
  stats: { label: string; value: number | string }[];
};

const STATUS_LABELS: Record<string, string> = {
  open: "Açık",
  assigned: "Atandı",
  in_progress: "Devam ediyor",
  completed: "Tamamlandı",
  cancelled: "İptal",
  planned: "Planlandı",
  active: "Aktif",
  pending: "Bekliyor",
  done: "Tamamlandı",
};

function tr(status: string) {
  return STATUS_LABELS[status] || status || "-";
}

const NAV = [
  { key: "overview", label: "Genel bakış", icon: LayoutDashboard },
  { key: "work-orders", label: "İş emirleri", icon: ClipboardList },
  { key: "customers", label: "Müşteriler", icon: Users },
  { key: "employees", label: "Çalışanlar", icon: UserRound },
  { key: "assets", label: "Varlıklar", icon: Factory },
  { key: "maintenance", label: "Bakım planları", icon: CalendarCheck2 },
  { key: "field-visits", label: "Saha ziyaretleri", icon: MapPin },
  { key: "tasks", label: "Görevler", icon: CheckSquare },
  { key: "procurement", label: "Satın alma", icon: ShoppingCart },
  { key: "risks", label: "Riskler", icon: AlertTriangle },
] as const;

// Which JSON key each list endpoint returns, and the columns to show
const LISTS: Record<string, { endpoint: string; dataKey: string; columns: [string, string][] }> = {
  customers: { endpoint: "/api/customers", dataKey: "customers", columns: [["name", "Ad"], ["phone", "Telefon"], ["email", "E-posta"], ["status", "Durum"]] },
  employees: { endpoint: "/api/employees", dataKey: "employees", columns: [["full_name", "Ad soyad"], ["title", "Görev"], ["department", "Departman"], ["status", "Durum"]] },
  assets: { endpoint: "/api/assets", dataKey: "assets", columns: [["name", "Varlık"], ["asset_code", "Kod"], ["location", "Konum"], ["status", "Durum"]] },
  maintenance: { endpoint: "/api/maintenance", dataKey: "maintenancePlans", columns: [["title", "Plan"], ["frequency_type", "Sıklık"], ["next_due_date", "Sonraki tarih"], ["status", "Durum"]] },
  "field-visits": { endpoint: "/api/field-visits", dataKey: "fieldVisits", columns: [["customer_name", "Müşteri"], ["location", "Konum"], ["visit_date", "Tarih"], ["status", "Durum"]] },
  tasks: { endpoint: "/api/tasks", dataKey: "tasks", columns: [["title", "Görev"], ["assignee_name", "Sorumlu"], ["due_date", "Termin"], ["status", "Durum"]] },
  procurement: { endpoint: "/api/procurement", dataKey: "procurement", columns: [["title", "Talep"], ["supplier_name", "Tedarikçi"], ["quantity", "Adet"], ["status", "Durum"]] },
  risks: { endpoint: "/api/risks", dataKey: "risks", columns: [["title", "Risk"], ["category", "Kategori"], ["impact", "Etki"], ["status", "Durum"]] },
};

export default function PanelPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [orgId, setOrgId] = useState<string>("");
  const [active, setActive] = useState<string>("overview");
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const headers = useMemo(() => {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (orgId) h["X-Organization-Id"] = orgId;
    return h;
  }, [orgId]);

  const loadDashboard = useCallback(
    async (org?: string) => {
      const res = await fetch("/api/dashboard", {
        headers: org ? { "X-Organization-Id": org } : undefined,
        cache: "no-store",
      });
      if (res.status === 401) {
        router.push("/giris");
        return;
      }
      const data = (await res.json()) as Dashboard;
      setDash(data);
      if (!org && data.organization?.id) setOrgId(data.organization.id);
      setLoading(false);
    },
    [router],
  );

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  }

  function switchOrg(id: string) {
    setOrgId(id);
    setLoading(true);
    loadDashboard(id);
  }

  if (loading || !dash) {
    return <div className="panel-loading">Panel yükleniyor…</div>;
  }

  return (
    <div className="panel-shell">
      <div className="panel-topbar">
        <Link className="brand-link" href="/">
          <img src="/assets/teksanor-logo.png" alt="Teksanor" style={{ height: 26 }} />
        </Link>
        <div className="panel-topbar-actions">
          {dash.organizations?.length > 1 && (
            <select value={orgId} onChange={(e) => switchOrg(e.target.value)}>
              {dash.organizations.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          )}
          <span>{dash.user?.full_name}</span>
          <button onClick={logout}>
            <LogOut size={15} /> Çıkış
          </button>
        </div>
      </div>

      <div className="panel-body">
        <nav className="panel-nav">
          {NAV.map(({ key, label, icon: Icon }) => (
            <button key={key} className={active === key ? "active" : ""} onClick={() => { setActive(key); setMsg(null); }}>
              <Icon size={17} /> {label}
            </button>
          ))}
        </nav>

        <main className="panel-main">
          {msg && <div className={`panel-msg ${msg.kind}`}>{msg.text}</div>}

          {active === "overview" && (
            <>
              <div className="panel-header">
                <h1>Genel bakış</h1>
                <p>{dash.organization?.name}</p>
              </div>
              <div className="stat-grid">
                {(dash.stats || []).map((s) => (
                  <div className="stat-card" key={s.label}>
                    <small>{s.label}</small>
                    <b>{s.value}</b>
                  </div>
                ))}
              </div>
              <div className="card">
                <h2>Hızlı başlangıç</h2>
                <p className="muted">Sol menüden bir modül seçin. İş emirleri bölümünden yeni iş emri oluşturabilir, durumunu güncelleyebilirsiniz.</p>
              </div>
            </>
          )}

          {active === "work-orders" && <WorkOrders headers={headers} setMsg={setMsg} />}

          {LISTS[active] && <ListModule key={active} config={LISTS[active]} headers={headers} title={NAV.find((n) => n.key === active)?.label || ""} />}
        </main>
      </div>
    </div>
  );
}

/* ---------- Work orders (full CRUD) ---------- */
type WorkOrder = {
  id: string;
  order_number?: string;
  title: string;
  customer_name?: string;
  location?: string;
  priority?: string;
  status: string;
  assigned_to?: string;
};

function WorkOrders({
  headers,
  setMsg,
}: {
  headers: Record<string, string>;
  setMsg: (m: { kind: "ok" | "error"; text: string } | null) => void;
}) {
  const [items, setItems] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ title: "", customerName: "", location: "", priority: "normal", assignedTo: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/work-orders", { headers, cache: "no-store" });
    const data = (await res.json()) as { workOrders?: WorkOrder[] };
    setItems(data.workOrders || []);
    setLoading(false);
  }, [headers]);

  useEffect(() => {
    load();
  }, [load]);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    const res = await fetch("/api/work-orders", { method: "POST", headers, body: JSON.stringify(form) });
    const data = (await res.json()) as { error?: string };
    setSaving(false);
    if (!res.ok) {
      setMsg({ kind: "error", text: data.error || "İş emri oluşturulamadı." });
      return;
    }
    setMsg({ kind: "ok", text: "İş emri oluşturuldu." });
    setForm({ title: "", customerName: "", location: "", priority: "normal", assignedTo: "" });
    load();
  }

  async function updateStatus(id: string, status: string) {
    const res = await fetch(`/api/work-orders/${id}`, { method: "PATCH", headers, body: JSON.stringify({ status }) });
    if (res.ok) {
      setMsg({ kind: "ok", text: "Durum güncellendi." });
      load();
    } else {
      const data = (await res.json()) as { error?: string };
      setMsg({ kind: "error", text: data.error || "Güncellenemedi." });
    }
  }

  return (
    <>
      <div className="panel-header">
        <h1>İş emirleri</h1>
        <p>Yeni iş emri oluşturun, atayın ve durumunu takip edin.</p>
      </div>

      <div className="card">
        <h2>Yeni iş emri</h2>
        <form onSubmit={create}>
          <div className="form-row">
            <input placeholder="Başlık *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            <input placeholder="Müşteri" value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} />
            <input placeholder="Konum" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </div>
          <div className="form-row">
            <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              <option value="low">Düşük öncelik</option>
              <option value="normal">Orta öncelik</option>
              <option value="high">Yüksek öncelik</option>
              <option value="critical">Kritik</option>
            </select>
            <input placeholder="Atanan kişi" value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })} />
          </div>
          <button className="btn" type="submit" disabled={saving}>
            {saving ? "Kaydediliyor…" : "İş emri oluştur"}
          </button>
        </form>
      </div>

      <div className="card">
        <h2>İş emri listesi</h2>
        {loading ? (
          <p className="muted">Yükleniyor…</p>
        ) : items.length === 0 ? (
          <p className="muted">Henüz iş emri yok.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>No</th>
                <th>Başlık</th>
                <th>Müşteri</th>
                <th>Öncelik</th>
                <th>Durum</th>
                <th>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {items.map((w) => (
                <tr key={w.id}>
                  <td>{w.order_number || "-"}</td>
                  <td>{w.title}</td>
                  <td>{w.customer_name || "-"}</td>
                  <td>
                    <span className={`badge ${w.priority || ""}`}>{tr(w.priority || "")}</span>
                  </td>
                  <td>
                    <span className={`badge ${w.status}`}>{tr(w.status)}</span>
                  </td>
                  <td>
                    <select className="btn small ghost" defaultValue="" onChange={(e) => e.target.value && updateStatus(w.id, e.target.value)}>
                      <option value="">Durum değiştir…</option>
                      <option value="assigned">Atandı</option>
                      <option value="in_progress">Devam ediyor</option>
                      <option value="completed">Tamamlandı</option>
                      <option value="cancelled">İptal</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

/* ---------- Generic read-only list module ---------- */
function ListModule({
  config,
  headers,
  title,
}: {
  config: { endpoint: string; dataKey: string; columns: [string, string][] };
  headers: Record<string, string>;
  title: string;
}) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(config.endpoint, { headers, cache: "no-store" })
      .then((r) => r.json())
      .then((d: Record<string, unknown>) => {
        if (!alive) return;
        setRows((d[config.dataKey] as Record<string, unknown>[]) || []);
        setLoading(false);
      })
      .catch(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [config, headers]);

  return (
    <>
      <div className="panel-header">
        <h1>{title}</h1>
      </div>
      <div className="card">
        {loading ? (
          <p className="muted">Yükleniyor…</p>
        ) : rows.length === 0 ? (
          <p className="muted">Kayıt bulunamadı.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                {config.columns.map(([, label]) => (
                  <th key={label}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={(row.id as string) || i}>
                  {config.columns.map(([field]) => {
                    const val = row[field];
                    if (field === "status") return <td key={field}><span className={`badge ${String(val || "")}`}>{tr(String(val || ""))}</span></td>;
                    return <td key={field}>{val == null || val === "" ? "-" : String(val)}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
