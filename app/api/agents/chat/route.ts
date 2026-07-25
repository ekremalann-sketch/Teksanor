import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addAudit, createId, getDb } from "@/lib/db";
import { requireOrganization } from "@/lib/tenancy";
import { rejectCrossSiteMutation } from "@/lib/security";

function text(value: unknown, max = 4000) { return String(value ?? "").trim().slice(0, max); }
const money = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 });

type OrgContext = {
  organizationName: string;
  totalDebt: number;
  monthlyPayment: number;
  latestPeriod: string;
  projectCount: number;
  activeProjects: number;
  openTasks: number;
  openWorkOrders: number;
  pendingProcurement: number;
  customerCount: number;
  employeeCount: number;
  openRisks: number;
};

async function gatherContext(organizationId: string, organizationName: string): Promise<OrgContext> {
  const db = getDb();
  const num = async (sql: string, ...binds: unknown[]) => {
    try { const row = await db.prepare(sql).bind(...binds).first<{ v: number }>(); return Number(row?.v ?? 0); }
    catch { return 0; }
  };
  const summary = await db.prepare(
    "SELECT period, total_debt, monthly_payment FROM organization_period_summaries WHERE organization_id = ? ORDER BY sort_order DESC LIMIT 1")
    .bind(organizationId).first<{ period: string; total_debt: number; monthly_payment: number }>().catch(() => null);
  return {
    organizationName,
    totalDebt: Number(summary?.total_debt ?? 0),
    monthlyPayment: Number(summary?.monthly_payment ?? 0),
    latestPeriod: summary?.period ?? "güncel dönem",
    projectCount: await num("SELECT COUNT(*) AS v FROM projects WHERE organization_id = ?", organizationId),
    activeProjects: await num("SELECT COUNT(*) AS v FROM projects WHERE organization_id = ? AND status = 'active'", organizationId),
    openTasks: await num("SELECT COUNT(*) AS v FROM tasks WHERE organization_id = ? AND status != 'done' AND status != 'cancelled'", organizationId),
    openWorkOrders: await num("SELECT COUNT(*) AS v FROM work_orders WHERE organization_id = ? AND status NOT IN ('completed','cancelled')", organizationId),
    pendingProcurement: await num("SELECT COUNT(*) AS v FROM procurement_requests WHERE organization_id = ? AND status IN ('pending','approved','ordered')", organizationId),
    customerCount: await num("SELECT COUNT(*) AS v FROM customers WHERE organization_id = ?", organizationId),
    employeeCount: await num("SELECT COUNT(*) AS v FROM employees WHERE organization_id = ? AND status = 'active'", organizationId),
    openRisks: await num("SELECT COUNT(*) AS v FROM risks WHERE organization_id = ? AND status IN ('identified','mitigating')", organizationId),
  };
}

function contextSummaryText(ctx: OrgContext): string {
  return [
    `Şirket: ${ctx.organizationName}.`,
    `Son dönem (${ctx.latestPeriod}) toplam borç ${money.format(ctx.totalDebt)}, aylık ödeme ${money.format(ctx.monthlyPayment)}.`,
    `Proje: ${ctx.projectCount} (aktif ${ctx.activeProjects}).`,
    `Açık görev: ${ctx.openTasks}. Açık iş emri: ${ctx.openWorkOrders}. Bekleyen satın alma: ${ctx.pendingProcurement}.`,
    `Müşteri: ${ctx.customerCount}. Aktif çalışan: ${ctx.employeeCount}. Açık risk: ${ctx.openRisks}.`,
  ].join(" ");
}

function agentPersona(agentName: string): string {
  const name = agentName.toLocaleLowerCase("tr-TR");
  if (name.includes("finans")) return "Finans Kontrol Ajanı olarak borç, ödeme, vade ve nakit dengesine odaklan.";
  if (name.includes("proje")) return "Proje Koordinasyon Ajanı olarak proje ilerlemesi, hedef tarihler ve sorumlulara odaklan.";
  if (name.includes("operasyon")) return "Operasyon Takip Ajanı olarak iş emirleri, saha ziyaretleri ve satın alma taleplerine odaklan.";
  if (name.includes("yönetim") || name.includes("rapor")) return "Yönetim Raporlama Ajanı olarak tüm departmanların özetini ve karar bekleyen konuları sun.";
  return "Kurumsal asistan olarak şirket verilerine dayalı, sade ve doğrulanabilir yanıtlar ver.";
}

