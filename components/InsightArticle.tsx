import type { AnchorHTMLAttributes } from "react";
import { ArrowLeft, ArrowRight, Clock3, ShieldCheck } from "lucide-react";

function Link({ href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return <a href={href} {...props} />;
}

type Section = { title: string; paragraphs: string[] };
type Article = {
  category: string;
  title: string;
  lead: string;
  image: string;
  imageAlt: string;
  readingTime: string;
  sections: Section[];
};

export const articles: Record<string, Article> = {
  "yapay-zeka-is-analizi": {
    category: "Yapay zekâ · İş analizi",
    title: "Yapay zekâ bir işletmenin gerçek problemini nasıl anlamlandırır?",
    lead: "İyi bir yapay zekâ projesi, modele karar vermekle değil; işletmenin nerede zaman kaybettiğini, hangi bilginin eksik kaldığını ve hangi kararın zorlaştığını anlamakla başlar.",
    image: "/assets/teksanor-digital-twin.webp",
    imageAlt: "Veriyle çalışan endüstriyel dijital ikiz sistemi",
    readingTime: "8 dakika",
    sections: [
      { title: "Önce işi anlarız", paragraphs: ["Bir firma yapay zekâ kullanmak istediğinde önce günlük işi konuşuruz. Ekip nerede zaman kaybediyor, hangi bilgi tekrar hazırlanıyor ve hangi karar gecikiyor? Çözümü bu soruların cevabına göre şekillendiririz.", "Amacımız gösterişli bir ekran kurmak değil, ekibin gerçekten kullandığı bir araç hazırlamaktır. Teknolojiyi işin diline uyarlarız."] },
      { title: "Görevi net yazarız", paragraphs: ["Bir asistanın ne yapacağını tek cümlede anlatabilmeliyiz: ödeme notlarını ayırmak, eksik alanları göstermek veya haftalık özet hazırlamak gibi.", "Hangi veriyi okuyacağı, ne üreteceği ve nerede insan onayı bekleyeceği baştan belli olur. Böylece ekip ne beklemesi gerektiğini bilir."] },
      { title: "Önce veriyi düzene sokarız", paragraphs: ["Eksik veya çelişkili kayıtlar doğru sonuç üretmez. Aynı müşterinin farklı adlarla yazılması ya da tarih ve para birimlerinin karışması önce düzeltilmelidir.", "Temel alanları ortak bir düzene getiririz. Bu düzen yalnızca akıllı asistana değil, şirketin günlük raporlarına da yarar."] },
      { title: "Küçük bir işle başlarız", paragraphs: ["İlk adımda sonucu kolayca kontrol edilebilen tek bir işi seçeriz. Örneğin ödeme notlarını ayırmak veya haftalık yönetim özetini hazırlamak iyi bir başlangıç olabilir.", "Ekip gerçekten fayda görürse aynı yöntemi başka bölümlere taşırız."] },
      { title: "Son karar ekipte kalır", paragraphs: ["Ödeme, yetki değişikliği veya dışarı gönderilecek belge gibi önemli işlerde son sözü sorumlu kişi söyler. Sistem öneri hazırlar; kendi başına kritik işlem yapmaz.", "Biz tekrarı azaltmak ve önemli konuları görünür kılmak istiyoruz. İnsan sorumluluğunu ortadan kaldırmıyoruz."] },
    ],
  },
  "veri-karar-destek": {
    category: "Veri · Karar destek",
    title: "Dağınık Excel kayıtları güvenilir bir yönetim görünümüne nasıl dönüşür?",
    lead: "Excel çoğu işletme için hızlı ve tanıdık bir başlangıçtır. Sorun dosyanın kendisi değil; aynı bilginin farklı kişilerde, farklı biçimlerde ve ortak bir kontrol olmadan çoğalmasıdır.",
    image: "/assets/teksanor-engineering-lab.webp",
    imageAlt: "Mühendislik ve veri izleme merkezi",
    readingTime: "9 dakika",
    sections: [
      { title: "Her sütunun iş anlamı belirlenir", paragraphs: ["Dönüşüm, dosyaları doğrudan yeni sisteme yüklemekle başlamaz. Önce her sütunun neyi temsil ettiği, kim tarafından güncellendiği ve hangi kararda kullanıldığı anlaşılır. Aynı adı taşıyan iki alanın farklı anlamları, farklı adlarla tutulan iki alanın ise aynı anlamı olabilir.", "Bu sözlük çalışması tamamlanmadan yapılan aktarım, eski karmaşayı yalnızca daha modern bir ekrana taşır. Doğru veri modeli ise kullanıcıya gereksiz alan göstermeden işletmenin ortak dilini oluşturur."] },
      { title: "Kaynak veri korunur", paragraphs: ["Geçiş sırasında özgün dosyalar silinmemeli veya üzerinde geri döndürülemez değişiklik yapılmamalıdır. Aktarılan her kayıt kaynağı, dönemi ve mümkünse işlemi yapan kişiyle birlikte izlenebilmelidir.", "Kayıt geçmişi sayesinde sonradan yapılan bir düzeltmenin önceki değeri görülebilir. Bu özellik hem hataların araştırılmasını kolaylaştırır hem de ekip içinde ‘hangi sayı doğru?’ tartışmasını azaltır."] },
      { title: "Gösterge sayısı değil, karar kalitesi önemlidir", paragraphs: ["Kalabalık grafikler profesyonel bir yönetim paneli izlenimi verebilir; ancak her grafik bir soruya cevap vermiyorsa dikkati dağıtır. Yönetici için bugün ödenmesi gereken tutar, vadesi geçen borç, kullanılabilir nakit ve beklenen tahsilat çoğu zaman onlarca görselden daha değerlidir.", "Bu nedenle göstergeler görev bazında düzenlenir. Operasyon çalışanı kayıt ayrıntısını, yönetici eğilimi ve riski, sistem yöneticisi ise yetki ve işlem geçmişini görür."] },
      { title: "Dönemler karşılaştırılabilir olmalıdır", paragraphs: ["Aylık raporlar yalnızca ayrı dosyalar olarak saklandığında değişimin sebebini takip etmek zorlaşır. Düzenli bir sistem; dönemleri aynı tanımlarla üretir, önceki ayla karşılaştırır ve devreden kayıtları açıkça gösterir.", "Yeni döneme aktarım otomatik olabilir, fakat mükerrer kayıt üretmemesi için kapanış ve devir kuralları tanımlanmalıdır. Açık borç devrederken kapanmış bir ödemenin yeniden oluşmaması buna basit bir örnektir."] },
      { title: "Yönetim görünümü muhasebenin yerine geçmez", paragraphs: ["Operasyon ve karar destek paneli, işletmenin günlük durumunu anlaşılır hâle getirir; yasal muhasebe kayıtlarının, mali müşavir kontrolünün veya resmî beyannamelerin yerini almaz.", "Bu ayrım kullanıcıya açıkça anlatıldığında sistem doğru beklentiyle kullanılır. Teksanor’daki finansal görünüm, karar vermeyi ve iç takibi kolaylaştıran bir çalışma alanı olarak tasarlanır."] },
    ],
  },
  "surec-otomasyonu": {
    category: "Operasyon · Otomasyon",
    title: "Süreç otomasyonu ne zaman hız kazandırır, ne zaman karmaşa üretir?",
    lead: "Otomasyon, kötü tanımlanmış bir süreci düzeltmez; yalnızca daha hızlı tekrarlar. Değer üreten otomasyon, işin normal akışını ve istisnalarını birlikte ele alır.",
    image: "/assets/teksanor-digital-twin.webp",
    imageAlt: "Dijital süreç ve otomasyon görselleştirmesi",
    readingTime: "8 dakika",
    sections: [
      { title: "Tekrarlanan iş açıkça tanımlanır", paragraphs: ["Bir görevin otomasyona uygun olması için başlangıcı, girdisi, beklenen çıktısı ve tamamlanma koşulu anlaşılır olmalıdır. ‘Raporları otomatikleştirelim’ yerine ‘onaylanmış ödeme kayıtlarından her pazartesi şirket bazlı vade özeti üretelim’ demek uygulanabilir bir tanımdır.", "Netlik, hem geliştirme süresini kısaltır hem de sonuçların doğru olup olmadığını kullanıcıların kolayca kontrol etmesini sağlar."] },
      { title: "İstisnalar tasarımın parçasıdır", paragraphs: ["Gerçek iş süreçleri her zaman standart ilerlemez. Eksik belge, farklı para birimi, onay bekleyen kullanıcı veya mükerrer kayıt gibi durumlar olacaktır. Sistem yalnızca ideal senaryoya göre hazırlanırsa ilk istisnada kullanıcıyı tekrar Excel’e döndürür.", "Profesyonel otomasyon, belirsiz durumda sessizce karar vermek yerine işlemi durdurur, anlaşılır bir uyarı üretir ve doğru kişiden müdahale ister."] },
      { title: "Yetki ve onay sınırları korunur", paragraphs: ["Veri girmekle kritik kaydı değiştirmek aynı yetki değildir. Çalışanlar günlük bilgiyi ekleyebilirken tutar düzeltme, kullanıcı onayı veya kalıcı silme gibi işlemler yönetici kontrolünde kalmalıdır.", "Rol tabanlı yetki, şirketler arası veri ayrımı ve sunucu tarafındaki kontroller birlikte uygulanır. Yalnızca ekrandaki düğmeyi gizlemek güvenlik sağlamaz."] },
      { title: "İşlem geçmişi tutulur", paragraphs: ["Kim, ne zaman, hangi kaydı değiştirdi sorusuna cevap veremeyen otomasyon güven oluşturmaz. Önemli işlemler için önceki değer, yeni değer, işlem zamanı ve sorumlu kullanıcı kaydedilmelidir.", "Bu kayıtlar çalışanları izlemek için değil; hatayı bulmak, süreci iyileştirmek ve gerektiğinde doğru duruma dönebilmek için kullanılır."] },
      { title: "Otomasyon düzenli olarak ölçülür", paragraphs: ["Kurulduğu gün doğru çalışan bir akış, iş kuralları değiştiğinde yetersiz kalabilir. Hata oranı, tamamlanma süresi, elle müdahale sayısı ve kullanıcı geri bildirimi düzenli izlenmelidir.", "Otonom kontroller erişilebilirlik veya teknik hata gibi durumları bildirebilir; ancak iş sonucunun doğruluğu için sorumlu ekiplerin dönemsel değerlendirmesi devam etmelidir."] },
    ],
  },
  "muhendislik-danismanligi": {
    category: "Mühendislik · Danışmanlık",
    title: "Teknoloji yatırımı yapmadan önce hangi sorular sorulmalı?",
    lead: "Doğru teknoloji seçimi, en çok özelliğe sahip ürünü bulmak değildir. İşletmenin ihtiyacına, ekibin kullanım biçimine ve büyüme planına uygun bir sistem kurmaktır.",
    image: "/assets/teksanor-engineering-lab.webp",
    imageAlt: "Akıllı üretim ve mühendislik laboratuvarı",
    readingTime: "10 dakika",
    sections: [
      { title: "Problem tek cümlede anlatılabiliyor mu?", paragraphs: ["Bir yatırımın neden yapıldığı sade biçimde anlatılamıyorsa çözüm kapsamı büyük olasılıkla belirsizdir. ‘Dijitalleşmek istiyoruz’ yerine ‘farklı dosyalardaki borç ve ödeme kayıtlarını tek yerden, şirket bazında ve yetkiye göre izlemek istiyoruz’ denildiğinde başarı ölçütü görünür olur.", "Bu cümle projenin pusulasıdır. Yeni bir özellik önerildiğinde, temel probleme katkı sağlayıp sağlamadığı bu tanıma göre değerlendirilir."] },
      { title: "Mevcut sistemlerle nasıl çalışacak?", paragraphs: ["Yeni uygulama hiçbir zaman tamamen boş bir ortamda kurulmaz. Excel dosyaları, muhasebe yazılımı, banka çıktıları, e-posta akışları ve çalışanların alışkanlıkları mevcut sistemin parçalarıdır.", "Hangi kaynağın aktarılacağı, hangisinin yalnızca referans olarak kalacağı ve iki sistem arasında veri akışının nasıl gerçekleşeceği baştan belirlenmelidir."] },
      { title: "Veri nerede ve nasıl korunacak?", paragraphs: ["Sunucu konumu tek başına güvenlik cevabı değildir. Kullanıcı kimliğinin nasıl doğrulandığı, şirket verilerinin birbirinden nasıl ayrıldığı, yedekleme ve silme politikasının ne olduğu da açıklanmalıdır.", "Gizli anahtarlar kodun içine yazılmamalı; kritik işlemler sunucu tarafında denetlenmeli ve en az yetki prensibi uygulanmalıdır. Güvenlik bir kez eklenen özellik değil, düzenli kontrol edilen süreçtir."] },
      { title: "Kullanıcı gerçekten kullanabilecek mi?", paragraphs: ["Teknik olarak güçlü bir sistem, günlük işi yapan kişi için karmaşıksa beklenen değeri üretmez. Alan adları kullanıcının diliyle yazılmalı, hata mesajları ne yapılacağını anlatmalı ve mobil ekranlar sonradan küçültülmüş masaüstü sayfası gibi görünmemelidir.", "Küçük kullanıcı testleri, büyük geliştirme kararlarından önce yapılmalıdır. Kullanıcının duraksadığı her nokta tasarımı iyileştirmek için somut bilgidir."] },
      { title: "Yatırım küçük adımlarla doğrulanabilir mi?", paragraphs: ["Bütün sistemi tek seferde kurmak yerine temel bir süreci çalışır hâle getirmek, gerçek kullanım üzerinden öğrenmeyi sağlar. İlk aşamada güvenli giriş, firma ayrımı ve temel kayıt; sonraki aşamada raporlama, otomasyon ve entegrasyon geliştirilebilir.", "Bu yöntem plansız ilerlemek anlamına gelmez. Aksine, uzun vadeli mimariyi korurken her aşamada çalışan ve ölçülebilen bir sonuç üretir."] },
    ],
  },
};

export default function InsightArticle({ articleKey }: { articleKey: string }) {
  const article = articles[articleKey];
  return (
    <main className="article-page">
      <header className="article-header">
        <Link href="/"><img src="/assets/teksanor-logo.png" alt="Teksanor" /></Link>
        <nav><Link href="/cozumler">Çözümler</Link><Link href="/muhendislik">Mühendislik</Link><Link href="/yapay-zeka">Yapay Zekâ</Link><Link href="/hakkimizda">Hakkımızda</Link></nav>
        <Link className="article-portal-link" href="/giris">Portala gir <ArrowRight size={15} /></Link>
      </header>
      <section className="article-hero">
        <img src={article.image} alt={article.imageAlt} />
        <div className="article-hero-shade" />
        <div className="article-hero-copy">
          <Link href="/" className="article-back"><ArrowLeft size={16} /> İçgörülere dön</Link>
          <span>{article.category}</span>
          <h1>{article.title}</h1>
          <p>{article.lead}</p>
          <div><Clock3 size={16} /> Yaklaşık {article.readingTime} okuma</div>
        </div>
      </section>
      <div className="article-layout">
        <aside>
          <b>Bu yazıda</b>
          {article.sections.map((section, index) => <a href={`#bolum-${index + 1}`} key={section.title}><span>0{index + 1}</span>{section.title}</a>)}
        </aside>
        <article className="article-content">
          <div className="article-intro"><b>Teksanor notu</b><p>Konuyu günlük iş üzerinden, açık bir dille anlatıyoruz. Her firmanın çalışma biçimi farklıdır; bu nedenle önce mevcut düzeni inceler, sonra uygun adımı seçeriz.</p></div>
          {article.sections.map((section, index) => (
            <section id={`bolum-${index + 1}`} key={section.title}>
              <span>0{index + 1}</span><h2>{section.title}</h2>
              {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </section>
          ))}
          <div className="article-trust-note"><ShieldCheck size={24} /><div><b>Açık ve ölçülü yaklaşım</b><p>Gerçek ihtiyacı görmeden süre, maliyet veya başarı sözü vermiyoruz. Önce işi inceliyor, sonra ölçülebilir bir hedef belirliyoruz.</p></div></div>
          <div className="article-conclusion"><span>Bir sonraki adım</span><h2>İhtiyacı sadeleştirin, sonra teknolojiyi seçin.</h2><p>Teksanor Yönetim Portalı’nı inceleyebilir veya diğer çözüm alanlarından araştırmanıza devam edebilirsiniz.</p><div><Link href="/giris#kayit">Portal çalışma alanını aç <ArrowRight size={16} /></Link><Link href="/cozumler">Tüm çözümler</Link></div></div>
        </article>
      </div>
      <footer className="article-footer"><img src="/assets/teksanor-logo.png" alt="Teksanor" /><span>Mühendislik aklı. Yapay zekâ gücü.</span><span>© 2026 Teksanor</span></footer>
    </main>
  );
}
