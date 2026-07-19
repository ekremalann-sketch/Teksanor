import Link from "next/link";
import { ArrowRight, Compass, Home } from "lucide-react";

export const metadata = { title: "Sayfa bulunamadı | Teksanor" };

export default function NotFound() {
  return (
    <main className="app-error-page">
      <img src="/assets/teksanor-logo.png" alt="Teksanor" style={{ height: 44 }} />
      <div className="app-error-icon"><Compass size={30} /></div>
      <h1>Aradığınız sayfa bulunamadı</h1>
      <p>Bağlantı değişmiş veya kaldırılmış olabilir. Aşağıdaki bağlantılarla devam edebilirsiniz.</p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
        <Link className="primary-action" href="/"><Home size={17} /> Ana sayfaya dön</Link>
        <Link className="secondary-action" href="/cozumler">Çözümleri incele <ArrowRight size={16} /></Link>
      </div>
    </main>
  );
}
