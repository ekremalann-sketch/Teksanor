import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addAudit, createId, getDb } from "@/lib/db";
import { canManageOrganization, requireOrganization } from "@/lib/tenancy";
import { rejectCrossSiteMutation } from "@/lib/security";

function text(value: unknown, max = 200) { return String(value ?? "").trim().slice(0, max); }
function toCents(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(100000000_00, Math.round(n * 100));
}

// Servis iş akışı durum makinesi
const STAGES = ["requested", "quoted", "quote_approved", "in_progress", "completed", "accepted", "collected", "cancelled"];
const NEXT: Record<string, string[]> = {
  requested: ["quoted", "cancelled"],
  quoted: ["requested", "cancelled"],
  quote_approved: ["in_progress", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: ["in_progress"],
  accepted: ["collected"],
  collected: [],
  cancelled: [],
};
// Ekip üyelerinin (yönetici olmayan) yapabileceği durum geçişleri
const MEMBER_STAGES = new Set(["in_progress", "completed"]);

type JobRow = Record<string, unknown> & {
  quote_cents?: number; labor_cents?: number; parts_cents?: number; travel_cents?: number; paid_cents?: number;
};

function decorate(row: JobRow) {
  const quote = Number(row.quote_cents || 0);
  const labor = Number(row.labor_cents || 0);
  const parts = Number(row.parts_cents || 0);
  const travel = Number(row.travel_cents || 0);
  const paid = Number(row.paid_cents || 0);
  return {
    ...row,
    margin_cents: quote - labor - parts - travel,
    remaining_cents: Math.max(0, quote - paid),
  };
}

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const context = await requireOrganization(request, user);
    const orgId = context.organization.id;
    const db = getDb();
    const [jobs, assets, members] = await Promise.all([
      db.prepare(
        `SELECT w.*, a.asset_code AS asset_code, a.name AS asset_name
         FROM work_orders w LEFT JOIN assets a ON a.id = w.asset_id
         WHERE w.organization_id = ?
         ORDER BY CASE w.stage
           WHEN 'in_progress' THEN 1 WHEN 'quote_approved' THEN 2 WHEN 'quoted' THEN 3
           WHEN 'requested' THEN 4 WHEN 'completed' THEN 5 WHEN 'accepted' THEN 6
           WHEN 'collected' THEN 7 ELSE 8 END, w.created_at DESC`).bind(orgId).all(),
      db.prepare("SELECT id, name, asset_code FROM assets WHERE organization_id = ? ORDER BY asset_code").bind(orgId).all(),
      db.prepare(
        `SELECT u.id AS id, u.full_name AS full_name FROM organization_members m
         JOIN users u ON u.id = m.user_id WHERE m.organization_id = ? ORDER BY u.full_name`).bind(orgId).all(),
    ]);
    const manage = canManageOrganization(user, context.organization);
    return NextResponse.json({
      jobs: (jobs.results as JobRow[]).map(decorate),
      assets: assets.results,
      members: members.results,
      manage,
      canWrite: true,
      userId: user.id,
      organization: { id: orgId, name: context.organization.name },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Servis kayıtları alınamadı." }, { status: 403 });
  }
}

export async function POST(request: Request) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const context = await requireOrganization(request, user);
    const orgId = context.organization.id;
    const manage = canManageOrganization(user, context.organization);
    const db = getDb();
    const body = await request.json() as Record<string, unknown>;
    const action = text(body.action, 20);

    if (action === "create") {
      if (!manage) return NextResponse.json({ error: "Yeni servis talebi açmak için yetkiniz yok." }, { status: 403 });
      const title = text(body.title, 240);
      if (!title) return NextResponse.json({ error: "İş başlığı gereklidir." }, { status: 400 });
      const id = createId("wo");
      const orderNumber = `SRV-${crypto.randomUUID().slice(0, 10).toUpperCase()}`;
      const assignedUserId = text(body.assignedUserId) || user.id;
      await db.prepare(`INSERT INTO work_orders
        (id, organization_id, order_number, title, description, customer_name, location, order_type, status, priority,
         assigned_user_id, scheduled_date, asset_id, stage, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'repair', 'open', 'normal', ?, ?, ?, 'requested', ?)`)
        .bind(id, orgId, orderNumber, title, text(body.description, 1200) || null, text(body.customerName, 240) || null,
          text(body.location, 400) || null, assignedUserId, text(body.scheduledDate, 20) || null,
          text(body.assetId) || null, user.id).run();
      await addAudit(user.id, "create", "service_job", id, `${orderNumber} servis talebi açıldı.`, orgId);
      return NextResponse.json({ ok: true, id, orderNumber });
    }

    if (action === "update") {
      const id = text(body.id);
      const version = Number(body.version);
      if (!id) return NextResponse.json({ error: "Kayıt bulunamadı." }, { status: 400 });
      const current = await db.prepare("SELECT * FROM work_orders WHERE id = ? AND organization_id = ?")
        .bind(id, orgId).first<JobRow & { version: number; stage: string }>();
      if (!current) return NextResponse.json({ error: "Servis kaydı bulunamadı." }, { status: 404 });
      if (Number(current.version) !== version) {
        return NextResponse.json({ error: "Kayıt başka bir kullanıcı tarafından güncellendi. Sayfayı yenileyin." }, { status: 409 });
      }
      // Durum geçişi doğrulama
      let stage = text(body.stage) || current.stage;
      if (stage !== current.stage) {
        if (!STAGES.includes(stage) || !(NEXT[current.stage] || []).includes(stage)) {
          return NextResponse.json({ error: "Geçersiz durum geçişi." }, { status: 400 });
        }
        if (!manage && !MEMBER_STAGES.has(stage)) {
          return NextResponse.json({ error: "Bu durum geçişi için yetkiniz yok." }, { status: 403 });
        }
      }
      const outcome = text(body.outcome, 6000);
      // Mali alanlar yalnızca yöneticiler tarafından güncellenebilir
      if (manage) {
        await db.prepare(`UPDATE work_orders SET outcome = ?, stage = ?,
          quote_cents = ?, labor_cents = ?, parts_cents = ?, travel_cents = ?, paid_cents = ?,
          status = CASE WHEN ? IN ('completed','accepted','collected') THEN 'completed'
                        WHEN ? = 'cancelled' THEN 'cancelled'
                        WHEN ? = 'in_progress' THEN 'in_progress' ELSE status END,
          version = version + 1, updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND organization_id = ?`)
          .bind(outcome || null, stage,
            toCents(body.quote), toCents(body.labor), toCents(body.parts), toCents(body.travel), toCents(body.paid),
            stage, stage, stage, id, orgId).run();
      } else {
        await db.prepare(`UPDATE work_orders SET outcome = ?, stage = ?,
          status = CASE WHEN ? IN ('completed','accepted','collected') THEN 'completed'
                        WHEN ? = 'in_progress' THEN 'in_progress' ELSE status END,
          version = version + 1, updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND organization_id = ?`)
          .bind(outcome || null, stage, stage, stage, id, orgId).run();
      }
      await addAudit(user.id, "update", "service_job", id, `Servis kaydı güncellendi (${stage}).`, orgId);
      return NextResponse.json({ ok: true });
    }

    if (action === "share") {
      if (!manage) return NextResponse.json({ error: "Onay bağlantısı oluşturmak için yetkiniz yok." }, { status: 403 });
      const id = text(body.id);
      const current = await db.prepare("SELECT id, stage FROM work_orders WHERE id = ? AND organization_id = ?")
        .bind(id, orgId).first<{ id: string; stage: string }>();
      if (!current) return NextResponse.json({ error: "Servis kaydı bulunamadı." }, { status: 404 });
      const purpose = text(body.purpose) === "completion" ? "completion" : "quote";
      const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
      const linkId = createId("lnk");
      const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      await db.prepare(`INSERT INTO service_links (id, organization_id, work_order_id, token, purpose, expires_at, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .bind(linkId, orgId, id, token, purpose, expires, user.id).run();
      await addAudit(user.id, "share", "service_job", id, `Müşteri onay bağlantısı oluşturuldu (${purpose}).`, orgId);
      return NextResponse.json({ ok: true, path: `/servis/onay?token=${token}` });
    }

    return NextResponse.json({ error: "Bilinmeyen işlem." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "İşlem tamamlanamadı." }, { status: 400 });
  }
}
