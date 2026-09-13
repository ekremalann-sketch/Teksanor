import { DocPage } from "@/components/EnterpriseContent";

export default function Page() {
  return (
    <DocPage
      eyebrow="Kurumsal durum"
      title="Ürün durumu ve yapılacaklar"
      intro="Son kaynak kodda operasyon modülleri ve güvenlik sertleştirmeleri işlendi. Bu sayfa görünür olan yetenekleri ve canlı müşteri öncesi kalan kritik işleri şeffaf biçimde listeler."
      sections={[{"title": "Görünür yetenekler", "bullets": ["İş emri, saha ziyareti, varlık ve periyodik bakım yönetimi.", "Müşteri (CRM), çalışan (İK), satın alma, risk ve otomasyon çekirdeği.", "Finansal takip: ödeme, borç, gider ve dönemsel özet.", "Rol bazlı yetkilendirme, denetim kaydı ve güvenli dosya işleme."]}, {"title": "Kalan kritik işler", "bullets": ["İki adımlı doğrulamanın yaygınlaştırılması.", "Gelişmiş raporlama ve dışa aktarma seçenekleri.", "Üçüncü taraf entegrasyonlarının genişletilmesi."]}]}
    />
  );
}
