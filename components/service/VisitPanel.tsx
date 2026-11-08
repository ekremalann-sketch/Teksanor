"use client";

import { useEffect, useState, type FormEvent } from "react";

type Visit = { id: string; scheduled_date: string; assigned_name: string; status: string; note: string };
type Props = {
 jobId: string; organizationId: string; version: number; stage: string; manage: boolean; canWrite: boolean;
 members: { id: string; full_name: string }[];
 onChanged: () => Promise<void>;
};
const labels: Record<string, string> = {
 planned: "Planlandı", done: "Tamamlandı", parts_waiting: "Parça bekliyor",
 customer_absent: "Müşteri bulunamadı", cancelled: "İptal edildi",
};

export function VisitPanel({ jobId, organizationId, version, stage, manage, canWrite, members, onChanged }: Props) {
 const [visits, setVisits] = useState<Visit[] | null>(null);
 const [refresh, setRefresh] = useState(0);
 const [busy, setBusy] = useState(false);
 const [message, setMessage] = useState("");
 const locked = ["completed", "accepted", "collected", "cancelled"].includes(stage);
 const mayClose = !locked && canWrite && (manage || ["quote_approved", "in_progress"].includes(stage));
 useEffect(() => {
  const controller = new AbortController();
  fetch("/api/service/jobs?visitHistory=" + encodeURIComponent(jobId), {
   headers: { "X-Organization-Id": organizationId }, cache: "no-store", signal: controller.signal,
  }).then(async response => {
   const result = await response.json();
   if (!response.ok) throw new Error(result.error || "Ziyaretler alınamadı.");
   if (!controller.signal.aborted) setVisits(result.visits);
  }).catch(error => { if (!controller.signal.aborted) setMessage(error.message); });
  return () => controller.abort();
 }, [jobId, organizationId, version, refresh]);

 async function submit(event: FormEvent<HTMLFormElement>, action: string, visitId?: string) {
  event.preventDefault();
  if (busy) return;
  const fields = Object.fromEntries(new FormData(event.currentTarget));
  setBusy(true);
  setMessage("");
  try {
   const response = await fetch("/api/service/jobs", {
    method: "POST", headers: { "Content-Type": "application/json", "X-Organization-Id": organizationId },
    body: JSON.stringify({ ...fields, id: jobId, version, action, visitId }),
   });
   const result = await response.json();
   if (!response.ok) throw new Error(result.error || "Ziyaret kaydedilemedi.");
   setRefresh(value => value + 1);
   setMessage("Ziyaret kaydedildi.");
   await onChanged();
  } catch (error) {
   setMessage(error instanceof Error ? error.message : "Ziyaret kaydedilemedi.");
  } finally { setBusy(false); }
 }

 return <details className="service-card">
  <summary>Ziyaretler {visits ? `(${visits.length})` : ""}</summary>
  {visits?.length === 0 && <p>Bu iş için henüz ayrı ziyaret kaydı yok.</p>}
  {visits?.map(visit => <article key={visit.id}>
   <h4>{visit.scheduled_date} · {visit.assigned_name}</h4>
   <p>{labels[visit.status] ?? visit.status}{visit.note && <> · {visit.note}</>}</p>
   {visit.status === "planned" && mayClose && <form className="service-grid" onSubmit={event => void submit(event, "visit-close", visit.id)}>
    <label>Sonuç <select name="status" required defaultValue="">
     <option value="" disabled>Sonuç seçin</option>
     {Object.entries(labels).filter(([key]) => key !== "planned" && (manage || key !== "cancelled")).map(([key, label]) =>
      <option key={key} value={key}>{label}</option>)}
    </select></label>
    <label>Açıklama <input name="note" required maxLength={2000} /></label>
    <button disabled={busy}>Ziyareti sonuçlandır</button>
   </form>}
  </article>)}
  {manage && canWrite && !locked && visits && !visits.some(visit => visit.status === "planned") &&
   <form className="service-grid" onSubmit={event => void submit(event, "visit-plan")}>
    <label>Ziyaret tarihi <input type="date" name="scheduledDate" required /></label>
    <label>Teknisyen <select name="assignedUserId" required defaultValue="">
     <option value="" disabled>Teknisyen seçin</option>
     {members.map(member => <option key={member.id} value={member.id}>{member.full_name}</option>)}
    </select></label>
    <button disabled={busy}>Yeni ziyaret planla</button>
   </form>}
  <p role="status">{message || (visits ? "" : "Ziyaretler yükleniyor…")}</p>
 </details>;
}
