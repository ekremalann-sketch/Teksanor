// Çözüm Mimarı T1: çevrimdışı iş tamamlama kuyruğu (tarayıcıda).
// Bodrum, kazan dairesi gibi sinyalsiz yerde teknisyenin "durum + not" kaydı kaybolmaz: kayıt cihazda sıraya alınır,
// bağlantı gelince sırayla gönderilir. Sunucu yine sürüm (version) denetimi yapar; arada iş değiştiyse kayıt
// zorla yazılmaz, kullanıcıya söylenir ve not taslağa geri konur. İmza ve fotoğraf çevrimiçi kalır (dosya ve güvenlik).
export type QueuedAction = { id: string; at: number; body: Record<string, unknown>; label: string };
export const QUEUEABLE = new Set(["update", "travel"]);
const key = (userId: string, orgId: string) => `teksanor-offline-queue:${userId}:${orgId}`;

export function readQueue(userId: string, orgId: string): QueuedAction[] {
  try { const v = JSON.parse(localStorage.getItem(key(userId, orgId)) || "[]"); return Array.isArray(v) ? v.slice(0, 50) : []; } catch { return []; }
}
function write(userId: string, orgId: string, list: QueuedAction[]) {
  try { if (list.length) localStorage.setItem(key(userId, orgId), JSON.stringify(list)); else localStorage.removeItem(key(userId, orgId)); } catch { /* depolama kapalıysa sıra tutulamaz */ }
}
export function enqueue(userId: string, orgId: string, body: Record<string, unknown>, label: string): boolean {
  if (!QUEUEABLE.has(String(body.action))) return false;
  const list = readQueue(userId, orgId);
  if (list.length >= 50) return false;
  list.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, at: Date.now(), body, label });
  write(userId, orgId, list);
  return readQueue(userId, orgId).length === list.length;
}
/**
 * Sıradaki kayıtları sırayla gönderir. send: sunucu yanıtını döner (ağ hatasında atar).
 * Ağ hatasında durur (kalanlar sırada kalır). Sunucu reddederse (ör. iş arada değişti) kayıt sıradan çıkar ve rejected listesine girer.
 */
export async function flushQueue(userId: string, orgId: string, send: (body: Record<string, unknown>) => Promise<{ ok: boolean; error?: string }>) {
  const sent: QueuedAction[] = [], rejected: { item: QueuedAction; error: string }[] = [];
  // Aynı işe sırada birden çok "update" varsa her başarılı update sunucuda sürümü 1 artırır; sıradaki kayıtların
  // sürümü kalıcı olarak güncellenir (yarıda kalan gönderimden sonra da doğru sürümle devam edilir).
  let last = "";
  for (let item = readQueue(userId, orgId)[0]; item && item.id !== last; item = readQueue(userId, orgId)[0]) {
    last = item.id; // depolama yazılamazsa aynı kaydı sonsuza dek göndermeyi önler
    let res: { ok: boolean; error?: string };
    try { res = await send(item.body); } catch { break; }
    const rest = readQueue(userId, orgId).filter((q) => q.id !== item.id);
    if (res.ok) {
      sent.push(item);
      if (item.body.action === "update") for (const q of rest) if (q.body.id === item.body.id) q.body = { ...q.body, version: Number(q.body.version) + 1 };
    } else rejected.push({ item, error: res.error || "Kayıt gönderilemedi." });
    write(userId, orgId, rest);
  }
  return { sent, rejected, remaining: readQueue(userId, orgId).length };
}
