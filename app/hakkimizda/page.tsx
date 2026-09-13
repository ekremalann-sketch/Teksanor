import { DocPage } from "@/components/EnterpriseContent";

export default function Page() {
  return (
    <DocPage
      eyebrow="Hakkımızda"
      title="Mühendislik disipliniyle dijitalleşme"
      intro="Teksanor; teknik servis, bakım ve mühendislik ekiplerinin günlük operasyonunu sadeleştirmek için geliştirilen bir yönetim platformudur. Amacımız karmaşıklığı artırmadan, veriye dayalı ve izlenebilir bir çalışma modeli kurmaktır."
      sections={[{"title": "Yaklaşımımız", "bullets": ["Önce ihtiyacı netleştirir, sonra sistemi sadeleştiririz.", "Veriye dayalı ve açıklanabilir kararları önceliklendiririz.", "İnsan kontrolünü koruyan yapay zekâ kullanırız.", "İhtiyaca göre büyüyebilen sistemler tasarlarız."]}, {"title": "Not", "body": "Teksanor, mühendislik ve teknoloji çözümleri için geliştirilen marka kimliğidir. Resmî şirket ve iletişim bilgileri kuruluş süreci tamamlandığında eklenecektir."}]}
    />
  );
}
