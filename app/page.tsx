import Link from "next/link";
import "./corporate-home.css";

const areas = [["Talep ve teklif","İşi açın. Parça ve işçilik kalemlerini teklif sürümüne ekleyin."],["Onay ve saha","Müşteriye onay bağlantısı gönderin. Teknisyeni ve ziyareti planlayın."],["Tahsilat","Ayrı ödeme ve iade hareketlerini kaydedin. İşin kalan tutarını görün."]];

export default function Home() {
  return <main className="corporate-home">
    <header className="corporate-home__bar"><Link href="/">Teksanor</Link><nav aria-label="Kurumsal bağlantılar"><Link href="/guven">Güvenlik</Link><Link href="/durum">Hizmet durumu</Link></nav></header>
    <section className="corporate-home__hero" aria-labelledby="home-title">
      <p className="corporate-home__label">Teknik servis ve saha operasyonu</p>
      <h1 id="home-title">Servis işlerini talepten tahsilata yönetin.</h1>
      <p>Talebi kaydedin, teklif hazırlayın, müşteri onayını alın. Teknisyen sahada işi tamamlarken ekip kalan tahsilatı aynı servis dosyasından izler.</p>
      <Link className="corporate-home__action" href="/giris">Servis masasına giriş</Link>
    </section>
    <section aria-labelledby="home-areas" className="corporate-home__body">
      <h2 id="home-areas">Servis işinin adımları</h2>
      <div className="corporate-home__grid">{areas.map(([name, detail]) => <article key={name}><h3>{name}</h3><p>{detail}</p></article>)}</div>
      
    </section>
    <footer className="corporate-home__bar"><span>© Teksanor</span><Link href="/guven">Güvenlik</Link><Link href="/durum">Hizmet durumu</Link></footer>
  </main>;
}
