import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { requireOrganization } from "@/lib/tenancy";

type StoredObject = { body: ReadableStream; httpMetadata?: { contentType?: string } };
type Bucket = { get: (key: string) => Promise<StoredObject | null> };

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  let orgContext;
  try { orgContext = await requireOrganization(request, user); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Çalışma alanına erişim reddedildi." }, { status: 403 }); }
  const { id } = await context.params;
  const record = await getDb().prepare("SELECT object_key, file_name, content_type FROM attachments WHERE id = ? AND organization_id = ?")
    .bind(id, orgContext.organization.id).first<{ object_key: string; file_name: string; content_type: string }>();
  if (!record) return NextResponse.json({ error: "Dosya bulunamadı." }, { status: 404 });
  const bucket = (env as unknown as { UPLOADS?: Bucket }).UPLOADS;
  const object = bucket ? await bucket.get(record.object_key) : null;
  if (!object) return NextResponse.json({ error: "Dosya bulunamadı." }, { status: 404 });
  return new Response(object.body, {
    headers: {
      "Content-Type": record.content_type,
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(record.file_name)}`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
