import Link from "next/link";
import { ArrowLeft, SearchX } from "lucide-react";

export default function NotFound() {
  return <main className="app-error-page"><section><img src="/assets/teksanor-logo.png" alt="Teksanor" /><div className="app-error-icon"><SearchX /></div><span>SAYFA BULUNAMADI</span><h1>Aradığınız içerik taşınmış veya henüz yayınlanmamış olabilir.</h1><p>Bağlantıyı kontrol edebilir ya da güvenle ana sayfaya dönerek Teksanor çözümlerini incelemeye devam edebilirsiniz.</p><div><Link href="/"><ArrowLeft size={17} /> Ana sayfaya dön</Link></div></section></main>;
}
