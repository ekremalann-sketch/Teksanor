import { NextResponse } from "next/server";
import { addAudit, getDb } from "@/lib/db";
import { rejectCrossSiteMutation } from "@/lib/security";

// Müşteri onay bağlantısı: kimlik doğrulaması gerektirmez, yalnızca geçerli token ile çalışır.
type LinkRow = {
  id: string; organization_id: string; work_order_id: string; purpose: string;
  expires_at: string; used_at: string | null; decision: string | null;
};

async function loadLink(token: string) {
  if (!token) return null;
  return getDb().prepare("SELECT * FROM service_links WHERE token = ?").bind(token).first<LinkRow>();
}

function money(cents = 0) {
  return (Number(cents || 0) / 100).toLocaleString("tr-TR", { style: "currency", currency: "TRY" });
}

export async function GET(request: Request) {
  try {
    const token = (new URL(request.url).searchParams.get("token") || "").trim();
    const link = await loadLink(token);
    if (!link) return NextResponse.json({ error: "Bağlantı bulunamadı." }, { status: 404 });
    if (new Date(link.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: "Bağlantının süresi doldu." }, { status: 410 });
    }
    const db = getDb();
    const job = await db.prepare(
      `SELECT id, order_number, title, description, customer_name, location, scheduled_date, stage, outcome, quote_cents
       FROM work_orders WHERE id = ? AND organization_id = ?`)
      .bind(link.work_order_id, link.organization_id).first<Record<string, unknown>>();
    if (!job) return NextResponse.json({ error: "Servis kaydı bulunamadı." }, { status: 404 });
    const org = await db.prepare("SELECT name FROM organizations WHERE id = ?").bind(link.organization_id).first<{ name: string }>();
    return NextResponse.json({
      purpose: link.purpose,
      decision: link.decision,
      used: Boolean(link.used_at),
      organization: org?.name || "Servis sağlayıcı",
      job: {
        order_number: job.order_number,
        title: job.title,
        description: job.description,
        customer_name: job.customer_name,
        location: job.location,
        scheduled_date: job.scheduled_date,
        stage: job.stage,
        outcome: link.purpose === "completion" ? job.outcome : null,
        quote: money(job.quote_cents as number),
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Bağlantı açılamadı." }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  try {
    const body = await request.json() as Record<string, unknown>;
    const token = String(body.token ?? "").trim();
    const decision = String(body.decision ?? "").trim() === "reject" ? "reject" : "approve";
    const link = await loadLink(token);
    if (!link) return NextResponse.json({ error: "Bağlantı bulunamadı." }, { status: 404 });
    if (new Date(link.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: "Bağlantının süresi doldu." }, { status: 410 });
    }
    if (link.used_at) return NextResponse.json({ error: "Bu bağlantı zaten yanıtlandı." }, { status: 409 });

    const db = getDb();
    const job = await db.prepare("SELECT id, stage FROM work_orders WHERE id = ? AND organization_id = ?")
      .bind(link.work_order_id, link.organization_id).first<{ id: string; stage: string }>();
    if (!job) return NextResponse.json({ error: "Servis kaydı bulunamadı." }, { status: 404 });

    if (decision === "approve") {
      let newStage: string | null = null;
      if (link.purpose === "quote" && job.stage === "quoted") newStage = "quote_approved";
      else if (link.purpose === "completion" && job.stage === "completed") newStage = "accepted";
      if (newStage) {
        await db.prepare(`UPDATE work_orders SET stage = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND organization_id = ?`).bind(newStage, job.id, link.organization_id).run();
      }
    }
    await db.prepare("UPDATE service_links SET used_at = CURRENT_TIMESTAMP, decision = ? WHERE id = ?")
      .bind(decision, link.id).run();
    await addAudit(null, decision === "approve" ? "approve" : "reject", "service_job", job.id,
      `Müşteri onay bağlantısı yanıtlandı (${decision}).`, link.organization_id);

    return NextResponse.json({ ok: true, decision });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Yanıt kaydedilemedi." }, { status: 400 });
  }
}
