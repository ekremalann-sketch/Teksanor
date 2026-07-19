import { NextResponse } from "next/server";
import { getFxRates } from "@/lib/fx";

// Ana sayfadaki döviz kuru şeridi için herkese açık, salt okunur kur verisi.
// Finansal kayıtlar içermez; yalnızca TCMB günlük kurlarını yansıtır.
export async function GET() {
  try {
    const fx = await getFxRates();
    const codes = ["USD", "EUR", "GBP", "CHF", "JPY", "SAR", "AED", "RUB"] as const;
    const rates = codes
      .map((code) => ({ code, rate: Number(fx.rates?.[code] ?? 0) }))
      .filter((item) => item.rate > 0);
    return NextResponse.json(
      { rates, sourceDate: fx.sourceDate, sourceLabel: fx.sourceLabel, live: fx.live },
      { headers: { "Cache-Control": "public, max-age=900" } },
    );
  } catch {
    return NextResponse.json({ rates: [], sourceDate: "", sourceLabel: "TCMB", live: false }, { status: 200 });
  }
}
