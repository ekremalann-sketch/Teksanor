import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb, addAudit } from "@/lib/db";
import { requireOrganization } from "@/lib/tenancy";
import { requireAttachmentRecord } from "@/lib/upload-access";
import { rejectCrossSiteMutation } from "@/lib/security";

type R2Object = { body: ReadableStream; arrayBuffer: () => Promise<ArrayBuffer> };
type Bucket = { get: (key: string) => Promise<R2Object | null>; delete: (key: string) => Promise<void> };

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const context = await requireOrganization(request, user);
    const { id } = await ctx.params;
    const record = await getDb().prepare("SELECT * FROM attachments WHERE id = ? AND organization_id = ?")
      .bind(id, context.organization.id).first<Record<string, unknown>>();
    if (!record) return NextResponse.json({ error: "Belge bulunamadı." }, { status: 404 });
    await requireAttachmentRecord(user, context.organization, record.record_type as string | null, record.record_id as string | null);
    const bucket = (env as unknown as { UPLOADS?: Bucket }).UPLOADS;
    if (!bucket) return NextResponse.json({ error: "Dosya depolama bağlantısı hazır değil." }, { status: 503 });
    const object = await bucket.get(record.object_key as string);
    if (!object) return NextResponse.json({ error: "Dosya içeriği bulunamadı." }, { status: 404 });
    const buffer = await object.arrayBuffer();
    const url = new URL(request.url);
    const disposition = url.searchParams.get("download") ? "attachment" : "inline";
    return new Response(buffer, {
      headers: {
        "Content-Type": String(record.content_type || "application/octet-stream"),
        "Content-Disposition": `${disposition}; filename="${String(record.file_name || "belge").replace(/"/g, "")}"`,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Belge alınamadı." }, { status: 403 });
  }
}

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const context = await requireOrganization(request, user);
    const { id } = await ctx.params;
    const record = await getDb().prepare("SELECT object_key, record_type, record_id FROM attachments WHERE id = ? AND organization_id = ?")
      .bind(id, context.organization.id).first<Record<string, unknown>>();
    if (!record) return NextResponse.json({ error: "Belge bulunamadı." }, { status: 404 });
    await requireAttachmentRecord(user, context.organization, record.record_type as string | null, record.record_id as string | null);
    const bucket = (env as unknown as { UPLOADS?: Bucket }).UPLOADS;
    if (bucket) { try { await bucket.delete(record.object_key as string); } catch { /* yoksay */ } }
    await getDb().prepare("DELETE FROM attachments WHERE id = ? AND organization_id = ?").bind(id, context.organization.id).run();
    await addAudit(user.id, "delete", "attachment", id, undefined, context.organization.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Belge silinemedi." }, { status: 400 });
  }
}
