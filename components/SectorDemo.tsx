"use client";
// Sektör sayfalarında "Örnek platform": örnek bir işin baştan sona akışı ve her rolün ekranı.
// Görseller resim değil sade HTML'dir: hızlı yüklenir, mobilde kaymaz, metni ekran okuyucu okur.
// Tüm adlar ve tutarlar örnektir (gerçek müşteri verisi değildir).
import { useState } from "react";

type Who = "Sistem" | "Yönetici" | "Teknisyen" | "Müşteri" | "Satın alma" | "Proje müdürü" | "Saha şefi" | "Finans";
type Step = { title: string; who: Who; auto: boolean; note: string; screen: { heading: string; rows: [string, string][]; action?: string; badge?: string } };
type RoleView = { role: string; home: string; items: [string, string][] };
type Scenario = { name: string; summary: string; steps: Step[]; roles: RoleView[] };

const SCENARIOS: Record<string, Scenario> = {
  "teknik-servis": {
    name: "Örnek iş: Kombi arızası · Müşteri 1 (örnek) D:4",
    summary: "Müşteri arar, teklif onaylanır, teknisyen sahada formu doldurur, müşteri imzalar, tahsilat izlenir.",
    steps: [
      { title: "Talep kaydı", who: "Yönetici", auto: false, note: "Telefonla gelen arıza 30 saniyede kaydedilir; müşteri ve adres önceki işlerden gelir.", screen: { heading: "Yeni servis talebi", rows: [["Müşteri", "Müşteri 1 (örnek) · D:4"], ["Arıza", "Kombi su basıncı düşüyor"], ["Öncelik", "Yüksek"]], action: "Talebi aç" } },
      { title: "Teklif", who: "Yönetici", auto: false, note: "Kalemler ve KDV ile teklif hazırlanır; müşteriye onay bağlantısı gönderilir.", screen: { heading: "Teklif · SRV-0142", rows: [["Genleşme tankı", "1.850 ₺"], ["İşçilik", "900 ₺"], ["Toplam (KDV dahil)", "3.300 ₺"]], action: "Müşteriye onay bağlantısı gönder" } },
      { title: "Müşteri onayı", who: "Müşteri", auto: false, note: "Müşteri telefonundan onaylar ya da değişiklik ister; kararı kaydedilir.", screen: { heading: "Teklifi onaylıyor musunuz?", rows: [["Firma", "Örnek Klima Servis"], ["Tutar", "3.300 ₺"], ["Geçerlilik", "7 gün"]], action: "Onaylıyorum", badge: "Müşteri ekranı" } },
      { title: "Planlama", who: "Sistem", auto: true, note: "Onay gelince iş, planlama panosunda 'atanmayı bekliyor' satırına düşer; yönetici teknisyeni seçer.", screen: { heading: "Planlama panosu · Salı", rows: [["Teknisyen A", "09:00 Kombi · Yılmaz Apt."], ["Teknisyen B", "11:30 Klima bakımı"], ["Atanmamış", "1 iş"]], badge: "Otomatik sıralama" } },
      { title: "Sahada form", who: "Teknisyen", auto: false, note: "Teknisyen telefondan kontrol listesini doldurur; zorunlu maddeler bitmeden iş kapanmaz.", screen: { heading: "Saha formu · Kombi", rows: [["Basınç ölçümü *", "1,5 bar"], ["Sızıntı kontrolü *", "Yok"], ["Fotoğraf", "2 adet"]], action: "İşi tamamla", badge: "Telefon ekranı" } },
      { title: "İmza ve rapor", who: "Müşteri", auto: false, note: "Müşteri ekranda imzalar; servis raporu PDF olarak oluşur, form kilitlenir.", screen: { heading: "Teslim onayı", rows: [["Yapılan iş", "Genleşme tankı değişti"], ["İmza", "✓ alındı 10:47"], ["Rapor", "SRV-0142.pdf"]] } },
      { title: "Tahsilat", who: "Finans", auto: false, note: "İş 'tahsilat bekliyor' listesine düşer; ödeme girilince kapanır. e-Fatura taslağı entegratöre hazırdır.", screen: { heading: "Tahsilat bekleyenler", rows: [["SRV-0142", "3.300 ₺ · 0 gün"], ["SRV-0131", "1.200 ₺ · 6 gün"], ["Toplam", "4.500 ₺"]], action: "Ödeme al" } },
    ],
    roles: [
      { role: "Yönetici", home: "Bugün: geciken, onay bekleyen, tahsilat", items: [["Geciken iş", "1"], ["Müşteri onayı bekleyen", "3"], ["Tahsilat bekleyen", "4.500 ₺"]] },
      { role: "Teknisyen", home: "İşlerim (telefon)", items: [["09:00", "Kombi · Yılmaz Apt."], ["11:30", "Klima bakımı · Ofis 3"], ["Eksik form", "0"]] },
      { role: "Finans", home: "Ödemeler ve tahsilat", items: [["Bu hafta tahsil", "18.400 ₺"], ["Vadesi geçen", "2 iş"], ["e-Fatura taslağı", "5"]] },
    ],
  },
  "bakim-onarim": {
    name: "Örnek iş: Jeneratör periyodik bakımı · Lojistik deposu",
    summary: "Bakım planı işi zamanında açar, teknisyen ölçümleri girer, arıza çıkarsa parça talebi onaya gider, ekipman geçmişi güncellenir.",
    steps: [
      { title: "Bakım planı", who: "Yönetici", auto: false, note: "Ekipman başına periyot bir kez tanımlanır (her 3 ayda bir).", screen: { heading: "Bakım planı · JEN-02", rows: [["Ekipman", "Jeneratör 250 kVA"], ["Periyot", "3 ay"], ["Sonraki", "14 Kasım"]] } },
      { title: "İş kendiliğinden açılır", who: "Sistem", auto: true, note: "Tarihten 7 gün önce bakım işi açılır ve sorumluya bildirim gider; kimse hatırlamak zorunda kalmaz.", screen: { heading: "Bildirim", rows: [["Bakım tarihi", "14 Kasım"], ["İş", "BKM-0388 açıldı"], ["Sorumlu", "Teknisyen B"]], badge: "Otomatik" } },
      { title: "Ölçüm formu", who: "Teknisyen", auto: false, note: "Yağ, akü ve yük testi değerleri girilir; sınır dışı değer kırmızı görünür.", screen: { heading: "Kontrol listesi", rows: [["Akü voltajı *", "12,1 V"], ["Yağ seviyesi *", "Düşük"], ["Yük testi *", "Geçti"]], action: "Arıza bildir", badge: "Telefon ekranı" } },
      { title: "Parça talebi", who: "Satın alma", auto: false, note: "Arıza parça gerektiriyorsa satın alma talebi açılır; talep eden kendi talebini onaylayamaz.", screen: { heading: "Satın alma talebi", rows: [["Parça", "Yağ filtresi ×2"], ["Tutar", "1.400 ₺"], ["Onaylayan", "Bekliyor"]], action: "Onayla" } },
      { title: "Kapanış", who: "Teknisyen", auto: false, note: "Parça takılınca iş kapanır; ölçümler ekipman geçmişine yazılır.", screen: { heading: "BKM-0388 tamamlandı", rows: [["Süre", "2 sa 10 dk"], ["Değişen parça", "Yağ filtresi"], ["Rapor", "BKM-0388.pdf"]] } },
      { title: "Ekipman geçmişi", who: "Yönetici", auto: false, note: "Ekipmanın tüm bakım ve arızaları tek sayfada; tekrar eden arıza görünür olur.", screen: { heading: "JEN-02 geçmişi", rows: [["Ağu", "Bakım · sorun yok"], ["Kas", "Bakım · yağ filtresi"], ["Arıza sayısı (12 ay)", "1"]] } },
    ],
    roles: [
      { role: "Bakım şefi", home: "Bu hafta bakımlar ve gecikenler", items: [["Bu hafta", "9 bakım"], ["Geciken", "1"], ["Parça bekleyen", "2"]] },
      { role: "Teknisyen", home: "Bugünkü bakımlarım", items: [["08:30", "JEN-02 · Depo"], ["13:00", "Kompresör K-4"], ["Eksik ölçüm", "0"]] },
      { role: "Satın alma", home: "Onay bekleyen talepler", items: [["Yağ filtresi ×2", "1.400 ₺"], ["V kayışı", "650 ₺"], ["Bu ay", "12 talep"]] },
    ],
  },
  "muhendislik-taahhut": {
    name: "Örnek proje: Fabrika HVAC montajı · 4 ay",
    summary: "Bütçe ve kilometre taşları kurulur, satın almalar onaydan geçer, saha şefi ilerlemeyi raporlar, teslim tutanağıyla kapanır.",
    steps: [
      { title: "Proje ve bütçe", who: "Proje müdürü", auto: false, note: "Bütçe kalemleri ve kilometre taşları tanımlanır.", screen: { heading: "PRJ-021 · HVAC montajı", rows: [["Bütçe", "2.400.000 ₺"], ["Kilometre taşı", "4"], ["Bitiş", "28 Şubat"]] } },
      { title: "Satın alma", who: "Satın alma", auto: false, note: "Malzeme talepleri bütçe kalemine bağlanır; onay sınırı aşılırsa yönetim onaylar.", screen: { heading: "Satın alma · Kanal malzemesi", rows: [["Tutar", "380.000 ₺"], ["Bütçe kalemi", "Malzeme · %62 kullanıldı"], ["Onay", "Yönetim bekleniyor"]], action: "Onaya gönder" } },
      { title: "Saha ilerlemesi", who: "Saha şefi", auto: false, note: "Haftalık ilerleme ve fotoğraf telefondan girilir.", screen: { heading: "Haftalık rapor · Hafta 6", rows: [["Kanal montajı", "%70"], ["Fotoğraf", "8 adet"], ["Risk", "Vinç gecikmesi"]], badge: "Telefon ekranı" } },
      { title: "Uyarı", who: "Sistem", auto: true, note: "Bütçe %80'i veya kilometre taşı tarihi aşılırsa yöneticiye uyarı düşer; karar yöneticinindir.", screen: { heading: "Dikkat", rows: [["Bütçe", "%81 kullanıldı"], ["Kilometre taşı 2", "3 gün gecikme"], ["Öneri", "Revizyon görüşmesi"]], badge: "Otomatik uyarı" } },
      { title: "Teslim", who: "Proje müdürü", auto: false, note: "Teslim tutanağı ve eksik listesi kaydedilir; müşteri onayıyla proje kapanır.", screen: { heading: "Teslim tutanağı", rows: [["Eksik madde", "2"], ["Müşteri onayı", "✓ 28 Şubat"], ["Sapma", "Bütçe +%3"]] } },
    ],
    roles: [
      { role: "Yönetim", home: "Proje portföyü", items: [["Aktif proje", "6"], ["Bütçe aşım riski", "1"], ["Geciken taş", "2"]] },
      { role: "Proje müdürü", home: "PRJ-021 özeti", items: [["İlerleme", "%58"], ["Onay bekleyen alım", "2"], ["Açık risk", "3"]] },
      { role: "Saha şefi", home: "Bu haftanın işleri", items: [["Rapor teslimi", "Cuma"], ["Ekip", "7 kişi"], ["Eksik fotoğraf", "0"]] },
    ],
  },
};

