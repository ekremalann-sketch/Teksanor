import { addAudit, getDb } from "./db";

// Acil durdurma: firmanın tüm otomasyon kurallarını tek anahtarla durdurur (kural ayarları silinmez).
// Açıkken zamanlanmış ve elle başlatılan çalıştırmalar yapılmaz; her değişiklik işlem kaydına yazılır.
const key = (organizationId: string) => `automation_paused:${organizationId}`;

export async function isAutomationPaused(organizationId: string) {
  const row = await getDb().prepare("SELECT value FROM app_metadata WHERE key = ?").bind(key(organizationId)).first<{ value: string }>();
  return row?.value === "1";
}

export async function setAutomationPaused(organizationId: string, paused: boolean, userId: string) {
  await getDb().prepare(`INSERT INTO app_metadata (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`).bind(key(organizationId), paused ? "1" : "0").run();
  await addAudit(userId, paused ? "automation.emergency_stop" : "automation.resume", "automation_rule", null,
    paused ? "Acil durdurma: firmanın tüm otomasyonları durduruldu." : "Otomasyonlar yeniden başlatıldı.", organizationId);
}
