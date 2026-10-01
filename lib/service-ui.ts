// Servis masası ve "Bugün" kartı için ortak, saf yardımcılar (sunucu bağımlılığı yok; test edilir).
// Amaç: kullanıcı ne yapacağını düşünmesin — iş listesi önceliğe göre sıralanır ve her işin
// "sıradaki adımı" tek cümle + mümkünse tek düğme olarak gösterilir.

export type JobLike = { id: string; stage: string; scheduled_date?: string | null; title?: string; customer_name?: string | null; updated_at?: string };
export type Bucket = "overdue" | "today" | "week" | "later" | "unscheduled" | "closed";
export const CLOSED_STAGES = ["accepted", "collected", "cancelled"];
// Müşteri onayından sonra bile tahsilat adımı kalır; "kapalı" sayılan yalnız tahsil/iptal.
const DONE = ["collected", "cancelled"];

/** Kullanıcının yerel takvim günü (YYYY-AA-GG). UTC kullanılmaz: Türkiye'de gece yarısından sonra kayma olur. */
export function localDay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function addDays(day: string, n: number) {
  const [y, m, d] = day.split("-").map(Number);
  return localDay(new Date(y, m - 1, d + n, 12));
}

export function bucketOf(job: JobLike, today = localDay()): Bucket {
  if (DONE.includes(job.stage)) return "closed";
  const day = job.scheduled_date || "";
  if (!day) return "unscheduled";
  if (day < today) return "overdue";
  if (day === today) return "today";
  if (day <= addDays(today, 6)) return "week";
  return "later";
}

const ORDER: Bucket[] = ["overdue", "today", "week", "unscheduled", "later", "closed"];
/** Geciken → bugün → bu hafta → tarihsiz → ileri → kapalı; aynı grupta tarihe göre. */
export function sortJobs<T extends JobLike>(jobs: T[], today = localDay()): T[] {
  return [...jobs].sort((a, b) => {
    const d = ORDER.indexOf(bucketOf(a, today)) - ORDER.indexOf(bucketOf(b, today));
    if (d) return d;
    return (a.scheduled_date || "9999").localeCompare(b.scheduled_date || "9999") || (b.updated_at || "").localeCompare(a.updated_at || "");
  });
}

export const BUCKET_LABEL: Record<Bucket, string> = { overdue: "Gecikti", today: "Bugün", week: "Bu hafta", later: "İleri tarih", unscheduled: "Tarihsiz", closed: "Kapandı" };

export type NextStep =
  | { kind: "stage"; label: string; stage: string; hint: string; needsNote?: boolean }
  | { kind: "share"; label: string; purpose: "quote" | "completion"; hint: string }
  | { kind: "info"; hint: string };

/** İşin bulunduğu aşamaya ve kullanıcının rolüne göre sıradaki adım. */
export function nextStep(stage: string, manage: boolean): NextStep {
  switch (stage) {
    case "requested": return manage ? { kind: "info", hint: "Teklif tutarını girin ve durumu “Teklif bekliyor” yapıp kaydedin." } : { kind: "info", hint: "Yönetici teklif hazırlıyor. Onaylanınca işe başlayabilirsiniz." };
    case "quoted": return manage ? { kind: "share", label: "Teklifi müşteriye gönder", purpose: "quote", hint: "Müşteri bağlantıyı açıp teklifi onaylar; isterse imzalar." } : { kind: "info", hint: "Teklif müşteri onayında." };
    case "quote_approved": return { kind: "stage", label: "İşe başla", stage: "in_progress", hint: "Teklif onaylandı. Sahaya çıktığınızda işi başlatın." };
    case "in_progress": return { kind: "stage", label: "İşi tamamla", stage: "completed", needsNote: true, hint: "Yapılan işlemi yazın ve saha formlarını doldurun, sonra işi tamamlayın." };
    case "completed": return manage ? { kind: "share", label: "İş raporunu müşteriye gönder", purpose: "completion", hint: "Müşteri raporu onaylayınca iş kapanır ve fatura taslağı açılır." } : { kind: "info", hint: "İş raporu yönetici ve müşteri onayında." };
    case "accepted": return manage ? { kind: "info", hint: "Müşteri onayladı. Tahsil edilen tutarı girip durumu “Tahsil edildi” yapın." } : { kind: "info", hint: "İş müşteri tarafından onaylandı." };
    case "collected": return { kind: "info", hint: "İş tamamlandı ve tahsil edildi." };
    default: return { kind: "info", hint: "İş iptal edildi." };
  }
}

/** Onay bağlantısını telefondan tek dokunuşla göndermek için WhatsApp ve e-posta adresleri (ücretsiz, hesap gerektirmez). */
export function shareLinks(link: string, company: string, title: string, purpose: "quote" | "completion") {
  const subject = purpose === "quote" ? `${company} · teklif onayı: ${title}` : `${company} · iş raporu onayı: ${title}`;
  const body = `Merhaba, ${purpose === "quote" ? "teklifimizi" : "yaptığımız işin raporunu"} aşağıdaki bağlantıdan inceleyip onaylayabilirsiniz (7 gün geçerli):\n${link}`;
  return {
    whatsapp: `https://wa.me/?text=${encodeURIComponent(body)}`,
    email: `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
    text: body,
  };
}
