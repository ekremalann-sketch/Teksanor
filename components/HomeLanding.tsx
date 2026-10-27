"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {ArrowRight,CheckCircle2,ShieldCheck,Workflow,Factory,UserRound} from "lucide-react";
const sectors=[
 {href:"/sektorler/teknik-servis",title:"Teknik servis",text:"Talep, teknisyen ataması ve müşteri onayı."},
 {href:"/sektorler/bakim-onarim",title:"Bakım ve onarım",text:"Ekipman, bakım takvimi ve kontrol listesi."},
 {href:"/sektorler/muhendislik-taahhut",title:"Mühendislik ve taahhüt",text:"Proje, saha raporu ve teslim takibi."},
 {href:"/platform",title:"Tüm platform",text:"İş akışları, belgeler ve finansal görünüm."},
];
export default function HomeLanding(){
 const[authenticated,setAuthenticated]=useState(false);
 useEffect(()=>{let active=true;fetch('/api/auth/status',{cache:'no-store'}).then(r=>r.json()).then(r=>{if(active)setAuthenticated(Boolean(r.authenticated))}).catch(()=>{});return()=>{active=false}},[]);
 const login=authenticated?'/panel':'/giris';
 return <main className="site-shell home-v2">
  <header className="site-header">
   <Link className="brand-link" href="/" aria-label="Teksanor ana sayfa"><img src="/assets/teksanor-logo.webp" alt="Teksanor" className="header-logo"/></Link>
   <nav className="desktop-nav" aria-label="Ana menü"><Link href="/platform">Platform</Link><Link href="/sektorler">Sektörler</Link><Link href="/guven">Güven</Link><Link href="/pilot">Pilot</Link><Link href="/en" hrefLang="en">English</Link></nav>
   <details className="public-mobile-menu"><summary>Menü</summary><nav aria-label="Mobil menü"><Link href="/platform">Platform</Link><Link href="/sektorler">Sektörler</Link><Link href="/guven">Güven merkezi</Link><Link href="/icerikler">İçgörüler</Link><Link href="/en" hrefLang="en">English</Link></nav></details>
   <Link className="login-link" href={login}><UserRound aria-hidden="true" size={18}/><span>{authenticated?'Paneli aç':'Giriş yap'}</span></Link>
  </header>
  <section className="home-hero" aria-labelledby="home-title">
   <div><span className="section-kicker">Teknik servis · Bakım · Mühendislik</span><h1 id="home-title">Sahadaki işi,<br/><span>merkezdeki karara bağlayın.</span></h1><p>Teklif → iş emri → müşteri onayı → tahsilat, tek kayıtta. Ekibiniz ne yapacağını, siz işin nerede kaldığını görün.</p><div className="home-actions"><Link className="home-primary" href="/pilot">Pilot başvurusu yap <ArrowRight aria-hidden="true" size={18}/></Link><Link className="home-secondary" href="/platform">Platformu incele</Link></div></div>
   <img src="/assets/teksanor-field-operations.svg" alt="Saha operasyonunu merkezden yöneten mühendislik ekibi" width="560" height="360"/>
  </section>
  <section className="home-block" aria-labelledby="benefits-title"><span className="section-kicker">Neden Teksanor?</span><h2 id="benefits-title">Teklif, saha ve tahsilat aynı kayıt zincirinde.</h2><div className="home-benefits">
   <article><Workflow aria-hidden="true"/><h3>Sürümlü müşteri onayı</h3><p>Teklif ve servis raporu onayını aynı işte izleyin. Kayıt değişirse eski onay bağlantısı geçersiz olur.</p></article>
   <article><Factory aria-hidden="true"/><h3>Ekipman ve bakım birlikte</h3><p>Firmanıza ait ekipman türlerini, kontrol listelerini ve periyodik bakım planlarını tanımlayın.</p></article>
   <article><ShieldCheck aria-hidden="true"/><h3>Firma ve rol ayrımı</h3><p>Her firma kendi verisini görür. Teknisyen kendisine atanan işleri, yönetici ekibin durumunu takip eder.</p></article>
  </div></section>
  <section className="home-block home-workflow" aria-labelledby="workflow-title"><div><span className="section-kicker">Örnek iş akışı</span><h2 id="workflow-title">Bir pompa bakımı nasıl ilerler?</h2><p>Talep kaydı, saha kontrolü, müşteri onayı ve tahsilatı aynı iş emrinde takip edin.</p><Link href="/platform">İş akışlarını incele <ArrowRight aria-hidden="true" size={16}/></Link></div><article aria-label="Örnek servis işi"><span className="section-kicker">Kurgusal örnek · SRV-1024</span><h3>Pompa bakımı</h3><p>Teknik servis · Ekip A</p><ol><li><CheckCircle2 aria-hidden="true" size={18}/> Talep kaydı</li><li><CheckCircle2 aria-hidden="true" size={18}/> Saha kontrol listesi</li><li>Müşteri onayı bekleniyor</li><li>Tahsilat takibi</li></ol></article></section>
  <section className="home-block" aria-labelledby="sectors-title"><span className="section-kicker">Çalışma alanları</span><h2 id="sectors-title">İşinize uygun akışı seçin.</h2><div className="home-sectors">{sectors.map(s=><Link key={s.href} href={s.href}><h3>{s.title}</h3><p>{s.text}</p><span>İncele <ArrowRight aria-hidden="true" size={16}/></span></Link>)}</div></section>
  <section className="home-block home-pilot" aria-labelledby="pilot-title"><div><span className="section-kicker">Kurumsal pilot</span><h2 id="pilot-title">Kendi iş akışınızla değerlendirin.</h2><p>Pilotun kapsamını ve başarı ölçütlerini birlikte belirleyin. Çalışan özelliklerle planlanan entegrasyonları <Link href="/kurumsal-durum">ürün durumu</Link> sayfasında ayrı inceleyin.</p></div><Link className="home-secondary" href="/pilot">Pilot başvurusu yap <ArrowRight aria-hidden="true" size={18}/></Link></section>
  <footer className="site-footer"><div><img src="/assets/teksanor-logo.webp" alt="Teksanor"/><p>Saha servis, bakım ve operasyon yönetimi.</p></div><nav aria-label="Alt menü"><Link href="/icerikler">İçgörüler</Link><Link href="/yapay-zeka-hizmeti">Yapay zekâ asistanı nasıl çalışır?</Link><Link href="/entegrasyonlar">Entegrasyonlar</Link><Link href="/guven">Güven merkezi</Link><Link href="/gizlilik">Gizlilik</Link><Link href="/aydinlatma">Aydınlatma</Link><Link href="/cerezler">Çerezler</Link><Link href={login}>{authenticated?'Paneli aç':'Giriş yap'}</Link></nav><div className="footer-end">© 2026 Teksanor · Geliştiren: <a href="https://github.com/ekremalann-sketch" target="_blank" rel="noopener noreferrer">Ekrem Alan</a></div></footer>
 </main>;
}
