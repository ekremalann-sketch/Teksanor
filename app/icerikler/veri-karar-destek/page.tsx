import { DocPage } from "@/components/EnterpriseContent";

export default function Page() {
  return (
    <DocPage
      eyebrow="Finansal görünürlük"
      title="Dağınık Excel kayıtları yönetim görünümüne nasıl dönüşür?"
      intro="Veriyi yeniden girmeden ortak bir karar ekranı kurmanın temel adımları."
      sections={[{"title": "Yaklaşım", "bullets": ["Mevcut tabloları içe aktarın; sıfırdan başlamayın.", "Anahtar göstergeleri (borç, gider, nakit) tek panelde toplayın.", "Yetkiyi koruyarak ekip erişimini açın."]}]}
    />
  );
}
