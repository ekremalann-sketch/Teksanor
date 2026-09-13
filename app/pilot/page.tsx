import { DocPage } from "@/components/EnterpriseContent";

export default function Page() {
  return (
    <DocPage
      eyebrow="Ücretli pilot"
      title="6–12 haftada ölçülebilir kanıt"
      intro="Büyük bir taahhüt vermeden önce, en çok yük oluşturan sürecinizi seçip küçük ölçekli bir pilot çalışma yürütürüz. Sonunda somut, ölçülebilir bir kazanç raporu sunarız."
      pills={["6–12 hafta", "Tek süreç", "Ölçülebilir çıktı"]}
      sections={[{"title": "Pilot adımları", "cards": [{"title": "1. Keşif", "text": "Süreç haritalanır, veri kaynakları ve karar noktaları belirlenir."}, {"title": "2. Kurulum", "text": "İlgili modüller yapılandırılır, mevcut veriler aktarılır."}, {"title": "3. Ölçüm", "text": "Kullanım verisi toplanır, kazanç ve iyileştirme alanları raporlanır."}]}]}
      cta={{"label": "Pilot için giriş yap", "href": "/giris"}}
    />
  );
}
