import { NextResponse } from "next/server";
import { getFxRates } from "@/lib/fx";

export async function GET() {
  const fx = await getFxRates();
  return NextResponse.json({
    rates: { USD: fx.rates.USD || fx.USD, EUR: fx.rates.EUR || fx.EUR, GBP: fx.rates.GBP || 0 },
    sourceDate: fx.sourceDate,
    sourceLabel: fx.sourceLabel,
    live: fx.live,
  }, { headers: { "Cache-Control": "public, max-age=900, stale-while-revalidate=3600" } });
}
