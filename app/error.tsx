"use client";

import { AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="app-error-page">
    <section>
      <img src="/assets/teksanor-logo.png" alt="Teksanor" />
      <div className="app-error-icon"><AlertTriangle size={28} /></div>
      <span>GÜVENLİ KURTARMA EKRANI</span>
      <h1>Sayfa yüklenirken geçici bir sorun oluştu.</h1>
      <p>Verileriniz silinmedi. Bağlantıyı yenileyebilir veya güvenle ana sayfaya dönebilirsiniz.</p>
      <div><button type="button" onClick={reset}><RefreshCw size={17} /> Yeniden dene</button><a href="/"><ArrowLeft size={17} /> Ana sayfa</a></div>
    </section>
  </main>;
}
