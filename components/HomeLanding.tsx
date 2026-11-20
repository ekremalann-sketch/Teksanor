"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {ArrowRight,CheckCircle2,UserRound,Wrench,Package,Wallet,Smartphone,ClipboardCheck,QrCode,FileSignature,ShieldCheck,Activity} from "lucide-react";
import "./home-servis.css";

// Ana sayfa (20 Kasım): eski sürümün koyu lacivert + altın kurumsal kimliği geri geldi; güncel sürümün somut
// servis kaydı görünümü ve 5 adımlı akışı korundu. Tek baskın düğme "Ücretsiz hesap aç". Yalnız kodda çalışan
// özellikler anlatılır; tablo, 8 soru ve uzun listeler kaldırıldı (sayfa ~%60 kısaldı).
const features=[
 {icon:Wrench,title:"Servis kaydı",text:"Müşteri, adres, cihaz ve arıza tek kayıtta. Kayıtlı müşterinin bilgisi yeniden yazılmaz."},
 {icon:FileSignature,title:"Teklif ve müşteri onayı",text:"Parça ve işçilik kalemleriyle teklif. Müşteri gelen bağlantıdan telefonunda onaylar ya da gerekçesiyle reddeder."},
 {icon:Smartphone,title:"Teknisyen telefonda",text:"Teknisyen yalnız kendi işlerini görür; işe başlar, kontrol listesini doldurur, yerinde imza alır."},
 {icon:Package,title:"Parça ve stok",text:"Kullanılan parça stoktan düşer, artan depoya döner; kritik seviyedeki parça listede uyarır."},
 {icon:Wallet,title:"Tahsilat ve kalan borç",text:"Kapora ve ara ödemeler ayrı satır. İade ve iptal gerekçe ister; eski kayıt silinmez."},
 {icon:QrCode,title:"Ekipman ve müşteri takibi",text:"Cihazı QR etiketiyle kaydedin; müşteri işinin durumunu takip bağlantısından görür."},
];
const flow=[
 ["Talep","Servis kaydını açar, teknisyeni seçersiniz."],
 ["Teklif","Kalemleri girersiniz; toplamı sistem hesaplar."],
 ["Onay","Müşteri bağlantıdan telefonunda onaylar."],
 ["Saha","Teknisyen işi yapar, parçayı ve imzayı kaydeder."],
 ["Tahsilat","Kalan borç sıfırlanınca iş kapanır."],
];
const faq=[
 ["Kurulum gerekiyor mu?","Hayır. Tarayıcıdan çalışır; telefonda ana ekrana eklenebilir."],
 ["Teknisyenlerim ne görür?","Yalnız kendilerine atanan işleri. Maliyet, kasa ve diğer teknisyenlerin işleri görünmez."],
 ["e-Fatura kesiyor mu?","Hayır. Tamamlanan işin özetini muhasebe programınıza aktarmak için dışa aktarırsınız."],
 ["Ücret ne kadar?","Pilot döneminde ücretsizdir. Ücretli pakete geçmeden önce fiyat yazılı bildirilir; kendiliğinden ücretlendirme yapılmaz."],
];

