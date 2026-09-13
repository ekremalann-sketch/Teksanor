import { DocPage } from "@/components/EnterpriseContent";

export default function Page() {
  return (
    <DocPage
      eyebrow="Planlar"
      title="İhtiyacınıza göre ölçeklenen paketler"
      intro="Başlangıç, Profesyonel ve Kurumsal planlarımız firma bazlı veri ayrımı, güvenli erişim ve işlem geçmişi ile gelir. Ayrıntılı plan karşılaştırması için giriş yapın."
      pills={["Başlangıç ₺4.900/ay", "Profesyonel ₺9.900/ay", "Kurumsal: özel"]}
      sections={[{"title": "Ne dahil?", "cards": [{"title": "Başlangıç", "text": "5 kullanıcı, iş emri, saha, müşteri ve temel finans."}, {"title": "Profesyonel", "text": "25 kullanıcı, bakım, satın alma, risk, otomasyon ve denetim."}, {"title": "Kurumsal", "text": "Sınırsız kullanıcı, API, yapay zekâ analizi ve öncelikli destek."}]}]}
      cta={{"label": "Başla", "href": "/giris#kayit"}}
    />
  );
}
