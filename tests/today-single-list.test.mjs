// T7: altı ayrı uyarı yüzeyi tek "Bugün" listesinde birleşir.
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const { todayAlerts } = await import("../lib/today-alerts.ts");
const base = { today: "2026-11-11", tasks: [], risks: [], procurement: [], attentionCount: 0, canView: () => true };

test("uyarılar tek listede: önce kritik, sonra bekleyen", () => {
  const rows = todayAlerts({ ...base,
    tasks: [{ due_date: "2026-11-01", status: "todo" }, { due_date: "2026-11-01", status: "done" }, { due_date: "2026-12-01", status: "todo" }],
    risks: [{ impact: "critical", status: "open" }, { impact: "critical", status: "resolved" }],
    procurement: [{ status: "pending" }, { status: "pending" }, { status: "approved" }],
    attentionCount: 3 });
  assert.deepEqual(rows.map((r) => [r.key, r.label, r.level]), [
    ["tasks", "1 geciken görev", "critical"],
    ["risks", "1 kritik risk", "critical"],
    ["procurement", "2 satın alma onayı", "warning"],
    ["payments", "3 ödeme takibi", "warning"],
  ]);
});

test("yetkisi olmayan satır görünmez; iş yoksa liste boş", () => {
  assert.deepEqual(todayAlerts(base), []);
  const tech = todayAlerts({ ...base, attentionCount: 2, procurement: [{ status: "pending" }], canView: (p) => p === "tasks" });
  assert.deepEqual(tech, []);
});

test("ana ekranda ayrı onay ve aksiyon kutuları kalmadı; uyarılar Bugün kartına gidiyor", () => {
  const src = readFileSync(new URL("../components/Dashboard.tsx", import.meta.url), "utf8");
  const home = src.slice(src.indexOf("function CompanyHome"), src.indexOf("const departmentCatalog"));
  assert.doesNotMatch(home, /pending-approvals|proactive-action-center/);
  assert.match(home, /<TodayCard [^>]*alerts=\{alerts\}/);
  assert.equal((home.match(/<FlowsCard/g) || []).length, 1, "akış kartı yalnız 'Daha fazla' altında bir kez");
  const card = readFileSync(new URL("../components/home/TodayCard.tsx", import.meta.url), "utf8");
  assert.match(card, /<b id="today-title">Bugün<\/b>/);
});
