"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Coins, Landmark, RefreshCw, ShieldCheck } from "lucide-react";

type Market = {
  rates: Record<string, number>;
  goldRates: Record<string, number>;
  sourceDate: string;
  sourceLabel: string;
  live: boolean;
  goldSourceDate: string;
  goldSourceLabel: string;
  goldLive: boolean;
};

const goldLabels: Record<string, string> = {
  GRAM_GOLD: "Gram altın",
  QUARTER_GOLD: "Çeyrek altın",
  HALF_GOLD: "Yarım altın",
  FULL_GOLD: "Tam altın",
};

export default function PublicMarket() {
  const [market, setMarket] = useState<Market | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  async function load() {
    setRefreshing(true);
    try { const response = await fetch("/api/public/fx", { cache: "no-store" }); if (response.ok) setMarket(await response.json() as Market); }
    finally { setRefreshing(false); }
  }
  useEffect(() => { void load(); const timer = window.setInterval(load, 60 * 1000); return () => window.clearInterval(timer); }, []);
  return <section className="public-market" id="piyasa">
    <div className="public-market-copy"><span>RESMÎ PİYASA VERİSİ</span><h2>Karar ekranına başlamadan önce güncel görünüm.</h2><p>Başlıca dövizlerin Türk lirası karşılığını, kaynağı ve yayın tarihini açıkça gösteriyoruz. Portal içindeki dövizli borç ve varlıklar da aynı kur düzeniyle TL karşılığına çevrilir.</p><div><ShieldCheck size={17} /> Gösterge niteliğindedir; yatırım tavsiyesi değildir.</div></div>
    <div className="public-market-board">
      <div className="market-board-head"><span><Landmark size={18} /> TCMB döviz satış kurları</span><button type="button" onClick={load} disabled={refreshing}><RefreshCw className={refreshing ? "spinning" : ""} size={16} /> Yenile</button></div>
      <div className="market-board-rates">{["USD", "EUR", "GBP"].map((code) => <article key={code}><span>{code} / TRY <ArrowUpRight size={14} /></span><b>{market?.rates?.[code] ? market.rates[code].toLocaleString("tr-TR", { minimumFractionDigits: 4, maximumFractionDigits: 4 }) : "—"} ₺</b></article>)}</div>
      <div className="market-board-gold-head"><span><Coins size={18} /> Altın referans değerleri</span><small>Ons spot fiyatı ve TCMB USD/TRY kuru üzerinden hesaplanır</small></div>
      <div className="market-board-gold">{Object.keys(goldLabels).map((code) => <article key={code}><span>{goldLabels[code]}</span><b>{market?.goldRates?.[code] ? market.goldRates[code].toLocaleString("tr-TR", { maximumFractionDigits: 2 }) : "—"} ₺</b></article>)}</div>
      <div className="gold-market-note"><Coins size={21} /><span><b>Şeffaf hesaplama, doğru hukuki sınır</b><small>Gösterilen değerler saf metal karşılığına dayalı teknik referanstır; kuyumcu alış/satış fiyatı değildir. İşçilik, prim ve kurum makası içermez. Portalda firma tarafından onaylanan özel fiyat varsa o değer öncelikli kullanılır.</small></span><a href="https://gold-api.com/terms" target="_blank" rel="noreferrer">Veri kullanım koşulları <ArrowUpRight size={14} /></a></div>
      <div className="market-board-foot"><i className={market?.live ? "live" : ""} /><span>{market?.sourceLabel || "Kur verisi hazırlanıyor"}<small>{market?.sourceDate || "—"} · Dakikada bir güncellik kontrolü yapılır</small></span></div>
      <div className="market-board-foot gold-source"><i className={market?.goldLive ? "live" : ""} /><span>{market?.goldSourceLabel || "Altın verisi hazırlanıyor"}<small>{market?.goldSourceDate || "—"} · Gösterge niteliğindedir, yatırım tavsiyesi değildir</small></span></div>
    </div>
  </section>;
}