function mockResponse(agentName: string, message: string, ctx: OrgContext, history: { role: string; content: string }[]): string {
  const persona = agentPersona(agentName);
  const name = agentName.toLocaleLowerCase("tr-TR");
  const request = message.toLocaleLowerCase("tr-TR");
  const continuing = history.length > 0;
  const lines: string[] = [];
  if (!continuing) lines.push(`Merhaba, ben ${agentName}. ${persona}`);
  else lines.push("Önceki konuşmamızı ve güncel şirket kayıtlarını birlikte dikkate alıyorum.");

  if (request.includes("özet") || request.includes("durum") || request.includes("genel")) {
    lines.push(`Yönetim özeti: ${ctx.activeProjects} aktif proje, ${ctx.openTasks} açık görev, ${ctx.openWorkOrders} açık iş emri ve ${ctx.openRisks} açık risk bulunuyor.`);
    lines.push(`${ctx.latestPeriod} döneminde toplam borç ${money.format(ctx.totalDebt)}, planlanan aylık ödeme ${money.format(ctx.monthlyPayment)}.`);
  } else if (request.includes("öncelik") || request.includes("ne yap") || request.includes("aksiyon")) {
    const actions = [
      ctx.openRisks > 0 ? `${ctx.openRisks} açık risk için sorumlu ve hedef tarih belirleyin.` : "Yeni risk kaydı bulunmuyor; haftalık kontrol ritmini koruyun.",
      ctx.openWorkOrders > 0 ? `${ctx.openWorkOrders} açık iş emrini tarih ve sorumluya göre sıralayın.` : "Açık iş emri bulunmuyor; bakım takvimini kontrol edin.",
      ctx.pendingProcurement > 0 ? `${ctx.pendingProcurement} satın alma talebinin bütçe ve teslim tarihini doğrulayın.` : "Bekleyen satın alma talebi bulunmuyor.",
    ];
    lines.push(`Önerilen sıra:\n1. ${actions[0]}\n2. ${actions[1]}\n3. ${actions[2]}`);
  } else if (request.includes("karşılaştır") || request.includes("kıyas") || request.includes("önceki")) {
    lines.push(`Elimdeki son kayıt ${ctx.latestPeriod} dönemine ait. Bu dönemde toplam borç ${money.format(ctx.totalDebt)} ve aylık ödeme ${money.format(ctx.monthlyPayment)}.`);
    lines.push("Sağlıklı bir dönem karşılaştırması için karşılaştırılacak ayı veya göstergeyi yazın; borç, ödeme, gider, görev ya da proje bazında ayırabilirim.");
  } else if (request.includes("neden") || request.includes("risk")) {
    lines.push(`Kayıtlarda ${ctx.openRisks} açık risk, ${ctx.openTasks} açık görev ve ${ctx.openWorkOrders} açık iş emri görünüyor.`);
    lines.push("Neden analizi için geciken kaydın adını yazın; süre, sorumlu, satın alma ve finans etkisini ayrı başlıklarda değerlendirebilirim.");
  } else
  if (name.includes("finans")) {
    lines.push(`Güncel duruma göre ${ctx.latestPeriod} döneminde toplam borç ${money.format(ctx.totalDebt)}, planlanan aylık ödeme ise ${money.format(ctx.monthlyPayment)} seviyesinde.`);
    lines.push(`Bekleyen ${ctx.pendingProcurement} satın alma talebi nakit akışını etkileyebilir; vade takibini öneririm.`);
  } else if (name.includes("proje")) {
    lines.push(`Portföyde ${ctx.projectCount} proje var ve bunların ${ctx.activeProjects} tanesi aktif olarak yürüyor.`);
    lines.push(`Açık ${ctx.openTasks} görevin sorumlularını ve hedef tarihlerini gözden geçirmenizi öneririm.`);
  } else if (name.includes("operasyon")) {
    lines.push(`Şu an ${ctx.openWorkOrders} açık iş emri ve ${ctx.pendingProcurement} bekleyen satın alma talebi bulunuyor.`);
    lines.push(`Geciken iş emirlerini önceliklendirip saha ekiplerine atamanızı öneririm.`);
  } else if (name.includes("yönetim") || name.includes("rapor")) {
    lines.push(`Özet: ${ctx.activeProjects} aktif proje, ${ctx.openTasks} açık görev, ${ctx.openWorkOrders} açık iş emri, ${ctx.openRisks} açık risk.`);
    lines.push(`Toplam borç ${money.format(ctx.totalDebt)}; karar bekleyen kritik konu olarak vade ve risk takibini işaretliyorum.`);
  } else {
    lines.push(contextSummaryText(ctx));
  }
  lines.push(`Sorunuzdaki “${message.slice(0, 120)}” ifadesini bu çerçevede değerlendirdim. İsterseniz devamında tablo, kısa yönetici özeti veya sıralı aksiyon planı hazırlayabilirim.`);
  lines.push("Not: Yapay zekâ bağlantısı henüz etkin olmadığından bu yanıt, şirket verilerinize dayanan otomatik bir analiz özetidir.");
  return lines.join("\n\n");
}

