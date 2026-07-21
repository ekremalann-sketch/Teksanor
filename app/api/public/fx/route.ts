import { NextResponse } from "next/server";
import { getFxRates } from "@/lib/fx";

export async function GET() {
  const fx = await getFxRates();
  return NextResponse.json({
    rates: { USD: fx.rates.USD || fx.USD, EUR: fx.rates.EUR || fx.EUR, GBP: fx.rates.GBP || 0 },
    goldRates: fx.goldRates,
    goldSourceDate: fx.goldSourceDate,
    goldSourceLabel: fx.goldSourceLabel,
    goldLive: fx.goldLive,
    goldOunceUsd: fx.goldOunceUsd,
    sourceDate: fx.sourceDate,
    sourceLabel: fx.sourceLabel,
    live: fx.live,
  }, { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } });
}
