import Link from "next/link";
import InsightListing from "@/components/InsightListing";
import {metaFor} from "@/lib/seo";
export const metadata=metaFor("/icerikler");
export default function Page(){return <main className="site-shell insights-page"><header className="site-header"><Link className="brand-link" href="/" aria-label="Teksanor ana sayfa"><img className="header-logo" src="/assets/teksanor-logo.webp" alt="Teksanor" /></Link><nav aria-label="İçerik menüsü"><Link href="/">Ana sayfa</Link><Link href="/giris">Giriş yap</Link></nav></header><h1 className="insights-page-title">İçgörüler</h1><InsightListing/></main>}
