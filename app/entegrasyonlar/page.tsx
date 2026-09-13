import { DocPage } from "@/components/EnterpriseContent";

export default function Page() {
  return (
    <DocPage
      eyebrow="Entegrasyonlar"
      title="Mevcut araçlarınızla birlikte çalışır"
      intro="Teksanor, kullandığınız tabloları ve sistemleri devre dışı bırakmadan yanına yerleşir. Veri aktarımı, API erişimi ve dosya tabanlı entegrasyonlarla kademeli geçiş sağlar."
      pills={["Excel / CSV", "API", "Webhook", "E-posta"]}
      sections={[{"title": "Desteklenen yaklaşımlar", "cards": [{"title": "Excel ve CSV aktarımı", "text": "Mevcut verilerinizi içe aktararak hızlı başlangıç yapın."}, {"title": "API erişimi", "text": "Kurumsal planda uygulamalarınızla programatik veri alışverişi."}, {"title": "Dosya ve belge", "text": "Sözleşme, rapor ve fotoğrafların kayda bağlı saklanması."}]}, {"title": "Kademeli geçiş", "body": "Önce en çok yük oluşturan tek bir süreci taşırız; ölçülebilir kazanç görüldükçe kapsamı genişletiriz. Bu yaklaşım riski azaltır ve ekibin adaptasyonunu kolaylaştırır."}]}
    />
  );
}
