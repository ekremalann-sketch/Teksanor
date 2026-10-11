import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { rejectCrossSiteMutation } from "@/lib/security";
import { DEMO_PARTS, DEMO_ROLES, DemoError, createDemoCompany, listDemoCompanies, seedDemoPart, validateAccounts, type DemoPart } from "@/lib/demo-company";

// Örnek işletme: yalnız platform yöneticisi oluşturur. Kullanıcı adlarını ve parolaları yönetici yazar;
// parolalar yalnız özet (hash) olarak saklanır, yanıtta geri gönderilmez.
const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: "Oturum gerekli." }, 401);
  if (user.role !== "admin") return json({ error: "Platform yöneticisi gerekli." }, 403);
  return json({ roles: DEMO_ROLES, companies: await listDemoCompanies() });
}

export async function POST(request: Request) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  const user = await getCurrentUser(request);
  if (!user) return json({ error: "Oturum gerekli." }, 401);
  if (user.role !== "admin") return json({ error: "Örnek işletmeyi yalnız platform yöneticisi oluşturur." }, 403);
  try {
    const body = await request.json() as { name?: string; accounts?: unknown; action?: string; organizationId?: string; part?: string };
    if (body.action === "seed") {
      if (!DEMO_PARTS.includes(body.part as DemoPart) || typeof body.organizationId !== "string") return json({ error: "Geçersiz veri parçası." }, 400);
      return json({ ok: true, ...(await seedDemoPart(body.organizationId, body.part as DemoPart)) });
    }
    const accounts = validateAccounts(body.accounts);
    const result = await createDemoCompany(user.id, { name: typeof body.name === "string" ? body.name : undefined, accounts });
    return json({ ok: true, ...result }, 201);
  } catch (error) {
    if (error instanceof DemoError) return json({ error: error.message }, error.status);
    if (error instanceof SyntaxError) return json({ error: "İstek biçimi geçersiz." }, 400);
    console.error("demo-company", error);
    return json({ error: "Örnek işletme oluşturulamadı." }, 500);
  }
}
