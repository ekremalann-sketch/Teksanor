import { DocPage } from "@/components/EnterpriseContent";

export default function Page() {
  return (
    <DocPage
      eyebrow="Mühendislik yaklaşımı"
      title="Teknoloji yatırımı yapmadan önce hangi sorular sorulmalı?"
      intro="Doğru sorular, yanlış yatırımın önüne geçer. Bu yazıda karar öncesi kontrol listesini paylaşıyoruz."
      sections={[{"title": "Kontrol listesi", "bullets": ["Bu yatırım hangi ölçülebilir problemi çözecek?", "Mevcut sistemlerle nasıl birlikte çalışacak?", "Başarıyı nasıl ölçeceğiz ve ne zaman değerlendireceğiz?"]}]}
    />
  );
}
