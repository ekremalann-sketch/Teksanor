import Link from "next/link";
import { PublicPage } from "@/components/PublicShell";
import { metaFor } from "@/lib/seo";
import { statusHistory, type DayState } from "@/lib/status-log";

export const metadata = metaFor("/durum");
export const dynamic = "force-dynamic";

// TG2: herkese açık durum sayfası. Son 90 günün yoklama kaydı; yoklama olmayan gün "veri yok" olarak kalır.
const LABEL: Record<DayState, string> = { calisti: "Çalıştı", kesinti: "Kesinti kaydedildi", "veri-yok": "Veri yok" };
const CSS = `.durum-bars{display:grid;grid-template-columns:repeat(90,1fr);gap:2px;margin:16px 0;max-width:900px}.durum-bars span{height:34px;border-radius:2px}.durum-bars .calisti{background:rgb(22 163 74)}.durum-bars .kesinti{background:rgb(220 38 38)}.durum-bars .veri-yok{background:rgb(209 213 219)}.durum-key{display:flex;gap:16px;flex-wrap:wrap;font-size:.9rem}.durum-key i{display:inline-block;width:12px;height:12px;border-radius:2px;margin-right:6px;vertical-align:middle}@media(max-width:600px){.durum-bars{grid-template-columns:repeat(30,1fr)}.durum-bars span:nth-child(-n+60){display:none}}`;

export default async function StatusPage() {
  let history: Awaited<ReturnType<typeof statusHistory>> | null = null;
  try { history = await statusHistory(); } catch { history = null; }
  const today = history?.days.at(-1);
  const headline = !history ? "Durum kaydı şu an okunamıyor" : today?.state === "kesinti" ? "Bugün kesinti kaydedildi" : "Sistem çalışıyor";
  return (
    <PublicPage>
      <style>{CSS}</style>
      <section className="enterprise-section status-hero">
        <span className="enterprise-kicker">Hizmet durumu</span>
        <h1>{headline}</h1>
        <p>Veritabanı, şema ve dosya depolama bağlantısı düzenli olarak yoklanır. Aşağıda son 90 günün kaydı vardır. Yoklama yapılmayan günler “veri yok” olarak gösterilir; boşluklar doldurulmaz.</p>
      </section>
      <section className="enterprise-section" aria-label="Son 90 gün">
        <div className="enterprise-heading"><span className="enterprise-kicker">Son 90 gün</span><h2>{history?.uptime != null ? `Yoklamaların %${history.uptime.toLocaleString("tr-TR")} kadarı başarılı (${history.daysWithData} gün veri)` : "Henüz yeterli yoklama kaydı yok"}</h2></div>
        {history && <div className="durum-bars" role="img" aria-label={`Son 90 gün: ${history.days.filter((d) => d.state === "kesinti").length} gün kesinti, ${history.days.filter((d) => d.state === "veri-yok").length} gün veri yok`}>
          {history.days.map((d) => <span key={d.day} className={d.state} title={`${d.day}: ${LABEL[d.state]}`} />)}
        </div>}
        <p className="durum-key"><span><i style={{ background: "rgb(22 163 74)" }} />Çalıştı</span><span><i style={{ background: "rgb(220 38 38)" }} />Kesinti kaydedildi</span><span><i style={{ background: "rgb(209 213 219)" }} />Veri yok</span></p>
        <p>Teknik ayrıntı: <a href="/api/health">/api/health</a> uç noktası anlık durumu verir. Güvenlik açığı bildirmek için <Link href="/guven#acik-bildirme">güven merkezine</Link> bakın.</p>
      </section>
    </PublicPage>
  );
}