export default function HomeLanding(){
 const[authenticated,setAuthenticated]=useState(false);
 useEffect(()=>{let active=true;fetch('/api/auth/status',{cache:'no-store'}).then(r=>r.json()).then(r=>{if(active)setAuthenticated(Boolean(r.authenticated))}).catch(()=>{});return()=>{active=false}},[]);
 const login=authenticated?'/panel':'/giris';
 return <main className="tk">
  <div className="tk-dark">
   <header className="tk-top">
    <Link href="/" aria-label="Teksanor ana sayfa"><img src="/assets/teksanor-logo.webp" alt="Teksanor" className="tk-logo"/></Link>
    <nav aria-label="Ana menü" className="tk-nav"><a href="#ozellikler">Özellikler</a><a href="#nasil">Nasıl çalışır</a><Link href="/guven">Güven</Link><Link href="/durum">Hizmet durumu</Link></nav>
    <Link className="tk-login" href={login}><UserRound aria-hidden="true" size={18}/>{authenticated?'Paneli aç':'Giriş yap'}</Link>
   </header>
   <section className="tk-hero" aria-labelledby="tk-title">
    <div>
     <span className="tk-kicker">Teknik servis · Bakım · Saha</span>
     <h1 id="tk-title">Servis işini talepten tahsilata,<br/><span>tek kayıtta yönetin.</span></h1>
     <p>Teklif, müşteri onayı, teknisyen, parça ve ödeme aynı dosyada. Hangi işin kimde ve hangi adımda olduğunu her an görürsünüz.</p>
     <Link className="tk-primary" href={authenticated?'/panel':'/giris#kayit'}>{authenticated?'Paneli aç':'Ücretsiz hesap aç'} <ArrowRight aria-hidden="true" size={18}/></Link>
     <ul className="tk-notes"><li><CheckCircle2 aria-hidden="true" size={16}/>Kurulum yok</li><li><CheckCircle2 aria-hidden="true" size={16}/>Kredi kartı istenmez</li><li><CheckCircle2 aria-hidden="true" size={16}/>Telefonda tam kullanım</li></ul>
    </div>
    <article className="tk-ticket" aria-label="Servis dosyası ekranı (kurgusal kayıt)">
     <header><span>SRV-2026-0142</span><b>Teknisyende</b></header>
     <h3>Salon kliması yıllık bakım</h3>
     <p className="tk-muted">Merkez Mah. · Sorumlu: Teknisyen Ali</p>
     <table><tbody><tr><td>Filtre seti × 1</td><td>650 ₺</td></tr><tr><td>Gaz kontrolü × 1</td><td>400 ₺</td></tr><tr><td>İşçilik × 1</td><td>950 ₺</td></tr></tbody><tfoot><tr><td>Toplam</td><td>2.000 ₺</td></tr></tfoot></table>
     <ol className="tk-steps"><li className="ok">Teklif onaylandı</li><li className="ok">Kapora 500 ₺</li><li className="now">Sırada: sahada iş</li><li>Kalan 1.500 ₺</li></ol>
     <small className="tk-muted">Ürün ekranı · kurgusal kayıt</small>
    </article>
   </section>
  </div>

  <section className="tk-sec" id="nasil" aria-labelledby="tk-flow">
   <span className="tk-kicker tk-kicker-d">Nasıl çalışır</span>
   <h2 id="tk-flow">Bir servis işi beş adımda kapanır.</h2>
   <ol className="tk-flow">{flow.map(([t,d],i)=><li key={t}><span className="tk-num">{i+1}</span><h3>{t}</h3><p>{d}</p></li>)}</ol>
  </section>

  <section className="tk-sec tk-alt" id="ozellikler" aria-labelledby="tk-features">
   <span className="tk-kicker tk-kicker-d">Özellikler</span>
   <h2 id="tk-features">Servis işletmesinin günlük işi, tek programda.</h2>
   <div className="tk-grid">{features.map(f=><div className="tk-card" key={f.title}><f.icon aria-hidden="true" size={22} className="tk-icon"/><h3>{f.title}</h3><p>{f.text}</p></div>)}</div>
  </section>

  <section className="tk-sec tk-split" aria-labelledby="tk-field">
   <div>
    <span className="tk-kicker tk-kicker-d">Sahada ve merkezde</span>
    <h2 id="tk-field">Teknisyen sahada, siz merkezde aynı dosyayı görürsünüz.</h2>
    <ul className="tk-checks">
     <li><CheckCircle2 aria-hidden="true" size={18}/>Teknisyenin telefonuna o günün işleri sıralı gelir.</li>
     <li><CheckCircle2 aria-hidden="true" size={18}/>Zorunlu kontrol maddesi doldurulmadan iş kapanmaz.</li>
     <li><CheckCircle2 aria-hidden="true" size={18}/>Teklifi aşan tahsilat girilemez; her ödemenin kim tarafından alındığı görünür.</li>
    </ul>
   </div>
   <div className="tk-phone" aria-label="Teknisyen ekranı (kurgusal kayıt)">
    <b>Bugün · 3 iş</b>
    <div className="tk-job"><span>09:30</span><p>Kombi bakımı<br/><small>Yeni Mah.</small></p></div>
    <div className="tk-job tk-job-on"><span>11:00</span><p>Klima gaz dolumu<br/><small>Çarşı Cad.</small></p></div>
    <div className="tk-job"><span>14:30</span><p>Su arıtma filtre<br/><small>Bahçe Sok.</small></p></div>
   </div>
  </section>

  <section className="tk-sec tk-alt" aria-labelledby="tk-trust">
   <span className="tk-kicker tk-kicker-d">Güven</span>
   <h2 id="tk-trust">Verinizin nerede ve nasıl korunduğunu açıkça gösteriyoruz.</h2>
   <div className="tk-trust">
    <Link href="/guvenlik"><ShieldCheck aria-hidden="true" size={20}/><b>Güvenlik</b><span>Firma bazlı veri ayrımı, iki aşamalı giriş, açık bildirme adresi.</span></Link>
    <Link href="/durum"><Activity aria-hidden="true" size={20}/><b>Hizmet durumu</b><span>Anlık durum ve son 90 günün yoklama kaydı.</span></Link>
    <Link href="/kurumsal-durum"><ClipboardCheck aria-hidden="true" size={20}/><b>Ürün durumu</b><span>Çalışan, bağlantıyla açılan ve planlanan özellikler ayrı.</span></Link>
   </div>
  </section>

  <section className="tk-sec" id="sss" aria-labelledby="tk-faq">
   <span className="tk-kicker tk-kicker-d">Sorular</span>
   <h2 id="tk-faq">Sık sorulanlar</h2>
   <div className="tk-faq">{faq.map(([q,a])=><details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div>
  </section>

  <section className="tk-end" aria-labelledby="tk-end">
   <h2 id="tk-end">Servis işlerinizi bugün tek kayda toplayın.</h2>
   <Link className="tk-primary" href={authenticated?'/panel':'/giris#kayit'}>{authenticated?'Paneli aç':'Ücretsiz hesap aç'} <ArrowRight aria-hidden="true" size={18}/></Link>
  </section>

  <footer className="tk-foot">
   <div><img src="/assets/teksanor-logo.webp" alt="Teksanor" className="tk-logo"/><p>Teknik servis, bakım ve saha operasyonu.</p></div>
   <nav aria-label="Alt menü"><Link href="/hakkimizda">Hakkımızda</Link><Link href="/yardim">Yardım</Link><Link href="/guven">Güven merkezi</Link><Link href="/gizlilik">Gizlilik</Link><Link href="/aydinlatma">Aydınlatma</Link><Link href="/cerezler">Çerezler</Link><Link href={login}>{authenticated?'Paneli aç':'Giriş yap'}</Link></nav>
   <small>© 2026 Teksanor</small>
  </footer>
 </main>;
}
