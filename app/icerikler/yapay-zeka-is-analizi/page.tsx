import { DocPage } from "@/components/EnterpriseContent";

export default function Page() {
  return (
    <DocPage
      eyebrow="Yapay zekâ · İş analizi"
      title="Yapay zekâ, gerçek problemi nasıl anlamlandırır?"
      intro="İyi bir sistem teknoloji seçerek değil, doğru iş sorusunu tanımlayarak başlar. Bu yazıda iş analizinin yapay zekâ ile nasıl güçlendiğini ele alıyoruz."
      sections={[{"title": "Temel fikir", "body": "Yapay zekâ, tekrarlanan işleri ve dağınık verileri inceleyerek karar noktalarını görünür kılar. Amaç insanı değiştirmek değil, kararı hızlandırmak ve hata payını azaltmaktır."}, {"title": "Adımlar", "bullets": ["Süreci ve veriyi haritalayın.", "En çok yük oluşturan tek noktayı seçin.", "Ölçülebilir bir hedef belirleyin ve küçük başlayın."]}]}
    />
  );
}
