import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addAudit, createId, getDb } from "@/lib/db";
import { FIAT_CURRENCIES, GOLD_UNITS, getFxRates } from "@/lib/fx";
import { canManageOrganization, requireOrganization } from "@/lib/tenancy";

type BalanceRow = { id: string; account_name: string; currency: string; amount: number; manual_rate: number | null; note?: string; created_at: string };
type DebtRow = { id: string; lender_name: string; debt_type: string; currency: string; amount: number; manual_rate: number | null; due_date?: string; note?: string; status: string; created_at: string };
type ReferenceRate = { code: string; rate_try: number; updated_at: string };

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  let context;
  try { context = await requireOrganization(request, user); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Çalışma alanına erişim reddedildi." }, { status: 403 }); }
  const organizationId = context.organization.id;
  const database = getDb();
  const [balancesResult, debtsResult, referenceResult, latestExpense] = await Promise.all([
    database.prepare("SELECT * FROM cash_balances WHERE organization_id = ? ORDER BY created_at DESC").bind(organizationId).all<BalanceRow>(),
    database.prepare("SELECT * FROM manual_debts WHERE organization_id = ? ORDER BY status, created_at DESC").bind(organizationId).all<DebtRow>(),
    database.prepare("SELECT code, rate_try, updated_at FROM organization_reference_rates WHERE organization_id = ?").bind(organizationId).all<ReferenceRate>(),
    database.prepare("SELECT expense_total FROM organization_period_summaries WHERE organization_id = ? ORDER BY sort_order DESC LIMIT 1").bind(organizationId).first<{ expense_total: number }>(),
  ]);
  const fx = await getFxRates();
  const references = Object.fromEntries(referenceResult.results.map((item) => [item.code, Number(item.rate_try)]));
  const rateFor = (currency: string, manualRate?: number | null) => {
    if (currency === "TRY") return 1;
    return Number(manualRate || references[currency] || fx.goldRates[currency] || fx.rates[currency] || 0);
  };
  const balances = balancesResult.results.map((item) => {
    const rate = rateFor(item.currency);
    return { ...item, rate_used: rate, rate_ready: rate > 0, tl_equivalent: Number(item.amount) * rate };
  });
  const debts = debtsResult.results.map((item) => {
    const rate = rateFor(item.currency, item.manual_rate);
    return { ...item, rate_used: rate, rate_ready: rate > 0, tl_equivalent: Number(item.amount) * rate };
  });
  const totalCashTL = balances.reduce((sum, item) => sum + item.tl_equivalent, 0);
  const totalManualDebtTL = debts.filter((item) => item.status === "open").reduce((sum, item) => sum + item.tl_equivalent, 0);
  const latestExpenseTL = Number(latestExpense?.expense_total ?? 0);
  return NextResponse.json({
    fx,
    references,
    balances,
    debts,
    summary: {
      totalCashTL,
      totalManualDebtTL,
      latestExpenseTL,
      netAfterDebtAndExpense: totalCashTL - totalManualDebtTL - latestExpenseTL,
      unresolvedGoldCount: debts.filter((item) => !item.rate_ready).length,
    },
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  let context;
  try { context = await requireOrganization(request, user); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Çalışma alanına erişim reddedildi." }, { status: 403 }); }
  const organizationId = context.organization.id;
  const body = (await request.json()) as Record<string, unknown>;
  const action = String(body.action ?? "");
  const database = getDb();

  if (action === "balance") {
    const currency = String(body.currency ?? "TRY");
    const amount = Number(body.amount ?? 0);
    const manualRate = Number(body.manualRate ?? 0);
    const allowedCurrencies = [...FIAT_CURRENCIES, ...GOLD_UNITS] as readonly string[];
    if (!body.accountName || !allowedCurrencies.includes(currency) || !Number.isFinite(amount) || amount <= 0 || !Number.isFinite(manualRate) || manualRate < 0) {
      return NextResponse.json({ error: "Hesap adı, para birimi ve sıfırdan büyük tutar gereklidir." }, { status: 400 });
    }
    const id = createId("cash");
    await database.prepare("INSERT INTO cash_balances (id, account_name, currency, amount, manual_rate, note, created_by, organization_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(id, String(body.accountName).trim(), currency, amount, manualRate > 0 ? manualRate : null, body.note ? String(body.note) : null, user.id, organizationId).run();
    await addAudit(user.id, "create", "cash_balance", id, `${body.accountName} nakit kaydı eklendi.`, organizationId);
    return NextResponse.json({ id }, { status: 201 });
  }

  if (action === "debt") {
    const allowedCurrencies = [...FIAT_CURRENCIES, ...GOLD_UNITS] as readonly string[];
    const currency = String(body.currency ?? "TRY");
    const amount = Number(body.amount ?? 0);
    const manualRate = Number(body.manualRate ?? 0);
    if (!body.lenderName || !allowedCurrencies.includes(currency) || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Borç alınan kişi/kurum, tür ve sıfırdan büyük miktar gereklidir." }, { status: 400 });
    }
    const id = createId("debt");
    await database.prepare(`INSERT INTO manual_debts
      (id, lender_name, debt_type, currency, amount, manual_rate, due_date, note, status, created_by, organization_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)`)
      .bind(id, String(body.lenderName).trim(), String(body.debtType ?? "cash"), currency, amount,
        manualRate > 0 ? manualRate : null, body.dueDate ? String(body.dueDate) : null,
        body.note ? String(body.note) : null, user.id, organizationId).run();
    await addAudit(user.id, "create", "manual_debt", id, `${body.lenderName} elden borç kaydı eklendi.`, organizationId);
    return NextResponse.json({ id }, { status: 201 });
  }

  if (action === "rates") {
    if (!canManageOrganization(user, context.organization)) return NextResponse.json({ error: "Altın referans fiyatlarını yalnızca firma yetkilisi değiştirebilir." }, { status: 403 });
    const rates = [
      ["GRAM_GOLD", Number(body.gramGold ?? 0)],
      ["QUARTER_GOLD", Number(body.quarterGold ?? 0)],
      ["HALF_GOLD", Number(body.halfGold ?? 0)],
      ["FULL_GOLD", Number(body.fullGold ?? 0)],
      ["REPUBLIC_GOLD", Number(body.republicGold ?? 0)],
      ["ATA_GOLD", Number(body.ataGold ?? 0)],
      ["BRACELET_22K_GRAM", Number(body.bracelet22kGram ?? 0)],
    ] as const;
    if (rates.some(([, value]) => !Number.isFinite(value) || value < 0)) {
      return NextResponse.json({ error: "Referans fiyatlar geçersiz." }, { status: 400 });
    }
    await database.batch(rates.filter(([, value]) => value > 0).map(([code, value]) => database.prepare(`INSERT INTO organization_reference_rates (organization_id, code, rate_try, updated_by)
      VALUES (?, ?, ?, ?) ON CONFLICT(organization_id, code) DO UPDATE SET rate_try = excluded.rate_try, updated_by = excluded.updated_by, updated_at = CURRENT_TIMESTAMP`)
      .bind(organizationId, code, value, user.id)));
    await addAudit(user.id, "update", "reference_rates", null, "Altın referans fiyatları güncellendi.", organizationId);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Geçersiz işlem." }, { status: 400 });
}