export function SectorDemo({ slug }: { slug: string }) {
  const scenario = SCENARIOS[slug] ?? SCENARIOS["teknik-servis"];
  const [index, setIndex] = useState(0);
  const step = scenario.steps[index];
  return (
    <section className="sector-demo" aria-label="Örnek platform">
      <div className="sector-demo-head">
        <span>ÖRNEK PLATFORM</span>
        <h2>{scenario.name}</h2>
        <p>{scenario.summary}</p>
      </div>
      <ol className="sector-demo-steps" aria-label="Akış adımları">
        {scenario.steps.map((item, i) => (
          <li key={item.title}>
            <button type="button" aria-current={i === index ? "step" : undefined} className={i === index ? "active" : i < index ? "done" : ""} onClick={() => setIndex(i)}>
              <b>{i + 1}</b><span>{item.title}</span>
            </button>
          </li>
        ))}
      </ol>
      <div className="sector-demo-body">
        <div className="sector-demo-explain">
          <span className={`sector-demo-who ${step.auto ? "auto" : ""}`}>{step.auto ? "Sistem yapar" : `${step.who} yapar`}</span>
          <h3>{step.title}</h3>
          <p>{step.note}</p>
          <div className="sector-demo-nav">
            <button type="button" onClick={() => setIndex(Math.max(0, index - 1))} disabled={index === 0}>← Önceki</button>
            <button type="button" className="primary" onClick={() => setIndex(Math.min(scenario.steps.length - 1, index + 1))} disabled={index === scenario.steps.length - 1}>Sonraki adım →</button>
          </div>
        </div>
        <div className="sector-demo-screen" aria-live="polite">
          <div className="sector-demo-bar"><i /><i /><i /><small>{step.screen.badge ?? "Teksanor paneli"}</small></div>
          <h4>{step.screen.heading}</h4>
          <dl>{step.screen.rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
          {step.screen.action && <span className="sector-demo-action">{step.screen.action}</span>}
          <small className="sector-demo-note">Örnek veri</small>
        </div>
      </div>
      <div className="sector-demo-roles">
        <h3>Kim girince ne görür?</h3>
        <div>
          {scenario.roles.map((role) => (
            <article key={role.role}>
              <b>{role.role}</b>
              <small>{role.home}</small>
              <ul>{role.items.map(([k, v]) => <li key={k}><span>{k}</span><strong>{v}</strong></li>)}</ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
