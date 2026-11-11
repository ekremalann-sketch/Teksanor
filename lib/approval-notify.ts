// T10: Müşteri teklifi onaylayınca / reddedince veya işi teslim alınca firma anında haberdar olur.
// Uygulama içi bildirim (ücretsiz): firmanın yöneticilerine ve işin sorumlusuna birer kayıt.
// Bildirim, onayı yazan aynı D1 toplu işleminde ve yalnız iş gerçekten yeni aşamaya geçtiyse oluşur.
import type { getDb } from "@/lib/db";
type D1Database = ReturnType<typeof getDb>;

export const MANAGER_PROFILES = ["owner", "company_admin", "ceo", "manager"] as const;

export type ApprovalEvent = "quote_approved" | "quote_rejected" | "work_accepted";

export function approvalMessage(event: ApprovalEvent, job: { title: string; order_number?: string | null; customer_name?: string | null }, extra = "") {
  const who = job.customer_name || "Müşteri";
  const ref = job.order_number ? ` (${job.order_number})` : "";
  if (event === "quote_approved") return { title: `Teklif onaylandı: ${job.title}${ref}`, body: `${who} teklifi onayladı. İşi planlayabilirsiniz.`, type: "success" as const };
  if (event === "quote_rejected") return { title: `Teklif reddedildi: ${job.title}${ref}`, body: `${who} teklifi reddetti.${extra ? ` Gerekçe: ${extra}` : ""}`, type: "warning" as const };
  return { title: `İş teslim alındı: ${job.title}${ref}`, body: `${who} işi onaylayıp teslim aldı. Tahsilata geçebilirsiniz.`, type: "success" as const };
}

/**
 * Aynı toplu işleme eklenecek INSERT…SELECT. Koşul: iş beklenen yeni aşamada ve yeni sürümde (yani onay yazıldı).
 * Alıcılar: aktif sahip/yönetici üyeler ve işin atanan sorumlusu (tekrarsız).
 */
export function approvalNotificationStatement(
  db: D1Database,
  p: { organizationId: string; jobId: string; expectedStage: string; expectedVersion: number; title: string; body: string; type: string },
) {
  const managers = MANAGER_PROFILES.map(() => "?").join(",");
  return db.prepare(`INSERT INTO notifications (id, organization_id, user_id, title, body, type, entity_type, entity_id)
    SELECT 'notif_' || lower(hex(randomblob(12))), ?, r.user_id, ?, ?, ?, 'service_job', ?
    FROM (
      SELECT m.user_id FROM organization_members m
        LEFT JOIN organization_member_access a ON a.organization_id = m.organization_id AND a.user_id = m.user_id
        WHERE m.organization_id = ? AND m.active = 1 AND (m.role IN ('owner','admin') OR a.access_profile IN (${managers}))
      UNION
      SELECT s.assigned_user_id FROM service_jobs s WHERE s.id = ? AND s.organization_id = ? AND s.assigned_user_id IS NOT NULL
    ) r
    WHERE EXISTS (SELECT 1 FROM service_jobs s WHERE s.id = ? AND s.organization_id = ? AND s.stage = ? AND s.version = ?)`)
    .bind(p.organizationId, p.title, p.body.slice(0, 800), p.type, p.jobId, p.organizationId, ...MANAGER_PROFILES, p.jobId, p.organizationId, p.jobId, p.organizationId, p.expectedStage, p.expectedVersion);
}
