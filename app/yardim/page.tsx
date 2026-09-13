import { DocPage } from "@/components/EnterpriseContent";

export default function Page() {
  return (
    <DocPage
      eyebrow="Yardım"
      title="Yardım ve destek"
      intro="Platformu kullanırken ihtiyaç duyabileceğiniz temel konular ve başlangıç adımları. Kurumsal planlarda öncelikli destek sunulur."
      sections={[{"title": "Sık sorulanlar", "cards": [{"title": "Nasıl başlarım?", "text": "Kurumsal giriş sayfasından hesabınızla oturum açın veya kayıt olun."}, {"title": "Verilerim güvende mi?", "text": "Her firma yalnızca kendi verisine erişir; işlemler denetim kaydında tutulur."}, {"title": "Excel aktarımı var mı?", "text": "Evet, mevcut verilerinizi içe aktararak hızlı başlangıç yapabilirsiniz."}]}]}
      cta={{"label": "Giriş yap", "href": "/giris"}}
    />
  );
}
