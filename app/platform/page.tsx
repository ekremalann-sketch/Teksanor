import { DocPage } from "@/components/EnterpriseContent";

export default function Page() {
  return (
    <DocPage
      eyebrow="Platform"
      title="Tek çalışma alanında operasyon omurgası"
      intro="İş emri, saha ziyareti, ekipman, periyodik bakım, proje, satın alma, finans ve belge yönetimi aynı platformda birleşir. Yönetici ne olduğunu görür; ekip ne yapacağını bilir."
      pills={["İş emri", "Saha", "Bakım", "Finans", "Belge", "Otomasyon"]}
      sections={[{"title": "Modüller", "cards": [{"title": "İş emri ve saha", "text": "Görev oluşturma, atama, saha ziyareti, bulgu ve tamamlama akışı."}, {"title": "Varlık ve bakım", "text": "Ekipman envanteri, periyodik bakım planı ve otomatik yeni tarih."}, {"title": "Finans", "text": "Ödeme, borç, gider, dönemsel özet ve döviz karşılığı görünümü."}, {"title": "CRM ve İK", "text": "Müşteri, görüşme geçmişi, çalışan ve yetki yönetimi."}, {"title": "Satın alma ve risk", "text": "Talep, onay akışı, risk kaydı ve azaltıcı aksiyon takibi."}, {"title": "Otomasyon", "text": "Kurallara dayalı hatırlatma ve tekrar eden işlerin sadeleştirilmesi."}]}, {"title": "Neden tek platform?", "bullets": ["Dağınık Excel tablolarını izlenebilir kayıtlara dönüştürür.", "Her firma yalnızca kendi verisine erişir (firma bazlı veri ayrımı).", "Kullanıcı ve yönetici yetkileri merkezi olarak yönetilir.", "Tüm kritik işlemler denetim kaydında izlenir."]}]}
      cta={{"label": "Kurumsal girişe geç", "href": "/giris"}}
    />
  );
}
