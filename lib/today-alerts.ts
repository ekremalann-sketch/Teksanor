// T7: Ana ekrandaki ayrı uyarı yüzeyleri (bekleyen onaylar, bugünün aksiyonları, finans takibi, kritik risk,
// geciken görev) tek "Bugün" listesinde birleşir. Sıra: önce kritik, sonra uyarı. Yetkisi olmayan satır görünmez.

export type TodayAlert = { key: string; label: string; text: string; page: string; level: "critical" | "warning" };

type Input = {
  today: string;
  tasks: { due_date?: string | null; status: string }[];
  risks: { impact: string; status: string }[];
  procurement: { status: string }[];
  attentionCount: number;
  canView: (page: string) => boolean;
};

export function todayAlerts({ today, tasks, risks, procurement, attentionCount, canView }: Input): TodayAlert[] {
  const overdue = tasks.filter((t) => t.due_date && t.due_date < today && !["done", "cancelled"].includes(t.status)).length;
  const critical = risks.filter((r) => r.impact === "critical" && !["resolved", "accepted"].includes(r.status)).length;
  const pending = procurement.filter((p) => p.status === "pending").length;
  const rows: (TodayAlert | null)[] = [
    overdue ? { key: "tasks", label: `${overdue} geciken görev`, text: "Termini geçti", page: "tasks", level: "critical" } : null,
    critical ? { key: "risks", label: `${critical} kritik risk`, text: "Önlem bekliyor", page: "risks", level: "critical" } : null,
    pending ? { key: "procurement", label: `${pending} satın alma onayı`, text: "Kararınızı bekliyor", page: "procurement", level: "warning" } : null,
    attentionCount ? { key: "payments", label: `${attentionCount} ödeme takibi`, text: "Vadesi yakın veya not düşülmüş", page: "payments", level: "warning" } : null,
  ];
  return rows.filter((r): r is TodayAlert => Boolean(r) && canView(r!.page));
}
