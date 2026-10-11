// Erişim profilleri ve modül görünürlüğü: sunucu ve istemci ortak kullanır (veri tabanı bağımlılığı yok).
// İstemcide yalnız menü/ana ekran/rol önizlemesi içindir; yetki her zaman sunucuda uygulanır.
export const moduleIds = [
  "overview", "departments", "projects", "tasks", "work-orders", "assets", "maintenance",
  "field-visits", "procurement", "crm", "hr", "risks", "automations", "agents", "readiness",
  "financial", "payments", "expenses", "treasury", "reports", "files", "company", "users",
] as const;

export type ModuleId = typeof moduleIds[number];

export type AccessProfile = "owner" | "company_admin" | "ceo" | "manager" | "finance" | "hr" | "it" | "employee";
type Rule = { view: ModuleId[]; edit: ModuleId[]; label: string };
const operational: ModuleId[] = ["overview", "departments", "projects", "tasks", "work-orders", "assets", "maintenance", "field-visits", "procurement", "crm", "risks", "automations", "agents", "readiness", "reports", "files", "company"];
const finance: ModuleId[] = ["financial", "payments", "expenses", "treasury", "reports"];

export const accessRules: Record<AccessProfile, Rule> = {
  owner: { label: "Firma sahibi", view: [...moduleIds], edit: [...moduleIds] },
  company_admin: { label: "Firma yöneticisi", view: [...moduleIds], edit: [...moduleIds] },
  ceo: { label: "Üst yönetim", view: [...operational, ...finance, "hr"], edit: [...operational, ...finance] },
  manager: { label: "Birim yöneticisi", view: operational, edit: ["projects", "tasks", "work-orders", "assets", "maintenance", "field-visits", "procurement", "crm", "risks", "files"] },
  finance: { label: "Finans ekibi", view: ["overview", "financial", "payments", "expenses", "treasury", "reports", "files", "company"], edit: ["payments", "expenses", "treasury", "reports", "files"] },
  hr: { label: "İnsan kaynakları", view: ["overview", "departments", "tasks", "hr", "reports", "files", "company"], edit: ["tasks", "hr", "files"] },
  it: { label: "Bilgi işlem", view: operational, edit: ["projects", "tasks", "work-orders", "assets", "maintenance", "automations", "agents", "readiness", "files"] },
  employee: { label: "Çalışan", view: ["overview", "departments", "projects", "tasks", "work-orders", "files", "company"], edit: ["tasks", "work-orders", "files"] },
};


/** Rolün girişte düşeceği ana ekran. Panel içi ekranlar "#panel=...", ayrı sayfalar tam yol olarak döner. */
export function homeFor(profile: AccessProfile, department?: string | null): string {
  const dep = (department || "").toLocaleLowerCase("tr-TR");
  if (profile === "finance") return "#panel=payments";
  if (profile === "hr") return "/birimler?birim=ik";
  if (profile === "it") return "/birimler?birim=bt";
  if (profile === "employee") return "/servis";
  if (profile === "manager" && dep.includes("satın alma")) return "#panel=procurement";
  if (profile === "manager" && (dep.includes("servis") || dep.includes("operasyon") || dep.includes("saha"))) return "/servis/plan";
  return "#panel=overview";
}
