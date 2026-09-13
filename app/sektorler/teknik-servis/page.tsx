import { DocPage } from "@/components/EnterpriseContent";

export default function Page() {
  return (
    <DocPage
      eyebrow="Sektör · Teknik servis"
      title="Teknik servis operasyonu"
      intro="Arıza kaydından saha müdahalesine, iş emri takibinden faturalandırmaya kadar tüm servis akışını tek platformda yönetin."
      pills={["Arıza kaydı", "İş emri", "Saha", "Faturalandırma"]}
      sections={[{"title": "Akış", "cards": [{"title": "Arıza / talep", "text": "Müşteri talebi kaydedilir ve önceliklendirilir."}, {"title": "İş emri", "text": "Teknisyene atanır, tahmini süre ve konum belirlenir."}, {"title": "Saha müdahalesi", "text": "Bulgu, parça ve işçilik kaydedilir."}, {"title": "Kapanış", "text": "Maliyet, ödeme ve müşteri onayı tamamlanır."}]}]}
      cta={{"label": "Servis masasına git", "href": "/servis"}}
    />
  );
}
