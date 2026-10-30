import {recordRead} from "@/lib/read-audit";
import { scanMalware } from "@/lib/antivirus";
import { requireAttachmentRecord } from "@/lib/upload-access";
import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { auditStatement, createId, getDb } from "@/lib/db";
import { requireOrganization } from "@/lib/tenancy";
import { rejectCrossSiteMutation } from "@/lib/security";
import { inspectUpload } from "@/lib/file-security";

type Bucket = { put: (key: string, value: ArrayBuffer, options?: unknown) => Promise<unknown>; delete: (key: string) => Promise<unknown> };

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  let context;
  try { context = await requireOrganization(request, user); }
  catch (error) { return NextResponse.json({ error: "Çalışma alanına erişim reddedildi." }, { status: 403 }); }
  const query=new URL(request.url).searchParams;const recordType=query.get("recordType"),recordId=query.get("recordId");
  const files = await getDb().prepare(`SELECT a.id, a.file_name, a.content_type, a.size_bytes, a.record_type,
    a.record_id, a.scan_status, a.uploaded_by, a.created_at, u.full_name FROM attachments a JOIN users u ON u.id = a.uploaded_by
    WHERE a.organization_id = ? AND (? IS NULL OR a.record_type=?) AND (? IS NULL OR a.record_id=?) ORDER BY a.created_at DESC LIMIT 50`).bind(context.organization.id,recordType,recordType,recordId,recordId).all();
  const visible = [];
  for (const file of files.results) {
    try { await requireAttachmentRecord(user, context.organization, file.record_type as string|null, file.record_id as string|null, file.uploaded_by as string); visible.push(file); } catch { /* Not visible to this role. */ }
  }
  await recordRead(user.id,context.organization.id,"attachments:list");
  return NextResponse.json({ files: visible });
}

export async function POST(request: Request) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  let context;
  try { context = await requireOrganization(request, user); }
  catch (error) { return NextResponse.json({ error: "Çalışma alanına erişim reddedildi." }, { status: 403 }); }
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Dosya seçilmedi." }, { status: 400 });
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "Dosya güvenlik politikasına uygun değil." }, { status: 400 });
  const allowed = new Set(["image/png", "image/jpeg", "image/webp", "application/pdf", "text/csv", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]);
  if (!allowed.has(file.type)) return NextResponse.json({ error: "Bu dosya türüne izin verilmiyor." }, { status: 400 });
  const buffer = await file.arrayBuffer();
  let inspection;
  try { inspection = inspectUpload(file.name, file.type, buffer); }
  catch (error) { return NextResponse.json({ error: "Dosya güvenlik kontrolünden geçemedi." }, { status: 400 }); }
  const bucket = (env as unknown as { UPLOADS?: Bucket }).UPLOADS;
  if (!bucket) return NextResponse.json({ error: "Dosya depolama bağlantısı hazır değil." }, { status: 503 });
  const recordType = String(form.get("recordType") || "") || null;
  const recordId = String(form.get("recordId") || "") || null;
  try { await requireAttachmentRecord(user, context.organization, recordType, recordId); }
  catch { return NextResponse.json({error:"Belge kaydına erişim reddedildi."},{status:403}); }
  let scanStatus;
  try{scanStatus=await scanMalware(buffer,file.type);}catch(e){return NextResponse.json({error:"Dosya taranamadı."},{status:503});}
  const id = createId("file");
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-120);
  const objectKey = `${context.organization.id}/${new Date().getUTCFullYear()}/${id}-${safeName}`;
  // The object has no downloadable application reference until metadata + audit commit.
  // R2 is outside the database transaction: compensate a failed write explicitly.
  try {
    await bucket.put(objectKey, buffer, { httpMetadata: { contentType: file.type } });
    await getDb().batch([
      getDb().prepare(`INSERT INTO attachments
    (id, object_key, file_name, content_type, size_bytes, record_type, record_id, uploaded_by, organization_id, scan_status, scan_details)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(id, objectKey, file.name, file.type, file.size, form.get("recordType") || null, form.get("recordId") || null, user.id, context.organization.id, scanStatus, inspection.scanMode),
      auditStatement(user.id, "upload_scanned", "attachment", id, `${file.name} · imza ve içerik politikası kontrolü geçti`, context.organization.id, true),
    ]);
  } catch {
    try { await bucket.delete(objectKey); }
    catch { console.error("Unreferenced upload cleanup required", id); }
    return NextResponse.json({ error: "Dosya kaydı tamamlanamadı." }, { status: 503 });
  }
  return NextResponse.json({ id, fileName: file.name }, { status: 201 });
}
