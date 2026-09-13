import { DocPage } from "@/components/EnterpriseContent";

export default function Page() {
  return (
    <DocPage
      eyebrow="Süreç tasarımı"
      title="Otomasyon nerede başlamalı, insan kararı nerede kalmalı?"
      intro="Tekrar eden işi sadeleştirirken yetki, sorumluluk ve kontrol çizgisini kaybetmeyen bir çalışma modeli."
      sections={[{"title": "İlkeler", "bullets": ["Önce en çok tekrar eden, düşük riskli işi otomatikleştirin.", "Kritik kararlarda insan onayını koruyun.", "Her otomasyonu izlenebilir ve geri alınabilir tasarlayın."]}]}
    />
  );
}
