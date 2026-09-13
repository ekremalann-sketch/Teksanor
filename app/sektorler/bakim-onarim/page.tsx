import { DocPage } from "@/components/EnterpriseContent";

export default function Page() {
  return (
    <DocPage
      eyebrow="Sektör · Bakım ve onarım"
      title="Periyodik bakım ve onarım"
      intro="Ekipman envanteri, periyodik bakım planları, kontrol listeleri ve tamamlandığında otomatik hesaplanan yeni bakım tarihi."
      pills={["Envanter", "Periyodik plan", "Kontrol listesi"]}
      sections={[{"title": "Öne çıkanlar", "cards": [{"title": "Varlık envanteri", "text": "Makine, araç, cihaz, konum ve sorumlu kaydı."}, {"title": "Periyodik bakım", "text": "Sıklık tanımı, kontrol listesi ve gecikme takibi."}, {"title": "Otomatik tarih", "text": "Bakım tamamlandığında sonraki tarih kendiliğinden hesaplanır."}]}]}
      cta={{"label": "Panele git", "href": "/panel"}}
    />
  );
}
