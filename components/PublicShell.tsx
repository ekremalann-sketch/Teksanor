import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Mail, MapPin, ShieldCheck } from "lucide-react";

export function PublicHeader() {
  return (
    <header className="enterprise-header">
      <Link href="/" className="enterprise-brand" aria-label="Teksanor ana sayfa">
        <img src="/assets/teksanor-logo.png" alt="Teksanor" />
      </Link>
      <nav aria-label="Kurumsal menü">
        <Link href="/platform">Platform</Link>
        <Link href="/sektorler">Sektörler</Link>
        <Link href="/entegrasyonlar">Entegrasyonlar</Link>
        <Link href="/guven">Güven</Link>
        <Link href="/hakkimizda">Hakkımızda</Link>
      </nav>
      <div className="enterprise-actions">
        <Link href="/fiyatlandirma">Paketler</Link>
        <Link className="enterprise-login" href="/giris">Portala giriş <ArrowRight size={16} /></Link>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="enterprise-footer">
      <div className="enterprise-footer-lead">
        <img src="/assets/teksanor-logo.png" alt="Teksanor" />
        <p>Teknik hizmet, mühendislik ve saha operasyonlarını ölçülebilir bir çalışma düzeninde birleştiren kurumsal operasyon platformu.</p>
        <span><MapPin size={16} /> Türkiye</span>
      </div>
      <div><b>Platform</b><Link href="/platform">Modüller</Link><Link href="/entegrasyonlar">Entegrasyonlar</Link><Link href="/guven">Güven merkezi</Link><Link href="/kurumsal-durum">Ürün durumu</Link></div>
      <div><b>Çözümler</b><Link href="/sektorler/teknik-servis">Teknik servis</Link><Link href="/sektorler/bakim-onarim">Bakım ve onarım</Link><Link href="/sektorler/muhendislik-taahhut">Mühendislik ve taahhüt</Link></div>
      <div><b>Başlangıç</b><Link href="/pilot">Ücretli pilot</Link><Link href="/fiyatlandirma">Paketler</Link><Link href="/yardim">Yardım merkezi</Link><a href="mailto:bilgi@teksanor.com"><Mail size={14} /> İletişim</a></div>
      <div className="enterprise-footer-bottom">
        <span>© {new Date().getFullYear()} Teksanor</span>
        <span><ShieldCheck size={15} /> Operasyon ve karar destek sistemi</span>
        <Link href="/guven#hukuki">Gizlilik ve hukuki çerçeve</Link>
      </div>
    </footer>
  );
}

export function PublicPage({ children }: { children: ReactNode }) {
  return <main className="enterprise-page"><PublicHeader />{children}<PublicFooter /></main>;
}

