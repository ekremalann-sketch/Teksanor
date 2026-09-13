import { DocPage } from "@/components/EnterpriseContent";

export default function Page() {
  return (
    <DocPage
      eyebrow="Sektör · Mühendislik ve taahhüt"
      title="Proje bazlı taahhüt yönetimi"
      intro="Proje planlama, ilerleme takibi, maliyet ve belge yönetimini tek çalışma alanında birleştirin."
      pills={["Proje", "İlerleme", "Maliyet", "Belge"]}
      sections={[{"title": "Yetenekler", "cards": [{"title": "Proje planı", "text": "Aşama, sorumlu ve zaman çizelgesi tanımlanır."}, {"title": "İlerleme", "text": "Görev ve saha kayıtları projeye bağlanır."}, {"title": "Maliyet ve belge", "text": "Gider, satın alma ve sözleşmeler izlenir."}]}]}
      cta={{"label": "Panele git", "href": "/panel"}}
    />
  );
}
