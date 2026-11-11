"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {ArrowRight,CheckCircle2,UserRound,Wrench,Package,Wallet,Smartphone,ClipboardCheck,CalendarClock,QrCode,FileSignature,BarChart3,Users,MessageCircle} from "lucide-react";
import "./home-servis.css";

// Ana sayfa: teknik servis işletmesine "ne işe yarar, nasıl çalışır, nasıl başlarım" sorularını sırayla yanıtlar.
// Yalnız kodda çalışan özellikler anlatılır; planlanan özellikler "Yakında" olarak ayrı gösterilir.
const features=[
 {icon:Wrench,title:"Servis kaydı",text:"Müşteri, adres, cihaz ve arıza tek kayıtta. Kayıtlı müşterinin bilgileri yeniden yazılmaz."},
 {icon:FileSignature,title:"Teklif ve müşteri onayı",text:"Parça ve işçilik kalemleriyle teklif hazırlayın. Müşteri WhatsApp'tan gelen bağlantıyla telefonundan onaylar veya gerekçesiyle reddeder."},
 {icon:Smartphone,title:"Teknisyen telefonda",text:"Teknisyen yalnız kendi işlerini görür; işe başlar, not yazar, kontrol listesini doldurur, müşteriye yerinde imza attırır."},
 {icon:Package,title:"Parça ve stok",text:"Parçayı işe ayırın; kullanılan stoktan düşer, artan depoya geri döner. Stok eksiye inmez."},
 {icon:Wallet,title:"Tahsilat ve kalan borç",text:"Kapora ve ara ödemeleri ayrı ayrı kaydedin. Nakit, kart, havale ayrımı; iade ve iptal gerekçeli, eski kayıt silinmez."},
 {icon:CalendarClock,title:"Planlama ve ziyaret",text:"İşleri teknisyenlere ve günlere dağıtın. Parça bekleyen işe ikinci ziyareti aynı dosyada açın."},
 {icon:ClipboardCheck,title:"Kontrol listeleri",text:"Klima bakımı, kombi kontrolü gibi şablonlar. Zorunlu madde doldurulmadan iş kapanmaz."},
 {icon:QrCode,title:"Ekipman ve bakım",text:"Müşteri cihazını seri numarası ve QR etiketiyle kaydedin, bakım tarihi gelen cihazı listede görün."},
 {icon:BarChart3,title:"Günlük özet",text:"Bugünkü, geciken ve onay bekleyen işler ilk ekranda. Tahsil edilen ve kalan tutar her işte görünür."},
];
const flow=[
 ["Talep","Müşteri arar; servis kaydını açıp teknisyeni seçersiniz."],
 ["Teklif","Parça ve işçilik kalemlerini girersiniz, toplamı sistem hesaplar."],
 ["Onay","Teklif bağlantısı WhatsApp ile gider, müşteri telefondan onaylar."],
 ["Saha","Teknisyen işi telefonunda görür, parçayı kullanır, imzayı alır."],
 ["Tahsilat","Ödemeleri girersiniz; kalan borç sıfırlanınca iş kapanır."],
];
const compare=[
 ["İşin hangi aşamada olduğu","Kimin aklında, o bilir","Her işte tek durum ve sıradaki adım"],
 ["Müşteri onayı","Telefonda sözlü","İmzalı ve tarihli onay kaydı"],
 ["Kullanılan parça","Fişte ya da hiç","Stoktan düşer, işe yazılır"],
 ["Kalan alacak","Defterde, hesap gerekir","Her işte ve müşteride otomatik"],
 ["Teknisyenin günü","Sabah telefonla anlatılır","Telefonunda sıralı iş listesi"],
 ["Geçmiş servisler","Eski mesajlarda aranır","Müşteri ve cihaz geçmişi tek ekranda"],
 ["Yetki","Herkes her şeyi görür","Teknisyen yalnız kendi işini görür"],
];
const sectors=["Klima ve iklimlendirme","Kombi ve kazan","Beyaz eşya","Asansör bakımı","Jeneratör ve elektrik","Su arıtma","Güvenlik ve kamera","Endüstriyel bakım"];
const checklist=[
 "Teknisyen işini telefondan, uygulama kurmadan görebiliyor mu?",
 "Müşteri teklifi imzalı olarak onaylayabiliyor mu?",
 "Kullanılan parça stoktan kendiliğinden düşüyor mu?",
 "Parçalı ödeme ve kalan borç takip ediliyor mu?",
 "Teknisyen başkasının işini ve maliyetleri görmeden çalışabiliyor mu?",
 "Verilerinizi istediğiniz an dışa aktarabiliyor musunuz?",
 "Firmanızın verisi başka firmalardan ayrı tutuluyor mu?",
 "Kurulum, sunucu ve teknik bilgi gerekmeden başlayabiliyor musunuz?",
];
const faq=[
 ["Teksanor nedir?","Teknik servis ve bakım işletmeleri için web tabanlı servis takip programıdır. Talep, teklif, müşteri onayı, teknisyen, parça ve tahsilatı tek kayıtta toplar."],
 ["Kurulum gerekiyor mu?","Hayır. Tarayıcıdan çalışır; telefonda ana ekrana eklenebilir. Bilgisayara veya sunucuya kurulum yapılmaz."],
 ["Teknisyenlerim ne görür?","Yalnız kendilerine atanan işleri. Maliyetleri, kasa toplamlarını ve diğer teknisyenlerin işlerini göremezler."],
 ["Müşteri onayı nasıl alınır?","Teklif hazırlanınca tek tıkla bir bağlantı oluşur ve WhatsApp ya da e-postayla gönderilir. Müşteri adını yazıp imza atarak onaylar veya gerekçesiyle reddeder."],
 ["Stok takibi var mı?","Evet. Parçayı işe ayırırsınız; kullanılan miktar stoktan düşer, kullanılmayan depoya iade edilir. Aynı işlem iki kez kaydedilmez."],
 ["Kapora ve parçalı ödeme alınabiliyor mu?","Evet. Her ödeme ayrı hareket olarak tutulur; teklif tutarı aşılamaz. İade ve hatalı kaydın iptali gerekçe ister ve eski kayıt silinmez."],
 ["İnternet olmayan yerde çalışır mı?","Teknisyenin yazdığı not cihazında taslak olarak saklanır. Tam çevrimdışı çalışma geliştirme aşamasındadır."],
 ["Otomatik SMS gönderiyor mu?","Henüz hayır. Bugün müşteriye bağlantıyı WhatsApp veya e-postayla tek tıkla gönderirsiniz. Otomatik bildirim yol haritasında."],
 ["e-Fatura kesiyor mu?","Teksanor fatura kesmez. Tamamlanan işin özetini muhasebe programınıza aktarmak için dışa aktarabilirsiniz."],
 ["Verilerim güvende mi?","Her firmanın verisi ayrı tutulur, parolalar şifreli saklanır, yöneticiler için iki aşamalı giriş vardır. Ayrıntılar Güven sayfasında."],
 ["Ücret ne kadar?","Pilot döneminde ücretsizdir. Ücretli pakete geçmeden önce fiyat yazılı olarak bildirilir; kendiliğinden ücretlendirme yapılmaz."],
];
const soon=["Otomatik SMS ve WhatsApp bildirimi","Müşteri servis takip sayfası (QR fiş)","Gün sonu kasa ve teknisyen bazlı tahsilat raporu","Kritik stok uyarısı","Tam çevrimdışı saha kaydı"];

