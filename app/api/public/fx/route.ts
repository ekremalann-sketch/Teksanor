import { NextResponse } from "next/server";

// Demo döviz kurları (harici bağımlılık olmadan). Gerçek entegrasyon planlanmıştır.
export async function GET() {
  return NextResponse.json({
    base: "TRY",
    updated_at: new Date().toISOString(),
    source: "demo",
    rates: {
      USD: 34.25,
      EUR: 37.10,
      GBP: 43.60,
      GAU: 2985.0,
    },
  });
}
