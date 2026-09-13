import { DocPage } from "@/components/EnterpriseContent";

export default function Page() {
  return (
    <DocPage
      eyebrow="Çözüm alanları"
      title="Teknolojiyi ihtiyaç duyulan yere uygularız"
      intro="Hazır kalıplar yerine problemi anlamaya, veriyi düzenlemeye ve adım adım değer üretmeye odaklanırız."
      sections={[{"title": "Çözümler", "cards": [{"title": "Yapay zekâ destekli iş analizi", "text": "Tekrarlanan işleri ve karar noktalarını inceleyip sadeleştiririz."}, {"title": "Veri ve karar destek", "text": "Dağınık verileri anlaşılır panellere dönüştürürüz."}, {"title": "Süreç otomasyonu", "text": "Manuel takip yükünü azaltan çözümler geliştiririz."}, {"title": "Mühendislik danışmanlığı", "text": "Uygulanabilir teknoloji seçeneklerini birlikte belirleriz."}]}]}
    />
  );
}