export default function HomeLanding(){
 const[authenticated,setAuthenticated]=useState(false);
 useEffect(()=>{let active=true;fetch('/api/auth/status',{cache:'no-store'}).then(r=>r.json()).then(r=>{if(active)setAuthenticated(Boolean(r.authenticated))}).catch(()=>{});return()=>{active=false}},[]);
 const login=authenticated?'/panel':'/giris';
 return <main className="hs">
  <header className="hs-top">
   <Link href="/" aria-label="Teksanor ana sayfa"><img src="/assets/teksanor-logo.webp" alt="Teksanor" className="hs-logo"/></Link>
   <nav aria-label="Ana menü" className="hs-nav"><a href="#ozellikler">Özellikler</a><a href="#nasil">Nasıl çalışır</a><a href="#fiyat">Fiyat</a><a href="#sss">Sorular</a></nav>
   <div className="hs-top-actions"><Link className="hs-ghost" href={login}><UserRound aria-hidden="true" size={18}/>{authenticated?'Paneli aç':'Giriş'}</Link><Link className="hs-btn" href="/giris#kayit">Ücretsiz dene</Link></div>
  </header>

  <section className="hs-hero" aria-labelledby="hs-title">
   <div>
    <span className="hs-kicker">Teknik servis programı</span>
    <h1 id="hs-title">Servis işlerinizi talepten tahsilata tek ekrandan yönetin.</h1>
    <p>Teklif, müşteri onayı, teknisyen, parça ve ödeme aynı kayıtta. Hangi işin nerede kaldığını, kimin ne kadar borcu olduğunu her an görürsünüz.</p>
    <div className="hs-actions"><Link className="hs-btn hs-btn-lg" href="/giris#kayit">Ücretsiz hesap aç <ArrowRight aria-hidden="true" size={18}/></Link><a className="hs-ghost hs-btn-lg" href="#nasil">Nasıl çalıştığını gör</a></div>
    <ul className="hs-notes"><li><CheckCircle2 aria-hidden="true" size={16}/>Kurulum yok, tarayıcıdan çalışır</li><li><CheckCircle2 aria-hidden="true" size={16}/>Kredi kartı istenmez</li><li><CheckCircle2 aria-hidden="true" size={16}/>Telefonda da tam kullanım</li></ul>
   </div>
   <article className="hs-ticket" aria-label="Örnek servis kaydı (kurgusal)">
    <header><span>SRV-2026-0142</span><b className="hs-tag">Teknisyende</b></header>
    <h3>Salon kliması yıllık bakım</h3>
    <p className="hs-muted">Örnek Müşteri · Merkez Mah. · Teknisyen: Ali</p>
    <table><tbody><tr><td>Filtre seti × 1</td><td>650 ₺</td></tr><tr><td>Gaz kontrolü × 1</td><td>400 ₺</td></tr><tr><td>İşçilik × 1</td><td>950 ₺</td></tr></tbody><tfoot><tr><td>Toplam</td><td>2.000 ₺</td></tr></tfoot></table>
    <ol className="hs-mini-steps"><li className="ok">Teklif onaylandı</li><li className="ok">Kapora 500 ₺</li><li>İş sahada</li><li>Kalan 1.500 ₺</li></ol>
    <small className="hs-muted">Kurgusal örnek kayıt</small>
   </article>
  </section>

  <section className="hs-band" aria-label="Kısaca">
   <p><b>Kısaca:</b> Teksanor; servis kaydı, kalem bazlı teklif, müşteri onay bağlantısı, teknisyen ekranı, planlama, kontrol listeleri, parça ve stok, parçalı tahsilat ve ekipman geçmişini tek programda toplar. Pilot döneminde ücretsizdir.</p>
  </section>

  <section className="hs-sec" aria-labelledby="hs-problem">
   <span className="hs-kicker">Tanıdık geldi mi?</span>
   <h2 id="hs-problem">Defter, Excel ve WhatsApp ile servis yönetmek zor.</h2>
   <div className="hs-grid3">
    <div className="hs-card"><h3>İş kayboluyor</h3><p>Hangi cihaz ne zaman geldi, kime verildi, parça bekliyor mu? Bilgi mesajlar arasında dağılıyor.</p></div>
    <div className="hs-card"><h3>Para kaçıyor</h3><p>Kullanılan parça faturaya yazılmıyor, kaporası alınan iş unutuluyor, kalan alacak defterde kalıyor.</p></div>
    <div className="hs-card"><h3>Müşteri arıyor</h3><p>"Cihazım ne durumda?" sorusuna cevap için teknisyeni aramanız gerekiyor. Sözlü onaylar sonradan tartışma çıkarıyor.</p></div>
   </div>
  </section>

  <section className="hs-sec" id="ozellikler" aria-labelledby="hs-features">
   <span className="hs-kicker">Özellikler</span>
   <h2 id="hs-features">Bir servis işletmesinin ihtiyacı olan her şey</h2>
   <div className="hs-grid3">{features.map(f=><div className="hs-card" key={f.title}><f.icon aria-hidden="true" size={24} className="hs-icon"/><h3>{f.title}</h3><p>{f.text}</p></div>)}</div>
  </section>

  <section className="hs-sec hs-alt" id="nasil" aria-labelledby="hs-flow">
   <span className="hs-kicker">Nasıl çalışır</span>
   <h2 id="hs-flow">Bir servis işinin baştan sona yolculuğu</h2>
   <ol className="hs-flow">{flow.map(([t,d],i)=><li key={t}><span className="hs-num">{i+1}</span><h3>{t}</h3><p>{d}</p></li>)}</ol>
  </section>

  <section className="hs-sec hs-split" aria-labelledby="hs-field">
   <div>
    <span className="hs-kicker">Yerinde servis</span>
    <h2 id="hs-field">Teknisyen sahada, siz merkezde aynı bilgiyi görürsünüz</h2>
    <ul className="hs-checks">
     <li><CheckCircle2 aria-hidden="true" size={18}/>Sabah telefonunda o günün işleri sıralı gelir.</li>
     <li><CheckCircle2 aria-hidden="true" size={18}/>Adres, müşteri ve cihaz bilgisi tek dokunuşla açılır.</li>
     <li><CheckCircle2 aria-hidden="true" size={18}/>Kontrol listesi ve not; notu sesle de yazabilir.</li>
     <li><CheckCircle2 aria-hidden="true" size={18}/>Kullandığı parçayı işe kaydeder, artanı iade eder.</li>
     <li><CheckCircle2 aria-hidden="true" size={18}/>Müşteriye yerinde imza attırır; iş "tamamlandı" olur.</li>
    </ul>
   </div>
   <div className="hs-phone" aria-label="Teknisyen ekranı örneği (kurgusal)">
    <b>Bugün · 3 iş</b>
    <div className="hs-job"><span>09:30</span><p>Kombi bakımı<br/><small>Yeni Mah. 12/4</small></p></div>
    <div className="hs-job hs-job-on"><span>11:00</span><p>Klima gaz dolumu<br/><small>Çarşı Cad. 5</small></p></div>
    <div className="hs-job"><span>14:30</span><p>Su arıtma filtre<br/><small>Bahçe Sok. 8</small></p></div>
   </div>
  </section>

  <section className="hs-sec hs-alt hs-split" aria-labelledby="hs-money">
   <div className="hs-cash" aria-label="Tahsilat özeti örneği (kurgusal)">
    <b>Bugünkü tahsilat</b>
    <dl><div><dt>Nakit</dt><dd>3.250 ₺</dd></div><div><dt>Kart</dt><dd>4.800 ₺</dd></div><div><dt>Havale</dt><dd>2.000 ₺</dd></div><div className="hs-total"><dt>Toplam</dt><dd>10.050 ₺</dd></div></dl>
    <small>Açık alacak: 7 iş · 12.400 ₺</small>
   </div>
   <div>
    <span className="hs-kicker">Tahsilat</span>
    <h2 id="hs-money">Kim ne ödedi, kimde ne kadar kaldı?</h2>
    <p>Kapora, ara ödeme ve kalan tutar her işte ayrı satır. Teklif tutarını aşan tahsilat girilemez; iade ve yanlış kaydın iptali gerekçe ister ve geçmiş silinmez. Yönetici her ödemenin kim tarafından, hangi yöntemle alındığını görür.</p>
   </div>
  </section>

  <section className="hs-sec" aria-labelledby="hs-compare">
   <span className="hs-kicker">Karşılaştırma</span>
   <h2 id="hs-compare">Defter ve mesajlaşma ile Teksanor arasındaki fark</h2>
   <div className="hs-table-wrap"><table className="hs-table"><thead><tr><th>Konu</th><th>Defter / Excel / WhatsApp</th><th>Teksanor</th></tr></thead><tbody>{compare.map(([a,b,c])=><tr key={a}><td>{a}</td><td>{b}</td><td><CheckCircle2 aria-hidden="true" size={16}/> {c}</td></tr>)}</tbody></table></div>
  </section>

  <section className="hs-sec hs-alt" aria-labelledby="hs-sectors">
   <span className="hs-kicker">Kimler için</span>
   <h2 id="hs-sectors">Sahada veya dükkânda servis veren işletmeler</h2>
   <ul className="hs-chips">{sectors.map(s=><li key={s}>{s}</li>)}</ul>
   <p className="hs-muted">2 ile 30 teknisyen arasındaki ekipler için tasarlandı. Listede olmayan cihaz ve iş türlerini serbestçe tanımlayabilirsiniz.</p>
  </section>

  <section className="hs-sec" aria-labelledby="hs-check">
   <span className="hs-kicker">Seçmeden önce</span>
   <h2 id="hs-check">Bir servis programında sormanız gereken 8 soru</h2>
   <ol className="hs-qlist">{checklist.map(q=><li key={q}>{q}</li>)}</ol>
   <p className="hs-muted">Teksanor'da sekizinin de cevabı evet.</p>
  </section>

  <section className="hs-sec hs-alt" aria-labelledby="hs-start">
   <span className="hs-kicker">Başlangıç</span>
   <h2 id="hs-start">10 dakikada ilk işinizi açın</h2>
   <ol className="hs-flow hs-flow4">
    <li><span className="hs-num"><Users aria-hidden="true" size={18}/></span><h3>Hesap açın</h3><p>Firma adınızla kaydolun; isterseniz örnek verilerle başlayın.</p></li>
    <li><span className="hs-num">2</span><h3>Ekibi ekleyin</h3><p>Teknisyenleri davet edin; her biri kendi telefonundan girer.</p></li>
    <li><span className="hs-num">3</span><h3>İlk servisi açın</h3><p>Müşteriyi ve arızayı yazın, teknisyeni seçin, teklifi gönderin.</p></li>
    <li><span className="hs-num">4</span><h3>Kapatın</h3><p>Parça, imza ve tahsilat girilince iş kapanır; günün özeti hazır.</p></li>
   </ol>
  </section>

  <section className="hs-sec hs-price" id="fiyat" aria-labelledby="hs-price">
   <div>
    <span className="hs-kicker">Fiyat</span>
    <h2 id="hs-price">Pilot döneminde ücretsiz</h2>
    <p>Tüm özellikler açık, kullanıcı ve servis kaydı sınırı yok. Ücretli pakete geçmeden önce fiyat size yazılı bildirilir; onayınız olmadan ücretlendirme yapılmaz ve verileriniz silinmez.</p>
    <div className="hs-actions"><Link className="hs-btn hs-btn-lg" href="/giris#kayit">Ücretsiz hesap aç</Link><Link className="hs-ghost hs-btn-lg" href="/pilot"><MessageCircle aria-hidden="true" size={18}/>Bizimle görüşün</Link></div>
   </div>
   <div className="hs-card">
    <h3>Yol haritası (yakında)</h3>
    <ul className="hs-soon">{soon.map(s=><li key={s}>{s}</li>)}</ul>
    <small className="hs-muted">Bu maddeler henüz kullanımda değildir.</small>
   </div>
  </section>

  <section className="hs-sec" id="sss" aria-labelledby="hs-faq">
   <span className="hs-kicker">Sık sorulan sorular</span>
   <h2 id="hs-faq">Merak edilenler</h2>
   <div className="hs-faq">{faq.map(([q,a])=><details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div>
  </section>

  <section className="hs-cta" aria-labelledby="hs-cta">
   <h2 id="hs-cta">Servisinizi bugün düzene sokun.</h2>
   <p>Kurulum yok, kart yok. İlk işinizi 10 dakikada açın.</p>
   <Link className="hs-btn hs-btn-lg hs-btn-light" href="/giris#kayit">Ücretsiz hesap aç <ArrowRight aria-hidden="true" size={18}/></Link>
  </section>

  <footer className="hs-foot">
   <div><img src="/assets/teksanor-logo.webp" alt="Teksanor" className="hs-logo"/><p>Teknik servis ve bakım işletmeleri için servis takip programı.</p></div>
   <nav aria-label="Ürün"><b>Ürün</b><a href="#ozellikler">Özellikler</a><a href="#nasil">Nasıl çalışır</a><a href="#fiyat">Fiyat</a><Link href="/yardim">Yardım</Link></nav>
   <nav aria-label="Kurumsal"><b>Kurumsal</b><Link href="/hakkimizda">Hakkımızda</Link><Link href="/guven">Güven ve güvenlik</Link><Link href="/pilot">İletişim</Link></nav>
   <nav aria-label="Yasal"><b>Yasal</b><Link href="/gizlilik">Gizlilik</Link><Link href="/aydinlatma">KVKK aydınlatma</Link><Link href="/cerezler">Çerezler</Link></nav>
  </footer>
 </main>;
}
