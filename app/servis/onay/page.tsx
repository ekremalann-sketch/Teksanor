"use client";
import { Suspense, useEffect, useState } from "react";

type Approval = {
  purpose: string;
  decision: string | null;
  used: boolean;
  organization: string;
  job: {
    order_number: string;
    title: string;
    description: string | null;
    customer_name: string | null;
    location: string | null;
    scheduled_date: string | null;
    stage: string;
    outcome: string | null;
    quote: string;
  };
};

function ApprovalView() {
  const [token, setToken] = useState("");
  const [data, setData] = useState<Approval | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    const t = new URLSearchParams(location.search).get("token") || "";
    setToken(t);
    if (!t) { setError("Bağlantı adresi eksik."); return; }
    fetch(`/api/service/approval?token=${encodeURIComponent(t)}`, { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Bağlantı açılamadı.");
        setData(d as Approval);
        if (d.used) setDone(d.decision === "approve" ? "approve" : d.decision === "reject" ? "reject" : "used");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Bağlantı açılamadı."));
  }, []);

  async function respond(decision: "approve" | "reject") {
    setBusy(true); setError("");
    try {
      const r = await fetch("/api/service/approval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, decision }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Yanıt kaydedilemedi.");
      setDone(decision);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Yanıt kaydedilemedi.");
    } finally {
      setBusy(false);
    }
  }

  if (error) return <main className="approval-shell"><div className="approval-card"><h1>Bağlantı açılamadı</h1><p>{error}</p></div></main>;
  if (!data) return <main className="approval-shell"><div className="approval-card"><p>Yükleniyor…</p></div></main>;

  const isQuote = data.purpose === "quote";
  return (
    <main className="approval-shell">
      <div className="approval-card">
        <small>{data.organization}</small>
        <h1>{isQuote ? "Teklif onayı" : "Servis iş onayı"}</h1>
        <p className="approval-sub">{data.job.order_number} · {data.job.title}</p>
        <dl className="approval-list">
          {data.job.customer_name && <><dt>Müşteri</dt><dd>{data.job.customer_name}</dd></>}
          {data.job.location && <><dt>Saha</dt><dd>{data.job.location}</dd></>}
          {data.job.scheduled_date && <><dt>Tarih</dt><dd>{data.job.scheduled_date}</dd></>}
          {isQuote && <><dt>Teklif toplamı</dt><dd><strong>{data.job.quote}</strong></dd></>}
        </dl>
        {data.job.description && <><h2>Açıklama</h2><p style={{ whiteSpace: "pre-wrap" }}>{data.job.description}</p></>}
        {!isQuote && data.job.outcome && <><h2>Yapılan işlem</h2><p style={{ whiteSpace: "pre-wrap" }}>{data.job.outcome}</p></>}

        {done === "approve" && <p className="approval-status ok">Onayınız kaydedildi. Teşekkür ederiz.</p>}
        {done === "reject" && <p className="approval-status">Ret bildiriminiz kaydedildi.</p>}
        {done === "used" && <p className="approval-status">Bu bağlantı daha önce yanıtlandı.</p>}

        {!done && (
          <div className="approval-actions">
            <button className="approval-approve" disabled={busy} onClick={() => respond("approve")}>
              {isQuote ? "Teklifi onaylıyorum" : "İşi onaylıyorum"}
            </button>
            <button className="approval-reject" disabled={busy} onClick={() => respond("reject")}>Reddet</button>
          </div>
        )}
        <small className="approval-note">Bu bağlantı yalnızca ilgili teklifi/iş raporunu görüntülemeniz ve onaylamanız içindir.</small>
      </div>
    </main>
  );
}

export default function ApprovalPage() {
  return <Suspense fallback={<main className="approval-shell"><div className="approval-card"><p>Yükleniyor…</p></div></main>}><ApprovalView /></Suspense>;
}
