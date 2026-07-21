export const FIAT_CURRENCIES = [
  "TRY", "USD", "EUR", "GBP", "CHF", "CAD", "AUD", "JPY", "CNY", "AED", "SAR", "QAR",
  "KWD", "AZN", "BGN", "RON", "RUB", "DKK", "SEK", "NOK", "KRW", "PKR", "IRR",
] as const;

export const GOLD_UNITS = [
  "GRAM_GOLD", "QUARTER_GOLD", "HALF_GOLD", "FULL_GOLD", "REPUBLIC_GOLD", "ATA_GOLD", "BRACELET_22K_GRAM",
] as const;

export type FxRates = {
  TRY: number;
  USD: number;
  EUR: number;
  rates: Record<string, number>;
  sourceDate: string;
  sourceLabel: string;
  live: boolean;
  goldRates: Record<string, number>;
  goldSourceDate: string;
  goldSourceLabel: string;
  goldLive: boolean;
  goldOunceUsd: number;
};

const lastVerified: FxRates = {
  TRY: 1,
  USD: 47.0517,
  EUR: 53.9514,
  rates: { TRY: 1, USD: 47.0517, EUR: 53.9514 },
  sourceDate: "16.07.2026",
  sourceLabel: "Son doğrulanmış TCMB gösterge kuru",
  live: false,
  goldRates: {},
  goldSourceDate: "—",
  goldSourceLabel: "Altın referans verisi alınamadı",
  goldLive: false,
  goldOunceUsd: 0,
};

const TROY_OUNCE_GRAMS = 31.1034768;

type GoldApiResponse = {
  price?: number;
  updatedAt?: string;
};

async function getGoldRates(usdTry: number) {
  try {
    const response = await fetch("https://api.gold-api.com/price/XAU", {
      headers: { "User-Agent": "Teksanor-Finans-Paneli/1.0" },
    });
    if (!response.ok) throw new Error("Altın verisi alınamadı.");
    const payload = await response.json() as GoldApiResponse;
    const ounceUsd = Number(payload.price ?? 0);
    if (!Number.isFinite(ounceUsd) || ounceUsd <= 0 || !Number.isFinite(usdTry) || usdTry <= 0) throw new Error("Altın verisi geçersiz.");

    const pureGramTry = ounceUsd * usdTry / TROY_OUNCE_GRAMS;
    const rates = {
      GRAM_GOLD: pureGramTry,
      QUARTER_GOLD: pureGramTry * 1.608,
      HALF_GOLD: pureGramTry * 3.216,
      FULL_GOLD: pureGramTry * 6.432,
      REPUBLIC_GOLD: pureGramTry * 6.615,
      ATA_GOLD: pureGramTry * 6.615,
      BRACELET_22K_GRAM: pureGramTry * (22 / 24),
    };
    const updated = payload.updatedAt ? new Date(payload.updatedAt) : new Date();
    return {
      rates,
      sourceDate: Number.isNaN(updated.getTime()) ? new Date().toLocaleString("tr-TR") : updated.toLocaleString("tr-TR"),
      sourceLabel: "Gold API ons spot fiyatı + TCMB USD/TRY kuru",
      live: true,
      ounceUsd,
    };
  } catch {
    return { rates: {}, sourceDate: "—", sourceLabel: "Altın referans verisi alınamadı", live: false, ounceUsd: 0 };
  }
}

function readCurrencies(xml: string) {
  const rates: Record<string, number> = { TRY: 1 };
  const blocks = xml.match(/<Currency\b[^>]*>[\s\S]*?<\/Currency>/g) ?? [];
  for (const block of blocks) {
    const code = block.match(/(?:CurrencyCode|Kod)="([A-Z]{3})"/)?.[1];
    const raw = block.match(/<ForexSelling>([^<]+)<\/ForexSelling>/)?.[1];
    const unitRaw = block.match(/<Unit>([^<]+)<\/Unit>/)?.[1];
    const value = Number(raw?.replace(",", "."));
    const unit = Number(unitRaw || 1);
    if (code && Number.isFinite(value) && value > 0 && Number.isFinite(unit) && unit > 0) rates[code] = value / unit;
  }
  return rates;
}

export async function getFxRates(): Promise<FxRates> {
  try {
    const response = await fetch("https://www.tcmb.gov.tr/kurlar/today.xml", {
      headers: { "User-Agent": "Teksanor-Finans-Paneli/1.0" },
    });
    if (!response.ok) return lastVerified;
    const xml = await response.text();
    const rates = readCurrencies(xml);
    const USD = rates.USD;
    const EUR = rates.EUR;
    if (!USD || !EUR) return lastVerified;
    const sourceDate = xml.match(/Tarih="([^"]+)"/)?.[1] ?? new Date().toLocaleDateString("tr-TR");
    const gold = await getGoldRates(USD);
    return {
      TRY: 1, USD, EUR, rates, sourceDate, sourceLabel: "TCMB günlük döviz satış kuru", live: true,
      goldRates: gold.rates, goldSourceDate: gold.sourceDate, goldSourceLabel: gold.sourceLabel,
      goldLive: gold.live, goldOunceUsd: gold.ounceUsd,
    };
  } catch {
    return lastVerified;
  }
}
