"use client";

import { useEffect, useState, type FormEvent } from "react";

type Line = { part_id: string; code: string; name: string; reserved: number; used: number; unit_cost_cents?: number };
type Movement = { kind: string; quantity: number; created_at: string; code: string; name: string; actor: string };
type Stock = { id: string; code: string; name: string; on_hand: number };
type Props = {
 jobId: string; organizationId: string; version: number; stage: string; manage: boolean; canWrite: boolean;
 onChanged: () => Promise<void>;
};
const kinds: Record<string, string> = { receive: "Depo girişi", reserve: "İşe ayrıldı", consume: "Kullanıldı", return: "Depoya iade" };
const money = (cents: number) => (cents / 100).toLocaleString("tr-TR", { style: "currency", currency: "TRY" });
const requestId = () => crypto.randomUUID();

export function PartsPanel({ jobId, organizationId, version, stage, manage, canWrite, onChanged }: Props) {
 const [data, setData] = useState<{ lines: Line[]; movements: Movement[]; stock: Stock[] } | null>(null);
 const [refresh, setRefresh] = useState(0);
 const [busy, setBusy] = useState(false);
 const [message, setMessage] = useState("");
 const mayReserve = manage && ["requested", "quoted", "quote_approved", "in_progress"].includes(stage);
 const mayConsume = canWrite && ["quote_approved", "in_progress"].includes(stage);
 useEffect(() => {
  const controller = new AbortController();
  fetch("/api/service/parts?jobId=" + encodeURIComponent(jobId), {
   headers: { "X-Organization-Id": organizationId }, cache: "no-store", signal: controller.signal,
  }).then(async response => {
   const result = await response.json();
   if (!response.ok) throw new Error(result.error || "Parçalar alınamadı.");
   if (!controller.signal.aborted) setData(result);
  }).catch(error => { if (!controller.signal.aborted) setMessage(error.message); });
  return () => controller.abort();
 }, [jobId, organizationId, version, refresh]);

 async function send(body: Record<string, unknown>) {
  if (busy) return;
  setBusy(true);
  setMessage("");
  try {
   const response = await fetch("/api/service/parts", {
    method: "POST", headers: { "Content-Type": "application/json", "X-Organization-Id": organizationId },
    body: JSON.stringify({ ...body, jobId, requestId: requestId() }),
   });
   const result = await response.json();
   if (!response.ok) throw new Error(result.error || "Parça işlemi kaydedilemedi.");
   setRefresh(value => value + 1);
   setMessage("Parça hareketi kaydedildi.");
   await onChanged();
  } catch (error) {
   setMessage(error instanceof Error ? error.message : "Parça işlemi kaydedilemedi.");
  } finally { setBusy(false); }
 }
 function submit(event: FormEvent<HTMLFormElement>, action: string, partId?: string) {
  event.preventDefault();
  const fields = Object.fromEntries(new FormData(event.currentTarget));
  void send({ action, partId: partId ?? fields.partId, quantity: Number(fields.quantity) });
 }
 const reserved = data?.lines.reduce((sum, line) => sum + line.reserved, 0) ?? 0;

 return <details className="service-card">
  <summary>Parçalar {data ? `(${data.lines.length})` : ""}{reserved > 0 ? ` · ${reserved} ayrılmış` : ""}</summary>
  {data?.lines.length === 0 && <p>Bu işe henüz parça ayrılmadı.</p>}
  {data?.lines.map(line => <article key={line.part_id}>
   <h4>{line.code} · {line.name}</h4>
   <p>Ayrılan: {line.reserved} · Kullanılan: {line.used}{line.unit_cost_cents !== undefined && <> · Kullanım maliyeti: {money(line.used * line.unit_cost_cents)}</>}</p>
   {line.reserved > 0 && canWrite && <div className="service-actions">
    {mayConsume && <form onSubmit={event => submit(event, "part-consume", line.part_id)}>
     <label>Kullanılan adet <input name="quantity" type="number" min="1" max={line.reserved} required defaultValue={1} /></label>
     <button disabled={busy}>Kullanıldı olarak kaydet</button>
    </form>}
    <form onSubmit={event => submit(event, "part-return", line.part_id)}>
     <label>İade adedi <input name="quantity" type="number" min="1" max={line.reserved} required defaultValue={line.reserved} /></label>
     <button disabled={busy}>Depoya iade et</button>
    </form>
   </div>}
  </article>)}
  {reserved > 0 && <small>İş kapatılmadan önce ayrılan parçalar kullanıldı veya iade edildi olarak işaretlenmelidir.</small>}
  {mayReserve && data && (data.stock.length
   ? <form className="service-grid" onSubmit={event => submit(event, "part-reserve")}>
    <label>Depodan parça <select name="partId" required defaultValue="">
     <option value="" disabled>Parça seçin</option>
     {data.stock.map(item => <option key={item.id} value={item.id} disabled={item.on_hand < 1}>{item.code} · {item.name} (depoda {item.on_hand})</option>)}
    </select></label>
    <label>Adet <input name="quantity" type="number" min="1" required defaultValue={1} /></label>
    <button disabled={busy}>İşe ayır</button>
   </form>
   : <p>Depoda tanımlı parça yok. Parça tanımı ve depo girişi yönetici tarafından yapılır.</p>)}
  {manage && canWrite && data && <details>
   <summary>Depo yönetimi</summary>
   <form className="service-grid" onSubmit={event => { event.preventDefault(); const f = Object.fromEntries(new FormData(event.currentTarget)); void send({ action: "part-create", code: f.code, name: f.name, unitCostCents: Math.round(Number(f.cost) * 100) }); }}>
    <label>Parça kodu <input name="code" required maxLength={40} /></label>
    <label>Parça adı <input name="name" required maxLength={160} /></label>
    <label>Birim maliyet (TL) <input name="cost" type="number" min="0" step="0.01" required /></label>
    <button disabled={busy}>Parça tanımla</button>
   </form>
   {data.stock.length > 0 && <form className="service-grid" onSubmit={event => submit(event, "part-receive")}>
    <label>Parça <select name="partId" required defaultValue="">
     <option value="" disabled>Parça seçin</option>
     {data.stock.map(item => <option key={item.id} value={item.id}>{item.code} · {item.name} (depoda {item.on_hand})</option>)}
    </select></label>
    <label>Gelen adet <input name="quantity" type="number" min="1" required defaultValue={1} /></label>
    <button disabled={busy}>Depo girişi yap</button>
   </form>}
  </details>}
  {manage && data && data.movements.length > 0 && <details>
   <summary>Hareket geçmişi</summary>
   <ul>{data.movements.map((row, index) => <li key={index}>{row.created_at} · {kinds[row.kind] ?? row.kind} · {row.code} × {row.quantity} · {row.actor}</li>)}</ul>
  </details>}
  <p role="status">{message || (data ? "" : "Parçalar yükleniyor…")}</p>
 </details>;
}
