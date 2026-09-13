import { DocPage } from "@/components/EnterpriseContent";

export default function Page() {
  return (
    <DocPage
      eyebrow="Yapay zekâ"
      title="İnsan kontrolünü koruyan yapay zekâ"
      intro="Yapay zekâyı sihirli bir kutu olarak değil; iş sorusunu netleştiren, veriyi düzenleyen ve kararı hızlandıran bir araç olarak ele alırız. Kritik adımlarda insan onayı her zaman zorunludur."
      pills={["İş analizi", "Karar destek", "İnsan onayı"]}
      sections={[{"title": "Kullanım alanları", "cards": [{"title": "İş analizi", "text": "Tekrarlanan işleri ve dağınık verileri inceleyip sadeleştirir."}, {"title": "Karar destek", "text": "Göstergeleri anlaşılır panellere ve önerilere dönüştürür."}, {"title": "Taslak üretimi", "text": "Rapor ve yazışma taslaklarını sorumlu kişiye sunar."}]}]}
      cta={{"label": "Ajan çalışma modelini incele", "href": "/yapay-zeka-hizmeti"}}
    />
  );
}
