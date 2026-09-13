import { DocPage } from "@/components/EnterpriseContent";

export default function Page() {
  return (
    <DocPage
      eyebrow="Mühendislik"
      title="Mühendislik ve teknoloji danışmanlığı"
      intro="İhtiyacı doğru tanımlar, uygulanabilir teknoloji seçeneklerini karşılaştırır ve sürdürülebilir çözüm yolunu birlikte belirleriz."
      sections={[{"title": "Nasıl çalışırız?", "bullets": ["Problemi ve mevcut durumu birlikte analiz ederiz.", "Uygulanabilir seçenekleri maliyet ve etkiye göre karşılaştırırız.", "Küçük ölçekli pilotla varsayımları doğrularız.", "Ölçülebilir kazanç görüldükçe kapsamı genişletiriz."]}]}
      cta={{"label": "Pilot çalışmayı incele", "href": "/pilot"}}
    />
  );
}
