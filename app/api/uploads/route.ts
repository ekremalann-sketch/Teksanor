import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addAudit, createId, getDb } from "@/lib/db";
import { requireOrganization } from "@/lib/tenancy";
import { rejectCrossSiteMutation } from "@/lib/security";

type Bucket = { put: (key: string, value: ArrayBuffer, options?: unknown) => Promise<unknown> };

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  let context;
  try { context = await requireOrganization(request, user); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Çalışma alanına erişim reddedildi." }, { status: 403 }); }
  const files = await getDb().prepare(`SELECT a.id, a.file_name, a.content_type, a.size_bytes, a.record_type,
    a.record_id, a.created_at, u.full_name FROM attachments a JOIN users u ON u.id = a.uploaded_by
    WHERE a.organization_id = ? ORDER BY a.created_at DESC LIMIT 50`).bind(context.organization.id).all();
  return NextResponse.json({ files: files.results });
}

export async function POST(request: Request) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  let context;
  try { context = await requireOrganization(request, user); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Çalışma alanına erişim reddedildi." }, { status: 403 }); }
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Dosya seçilmedi." }, { status: 400 });
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "Dosya en fazla 10 MB olabilir." }, { status: 400 });
  const allowed = new Set(["image/png", "image/jpeg", "image/webp", "application/pdf", "text/csv", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]);
  if (!allowed.has(file.type)) return NextResponse.json({ error: "Bu dosya türüne izin verilmiyor." }, { status: 400 });
  const bucket = (env as unknown as { UPLOADS?: Bucket }).UPLOADS;
  if (!bucket) return NextResponse.json({ error: "Dosya depolama bağlantısı hazır değil." }, { status: 503 });
  const id = createId("file");
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-120);
  const objectKey = `${new Date().getUTCFullYear()}/${id}-${safeName}`;
  await bucket.put(objectKey, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
  await getDb().prepare(`INSERT INTO attachments
    (id, object_key, file_name, content_type, size_bytes, record_type, record_id, uploaded_by, organization_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(id, objectKey, file.name, file.type, file.size, form.get("recordType") || null, form.get("recordId") || null, user.id, context.organization.id)
    .run();
  await addAudit(user.id, "upload", "attachment", id, file.name, context.organization.id);
  return NextResponse.json({ id, fileName: file.name }, { status: 201 });
}
