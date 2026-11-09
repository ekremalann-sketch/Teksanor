"use client";

import { useEffect, useState, type FormEvent } from "react";

type Payment = { id: string; kind: string; amount_cents: number; method: string; reason: string; created_at: string; actor: string; voided: number };
type Data = { payments: Payment[]; paidCents: number; quoteCents: number; legacyCents: number };
type Props = { jobId: string; organizationId: string; version: number; stage: string; onChanged: () => Promise<void> };
const kinds: Record<string, string> = { payment: "Tahsilat", refund: "İade", void: "Tahsilat iptali" };
const methods: Record<string, string> = { nakit: "Nakit", havale: "Havale/EFT", kart: "Kart", diger: "Diğer" };
const money = (cents: number) => (cents / 100).toLocaleString("tr-TR", { style: "currency", currency: "TRY" });
const OPEN = ["quote_approved", "in_progress", "completed", "accepted"];

export function PaymentsPanel({ jobId, organizationId, version, stage, onChanged }: Props) {
 const [data, setData] = useState<Data | null>(null);
 const [refresh, setRefresh] = useState(0);
 const [busy, setBusy] = useState(false);
 const [message, setMessage] = useState("");
 const open = OPEN.includes(stage);
 useEffect(() => {
  const controller = new AbortController();
  fetch("/api/service/payments?jobId=" + encodeURIComponent(jobId), {
   headers: { "X-Organization-Id": organizationId }, cache: "no-store", signal: controller.signal,
  }).then(async response => {
   const result = await response.json();
   if (!response.ok) throw new Error(result.error || "Tahsilatlar alınamadı.");
   if (!controller.signal.aborted) setData(result);
  }).catch(error => { if (!controller.signal.aborted) setMessage(error.message); });
  return () => controller.abort();
 }, [jobId, organizationId, version, refresh]);

 async function submit(event: FormEvent<HTMLFormElement>, action: string, paymentId?: string) {
  event.preventDefault();
  if (busy) return;
  const fields = Object.fromEntries(new FormData(event.currentTarget));
  setBusy(true);
  setMessage("");
  try {
   const response = await fetch("/api/service/payments", {
    method: "POST", headers: { "Content-Type": "application/json", "X-Organization-Id": organizationId },
    body: JSON.stringify({
     action, jobId, version, paymentId, requestId: crypto.randomUUID(), method: fields.method, reason: fields.reason,
     amountCents: fields.amount === undefined ? undefined : Math.round(Number(fields.amount) * 100),
    }),
   });
   const result = await response.json();
   if (!response.ok) throw new Error(result.error || "Tahsilat kaydedilemedi.");
   setRefresh(value => value + 1);
   setMessage("Tahsilat hareketi kaydedildi.");
   await onChanged();
  } catch (error) {
   setMessage(error instanceof Error ? error.message : "Tahsilat kaydedilemedi.");
  } finally { setBusy(false); }
 }
 const remaining = data ? Math.max(0, data.quoteCents - data.paidCents) : 0;
 const methodSelect = <label>Yöntem <select name="method" required defaultValue="havale">
  {Object.entries(methods).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
 </select></label>;

 return <details className="service-card">
  <summary>Tahsilat hareketleri {data ? `· Tahsil edilen ${money(data.paidCents)} · Kalan ${money(remaining)}` : ""}</summary>
  {data && data.legacyCents !== 0 && <p>Hareket kaydı tutulmadan önce girilmiş tahsilat: {money(data.legacyCents)}</p>}
  {data?.payments.length === 0 && <p>Bu iş için henüz tahsilat hareketi yok.</p>}
  <ul>{data?.payments.map(row => <li key={row.id}>
   {row.created_at} · {kinds[row.kind] ?? row.kind} · {money(row.amount_cents)} · {methods[row.method] ?? row.method}
   {row.reason && <> · {row.reason}</>} · {row.actor}{row.voided ? " · iptal edildi" : ""}
   {open && row.kind === "payment" && !row.voided && <details>
    <summary>Bu kaydı iptal et</summary>
    <form className="service-grid" onSubmit={event => void submit(event, "payment-void", row.id)}>
     <label>İptal gerekçesi <input name="reason" required maxLength={500} /></label>
     <button disabled={busy}>Tahsilat kaydını iptal et</button>
    </form>
   </details>}
  </li>)}</ul>
  {open && data && <>
   {remaining > 0 && <form className="service-grid" onSubmit={event => void submit(event, "payment-add")}>
    <label>Tahsil edilen tutar (TL) <input name="amount" type="number" min="0.01" step="0.01" max={remaining / 100} required /></label>
    {methodSelect}
    <button disabled={busy}>Tahsilat ekle</button>
   </form>}
   {data.paidCents > 0 && <details>
    <summary>Müşteriye iade</summary>
    <form className="service-grid" onSubmit={event => void submit(event, "payment-refund")}>
     <label>İade tutarı (TL) <input name="amount" type="number" min="0.01" step="0.01" max={data.paidCents / 100} required /></label>
     {methodSelect}
     <label>İade gerekçesi <input name="reason" required maxLength={500} /></label>
     <button disabled={busy}>İadeyi kaydet</button>
    </form>
   </details>}
  </>}
  <p role="status">{message || (data ? "" : "Tahsilatlar yükleniyor…")}</p>
 </details>;
}
