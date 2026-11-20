// TG2: herkese açık durum sayfasının günlük çalışma kaydı.
// Her sağlık yoklaması (otomatik yoklama veya ziyaret) günün satırına yazılır; aynı gün 5 dakikada en fazla bir kayıt
// (açık uç üzerinden kayıt şişirilemez). Yoklama yapılmayan gün "veri yok" görünür; uydurma yüzde gösterilmez.
import { getDb } from "@/lib/db";

export const STATUS_DAYS = 90;
const SLOT_MS = 5 * 60_000;
export type DayState = "calisti" | "kesinti" | "veri-yok";
export type StatusDay = { day: string; state: DayState; ok: number; fail: number };

let ensured = false;
async function ensureStatusTable() {
  if (ensured) return;
  await getDb().prepare("CREATE TABLE IF NOT EXISTS status_daily(day TEXT PRIMARY KEY,ok_count INTEGER NOT NULL DEFAULT 0,fail_count INTEGER NOT NULL DEFAULT 0,last_failure TEXT,last_at INTEGER NOT NULL)").run();
  ensured = true;
}
const dayOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Yoklama sonucunu yazar. Başarısızlıkta yalnız bağımlılık adı (veritabanı/şema/depolama) tutulur, hata metni değil. */
export async function recordStatus(ok: boolean, dependency: string | null, now = Date.now()) {
  await ensureStatusTable();
  const day = dayOf(now);
  await getDb().prepare(`INSERT INTO status_daily(day,ok_count,fail_count,last_failure,last_at) VALUES(?,?,?,?,?)
    ON CONFLICT(day) DO UPDATE SET ok_count=ok_count+excluded.ok_count,fail_count=fail_count+excluded.fail_count,
    last_failure=coalesce(excluded.last_failure,last_failure),last_at=excluded.last_at
    WHERE ?-status_daily.last_at>=? OR excluded.fail_count>0`)
    .bind(day, ok ? 1 : 0, ok ? 0 : 1, ok ? null : dependency, now, now, SLOT_MS).run();
}

/** Son 90 gün; eskiden yeniye. Çalışma oranı yalnız verisi olan günlerdeki yoklamalardan hesaplanır. */
export async function statusHistory(now = Date.now()) {
  await ensureStatusTable();
  const from = dayOf(now - (STATUS_DAYS - 1) * 86_400_000);
  const rows = (await getDb().prepare("SELECT day,ok_count,fail_count FROM status_daily WHERE day>=? ORDER BY day").bind(from).all<{ day: string; ok_count: number; fail_count: number }>()).results ?? [];
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const days: StatusDay[] = [];
  for (let i = STATUS_DAYS - 1; i >= 0; i--) {
    const day = dayOf(now - i * 86_400_000), r = byDay.get(day);
    days.push(r ? { day, state: r.fail_count > 0 ? "kesinti" : "calisti", ok: r.ok_count, fail: r.fail_count } : { day, state: "veri-yok", ok: 0, fail: 0 });
  }
  const ok = days.reduce((s, d) => s + d.ok, 0), total = ok + days.reduce((s, d) => s + d.fail, 0);
  return { days, uptime: total ? Math.round((ok / total) * 10000) / 100 : null, daysWithData: days.filter((d) => d.state !== "veri-yok").length };
}