async function callLlm(agentName: string, message: string, ctx: OrgContext, history: { role: string; content: string }[]): Promise<string | null> {
  const secrets = env as unknown as { OPENAI_API_KEY?: string; ABACUS_API_KEY?: string };
  const apiKey = secrets.OPENAI_API_KEY || secrets.ABACUS_API_KEY;
  if (!apiKey) return null;
  try {
    const systemPrompt = `Sen ${agentName} adlı, Teksanor kurumsal yönetim platformunda çalışan bir yapay zekâ asistanısın. ${agentPersona(agentName)}
Türkçe, sade, doğal ve doğrulanabilir biçimde konuş.
Bu bir tek-soru cevap kutusu değil, devam eden bir iş görüşmesidir:
- Son mesajın yanında konuşma geçmişini de dikkate al.
- Önceki yanıtı tekrar etme; yeni soruyu önceki bağlamın devamı olarak ele al.
- Kullanıcının ihtiyacına göre kısa özet, ayrıntılı açıklama, karşılaştırma, tabloya uygun liste veya sıralı aksiyon planı üret.
- Eksik bilgi gerçekten sonucu değiştiriyorsa tek ve açık bir takip sorusu sor.
- Kayıtlarda olmayan sayı, olay veya kişi uydurma. Varsayım yaptığında açıkça belirt.
- Finansal, hukuki veya çalışanı etkileyen işlemleri kendiliğinden uygulama; yalnızca seçenek ve gerekçe sun.
Güncel şirket verileri:\n${contextSummaryText(ctx)}`;
    const messages = [
      { role: "system", content: systemPrompt },
      ...history.slice(-16).map((item) => ({ role: item.role === "assistant" ? "assistant" : "user", content: item.content })),
      { role: "user", content: message },
    ];
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: "gpt-4o-mini", messages, temperature: 0.65, max_tokens: 950 }),
    });
    if (!response.ok) return null;
    const data = await response.json() as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const context = await requireOrganization(request, user);
    const agentName = new URL(request.url).searchParams.get("agent")?.trim() || "";
    const result = await getDb().prepare(
      "SELECT id, agent_name, role, content, created_at FROM agent_chats WHERE organization_id = ? AND agent_name = ? ORDER BY created_at DESC LIMIT 20")
      .bind(context.organization.id, agentName).all();
    return NextResponse.json({ messages: result.results.reverse() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Sohbet geçmişi alınamadı." }, { status: 403 });
  }
}

export async function POST(request: Request) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const context = await requireOrganization(request, user);
    const orgId = context.organization.id;
    const body = await request.json() as Record<string, unknown>;
    const agentName = text(body.agentName ?? body.agent_name, 120);
    const message = text(body.message, 3000);
    if (!agentName || !message) return NextResponse.json({ error: "Ajan adı ve mesaj gereklidir." }, { status: 400 });
    const db = getDb();

    // Son 10 mesajı bağlam olarak çek.
    const historyRes = await db.prepare(
      "SELECT role, content FROM agent_chats WHERE organization_id = ? AND agent_name = ? ORDER BY created_at DESC LIMIT 10")
      .bind(orgId, agentName).all<{ role: string; content: string }>();
    const history = historyRes.results.reverse();

    const ctx = await gatherContext(orgId, context.organization.name);
    const snapshot = contextSummaryText(ctx);

    // Kullanıcı mesajını kaydet.
    const userMsgId = createId("chat");
    await db.prepare(`INSERT INTO agent_chats (id, organization_id, agent_name, user_id, role, content, context_snapshot)
      VALUES (?, ?, ?, ?, 'user', ?, ?)`)
      .bind(userMsgId, orgId, agentName, user.id, message, snapshot).run();

    // Yanıt üret (LLM veya akıllı mock).
    const llmReply = await callLlm(agentName, message, ctx, history);
    const reply = llmReply ?? mockResponse(agentName, message, ctx, history);
    const source = llmReply ? "llm" : "mock";

    const assistantMsgId = createId("chat");
    await db.prepare(`INSERT INTO agent_chats (id, organization_id, agent_name, user_id, role, content, context_snapshot)
      VALUES (?, ?, ?, ?, 'assistant', ?, ?)`)
      .bind(assistantMsgId, orgId, agentName, user.id, reply, snapshot).run();

    await addAudit(user.id, "chat", "agent", agentName, `${agentName} ile sohbet edildi.`, orgId);
    return NextResponse.json({ ok: true, reply, source, userMessageId: userMsgId, assistantMessageId: assistantMsgId });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Ajan yanıtı üretilemedi." }, { status: 400 });
  }
}
