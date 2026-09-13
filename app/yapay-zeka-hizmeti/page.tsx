import { DocPage } from "@/components/EnterpriseContent";

export default function Page() {
  return (
    <DocPage
      eyebrow="İsteğe bağlı yapay zekâ ekibi"
      title="Sınırları yazılı bir çalışma arkadaşı"
      intro="Her departmana sohbet kutusu değil; yalnızca izin verilen veriyi kullanan, taslağını sorumlu kişiye sunan ve kritik adımlarda insan onayı bekleyen ajan profilleri kurarız."
      pills={["Prototip", "En az erişim", "İnsan onayı zorunlu"]}
      sections={[{"title": "Çalışma ilkeleri", "cards": [{"title": "Görev tanımı", "text": "Net çıktı ve sınır: ajan yalnızca tanımlı işi yapar."}, {"title": "En az erişim", "text": "Yalnızca gerekli veriye erişim verilir."}, {"title": "İnsan kararı", "text": "Kritik işlemde onay olmadan aksiyon alınmaz."}]}]}
    />
  );
}
