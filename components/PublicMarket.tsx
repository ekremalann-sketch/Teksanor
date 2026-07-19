"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Landmark, RefreshCw, ShieldCheck } from "lucide-react";

type Market = { rates: Record<string, number>; sourceDate: string; sourceLabel: string; live: boolean };

export default function PublicMarket() {
  const [market, setMarket] = useState<Market | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  async function load() {
    setRefreshing(true);
    try { const response = await fetch("/api/public/fx", { cache: "no-store" }); if (response.ok) setMarket(await response.json() as Market); }
    finally { setRefreshing(false); }
  }
  useEffect(() => { void load(); const timer = window.setInterval(load, 15 * 60 * 1000); return () => window.clearInterval(timer); }, []);
  return <section className="public-market" id="piyasa">
    <div className="public-market-copy"><span>RESMÎ PİYASA VERİSİ</span><h2>Karar ekranına başlamadan önce güncel görünüm.</h2><p>Başlıca dövizlerin Türk lirası karşılığını, kaynağı ve yayın tarihini açıkça gösteriyoruz. Portal içindeki dövizli borç ve varlıklar da aynı kur düzeniyle TL karşılığına çevrilir.</p><div><ShieldCheck size={17} /> Gösterge niteliğindedir; yatırım tavsiyesi değildir.</div></div>
    <div className="public-market-board">
      <div className="market-board-head"><span><Landmark size={18} /> TCMB döviz satış kurları</span><button type="button" onClick={load} disabled={refreshing}><RefreshCw className={refreshing ? "spinning" : ""} size={16} /> Yenile</button></div>
      <div className="market-board-rates">{["USD", "EUR", "GBP"].map((code) => <article key={code}><span>{code} / TRY <ArrowUpRight size={14} /></span><b>{market?.rates?.[code] ? market.rates[code].toLocaleString("tr-TR", { minimumFractionDigits: 4, maximumFractionDigits: 4 }) : "—"} ₺</b></article>)}</div>
      <div className="market-board-foot"><i className={market?.live ? "live" : ""} /><span>{market?.sourceLabel || "Kur verisi hazırlanıyor"}<small>{market?.sourceDate || "—"} · 15 dakikada bir kontrol edilir</small></span></div>
    </div>
  </section>;
}
