import { DocPage } from "@/components/EnterpriseContent";

export default function Page() {
  return (
    <DocPage
      eyebrow="Güven merkezi"
      title="Mevcut ve planlı güvenlik kontrolleri"
      intro="Verinin firma bazlı ayrımı, yetkilendirme, denetim kaydı ve güvenli dosya işleme platformun temelinde yer alır. Bu sayfa uygulanmış ve planlanmış kontrolleri şeffaf biçimde listeler."
      pills={["Veri ayrımı", "Yetki", "Denetim", "Dosya güvenliği"]}
      sections={[{"title": "Uygulanan kontroller", "bullets": ["Firma bazlı veri ayrımı: her sorgu organizasyon kimliğiyle sınırlanır.", "Rol bazlı yetkilendirme (yönetici / kullanıcı) ve modül erişim kontrolü.", "Tüm kritik işlemler için denetim kaydı (audit log).", "Yüklenen dosyalarda tür ve zararlı içerik denetimi.", "Siteler arası (cross-site) istek reddi ile veri sızıntısına karşı koruma."]}, {"title": "Planlı iyileştirmeler", "bullets": ["İki adımlı doğrulama (MFA) yaygınlaştırma.", "Ayrıntılı erişim raporları ve anomali uyarıları.", "Yedekleme ve kurtarma prosedürlerinin belgelenmesi."]}]}
    />
  );
}
