// T2: Sade ana menü — 5 madde. Az kullanılan ekranlar "Diğer" altında; hangilerinin görüneceğini firmanın
// sektör şablonu belirler (Firma bilgileri → Sektör). Yetki filtreleri (görme izni) ayrıca uygulanır.

export type MainMenuItem = { key: "today" | "work" | "calendar" | "customers" | "money"; label: string; ids: string[]; href?: string };

export const MAIN_MENU: MainMenuItem[] = [
  { key: "today", label: "Bugün", ids: ["overview"] },
  { key: "work", label: "İşler", ids: ["tasks", "work-orders", "field-visits"] },
  { key: "calendar", label: "Takvim", ids: [], href: "/servis/plan" },
  { key: "customers", label: "Müşteriler", ids: ["crm"] },
  { key: "money", label: "Para", ids: ["expenses", "financial", "payments", "treasury", "reports"] },
];

/** "Diğer" altına girebilecek tüm ekranlar (sabit sıra). */
export const OTHER_IDS = ["assets", "maintenance", "projects", "procurement", "hr", "risks", "files", "automations", "agents", "company"] as const;

export type SectorTemplate = "teknik-servis" | "bakim-onarim" | "taahhut" | "genel";

const TEMPLATE_OTHER: Record<SectorTemplate, readonly string[]> = {
  "teknik-servis": ["assets", "maintenance", "procurement", "hr", "files", "company"],
  "bakim-onarim": ["assets", "maintenance", "hr", "files", "company"],
  taahhut: ["projects", "procurement", "hr", "risks", "files", "company"],
  genel: OTHER_IDS,
};

const fold = (v: string) => v.toLocaleLowerCase("tr-TR").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i");

/** Firma bilgilerindeki sektör yazısından şablon. Tanınmayan veya boş sektörde hiçbir ekran gizlenmez. */
export function sectorTemplate(sector: string | null | undefined): SectorTemplate {
  const s = fold(String(sector ?? ""));
  if (/taahhut|muhendislik|insaat|proje/.test(s)) return "taahhut";
  if (/bakim|onarim/.test(s)) return "bakim-onarim";
  if (/servis|teknik/.test(s)) return "teknik-servis";
  return "genel";
}

/** "Diğer" altında gösterilecek ekranlar: şablonda olan + kullanıcının görebildiği. Firma bilgileri her zaman kalır. */
export function otherModules(sector: string | null | undefined, canView: (id: string) => boolean): string[] {
  const allowed = new Set(TEMPLATE_OTHER[sectorTemplate(sector)]);
  allowed.add("company");
  return OTHER_IDS.filter((id) => allowed.has(id) && canView(id));
}

/** Ana menü: kullanıcının görebildiği ekranı olmayan madde gösterilmez (Takvim, iş emri görebilenlere açılır). */
export function mainMenu(canView: (id: string) => boolean): MainMenuItem[] {
  return MAIN_MENU.filter((m) => (m.key === "calendar" ? canView("work-orders") : m.ids.some(canView)));
}
